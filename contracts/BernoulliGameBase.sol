// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./GameBase.sol";
import "./interfaces/RandomnessConsumer.sol";

/**
 * The base contract for all Bernoulli games.  This contains all the shared common logic.
 * 
 * A Bernoulli game is one in which a player bets on a Bernoulli random variable.  As such, there are two possible
 * outcomes: a win or a loss.  The user can place a bet and specify an amount and a multiplier.  When the bet is
 * settled, the result will either be a win and they'll recieve amount * multiplier or a loss and they won't get anything.
 * The probability of a win depends on the set house edge.
 *
 * Example: Player bets amount 2, with multiplier 2x.  There is a 0 house edge.
 * Outcomes: 50% win (player recieves 4), 50% loss (player recieves nothing).
 *
 * Multipliers, house edge, and other percentage type variable are specified as integer mantissas, with 8 decimal places.
 * e.g. 1e8 => 100%, 5e7 => 50%
 */
abstract contract BernoulliGameBase is RandomnessConsumer, GameBase {

    event BetReceived(address indexed bettor, uint256 amount, uint256 multiplier);
    event BetAccepted(address indexed bettor, uint256 amount, uint256 multiplier, bytes32 requestId);
    event BetLost(address indexed bettor, uint256 betAmount, uint256 multiplier, bytes32 requestId, uint128 randInt);
    event BetWon(address indexed bettor, uint256 betAmount, uint256 multiplier, uint256 winAmount, bytes32 requestId, uint128 randInt);

    event HouseEdgeChanged(uint256 prevValue, uint256 newValue);
    event MaxLossMantissaChanged(uint256 prevValue, uint256 newValue);
    event MinBetChanged(uint256 prevValue, uint256 newValue);

    uint256 MAX_UINT_128 = 2**128 - 1;

    struct Bet {
        address bettor;
        uint256 amount;
        uint256 multiplier; // 8 decimal places
        uint256 blockNumber;
        bool settled;
        bool outcome; // true for win, false for loss.
    }

    Bet[] private placedBets;

    // Maps request IDs (from randomness provider) to bet indices.
    mapping(bytes32 => uint256) private requestIdMap;

    uint256 private numActiveBets = 0;

    // The expected house edge percentage for each bet.  This must be between 0 and 1 (1e8), inclusive.
    uint256 private houseEdgeMantissa = 0;      // 8 decimal places

    // The maximum percentage of the contracts balance that can be lost in a single bet.
    uint256 private maxLossMantissa;   // 8 decimal places

    // The min bet allowed.
    uint256 private minBet;

    // The amount of this contract's funds currently at risk from unsettled bets that have been placed.
    uint256 private atRisk = 0;

    // The total profit (or loss if negative) this contract has made since inception.
    int256 private totalContractProfit = 0;

    constructor (RandomnessProvider randomnessProviderIn)
        GameBase(randomnessProviderIn) {

    }

    /**
     * Place a bet.  If the bet is won, the sender receives amount * multiplier back.
     * If the bet is lost, nothing is recieved.  Bets will be settled later on when randomness is received.
     * @param amount the amount to bet.
     * @param multiplier the multiplier to use.  This has 8 decimal places.
     * @return requestId The request ID associated with the bet.
     */
    function placeBet(uint256 amount, uint256 multiplier) payable external returns(bytes32) {
        emit BetReceived(msg.sender, amount, multiplier);
        require(multiplier > 1e8, "The multiplier must be greater than 1 (1e8 mantissa)");
        _receiveFunds(amount);
        // Apply risk checks.
        _applyRiskChecks(amount, multiplier);

        // Request randomness.
        bytes32 requestId = getRandomnessProvider().requestRandomness();

        // Keep track of request ID => bettor mapping.
        requestIdMap[requestId] = placedBets.length;

        // Add bet to list.
        atRisk += ((amount * multiplier) / 1e8);
        placedBets.push(Bet(msg.sender, amount, multiplier, block.number, false, false));
        emit BetAccepted(msg.sender, amount, multiplier, requestId);

        ++numActiveBets;

        return requestId;
    }


    /**
     * Receive generated randomness from the designated randomness provider.  Extreme care needs to be taken to ensure
     * the randomness provider is trusted/secure and is truly random.  This is controlled by the contract owner.
     * @param randomInt The provided random uint256.
     */
    function receiveRandomInt(bytes32 requestId, uint256 randomInt) external onlyRandomnessProvider {
        // Use the random int to the settle the corresponding bet.
        uint256 betId = requestIdMap[requestId];
        Bet memory currentBet = placedBets[betId];
        require(!currentBet.settled, "The current bet should never be settled already, something's really wrong.");
        require(!currentBet.outcome, "The current bet should never have a win outcome before it's settled, something's really wrong.");
        uint128 currentRandomInt = uint128(randomInt);
        // probability = (1 / multiplier)
        uint256 probability = ((MAX_UINT_128 + 1) * (1e8 - houseEdgeMantissa)) / currentBet.multiplier; // scaled between 0 and max uint128
        uint256 winAmount = (currentBet.amount * currentBet.multiplier) / 1e8;
        if (currentRandomInt < uint128(probability)) {
            // The bet was won.
            // Transfer the winnings.
            _doTransfer(currentBet.bettor, winAmount);
            // Record the outcome.
            placedBets[betId].outcome = true;
            require(placedBets[betId].outcome);
            emit BetWon(currentBet.bettor, currentBet.amount, currentBet.multiplier, winAmount, requestId, currentRandomInt);
            // Report win to the rewards contract if necessary.
            if (address(getGameRewards()) != address(0)) {
                getGameRewards().recordWin(currentBet.bettor, currentBet.amount, winAmount, requestId);
            }
            // Keep track of total contract profit.
            totalContractProfit -= int256(winAmount - currentBet.amount);
        } else {
            // The bet was lost.
            // Nothing needs to be transfered as the contract already has the original amount bet.
            emit BetLost(currentBet.bettor, currentBet.amount, currentBet.multiplier, requestId, currentRandomInt);
            // Report loss to the rewards contract if necessary.
            if (address(getGameRewards()) != address(0)) {
                getGameRewards().recordLoss(currentBet.bettor, currentBet.amount, requestId);
            }
            // Keep track of total contract profit.
            totalContractProfit += int256(currentBet.amount);
        }
        placedBets[betId].settled = true;
        atRisk -= winAmount;
        --numActiveBets;
    }

    /**
     * Used to get the original bet back if the bet is never settled for some reason.
     */
    function refundBet(bytes32 requestId) external {
        uint256 betId = requestIdMap[requestId];
        require(block.number - placedBets[betId].blockNumber > 1000, "Must wait at least 1000 blocks before you can refund a bet.");
        require(!placedBets[betId].settled, "Bet is already settled.");
        placedBets[betId].settled = true;
        uint256 winAmount = (placedBets[betId].amount * placedBets[betId].multiplier) / 1e8;
        atRisk -= winAmount;
        --numActiveBets;
        _doTransfer(placedBets[betId].bettor, placedBets[betId].amount);
    }

    /**
     * Sets the max possible loss allowed, as a percentage of the contracts current balance.
     * @param mantissa The max possible loss allowed expressed as a percentage mantissa (8 decimal places).
     */
    function setMaxLossMantissa(uint256 mantissa) external onlyOwner {
        emit MaxLossMantissaChanged(houseEdgeMantissa, mantissa);
        maxLossMantissa = mantissa;
    }

    /**
     * Sets the min bet allowed.
     */
    function setMinBet(uint256 minBetIn) external onlyOwner {
        emit MinBetChanged(minBet, minBetIn);
        minBet = minBetIn;
    }

    /**
     * Sets the house edge for each bet, as a percentage of each bet.
     * @param mantissa The house edge for each bet expressed as a percentage mantissa (8 decimal places).
     */
    function setHouseEdge(uint256 mantissa) external onlyOwner {
        require(mantissa <= 1e8);
        emit HouseEdgeChanged(houseEdgeMantissa, mantissa);
        houseEdgeMantissa = mantissa;
    }

    /**
     * Withdraws funds from the game's balance, and sends to the owner.
     */
    function withdraw(uint256 amount) external onlyOwner {
        _doTransfer(owner(), amount);
    }

    /**
     * @return numActiveBets The current number of active bets waiting to be settled.
     * These bets are waiting for a random integer to be provided before they are settled.
     */
    function getNumActiveBets() public view returns(uint256) {
        return numActiveBets;
    }

    /**
     * @return placedBets An array of all bets placed throughout this contracts history.
     */
    function getPlacedBets() public view returns(Bet[] memory) {
        return placedBets;
    }

    /**
     * @return houseEdgeMantissa The house edge for each bet.
     */
    function getHouseEdge() public view returns(uint256) {
        return houseEdgeMantissa;
    }

    /**
     * @return maxLossMantissa The max loss allowed, as a percentage of the contract's current balance.
     */
    function getMaxLossMantissa() public view returns(uint256) {
        return maxLossMantissa;
    }

    /**
     * @return minBet The minimum bet allowed.
     */
    function getMinBet() public view returns(uint256) {
        return minBet;
    }

    /**
     * @return totalAtRisk The total amount currently at risk, from unsettled bets.
     */
    function getTotalAtRisk() public view returns(uint256) {
        return atRisk;
    }

    /**
     * @return totalProfit The total contract profit since inception (negative for loss).
     */
    function getTotalContractProfit() public view returns(int256) {
        return totalContractProfit;
    }

    /**
     * Used to apply risk checks to an incoming bet.
     * This ensures the contract has sufficient funds to fulfill all wins in the worst-case scenario, and ensures
     * the possible win amount is not greater than the max allowable loss (percentage of contract's funds).
     */
    function _applyRiskChecks(uint256 amount, uint256 multiplier) internal view {
        require(amount >= minBet, "Bet is below minimum allowed.");
        // Ensure loss isn't greater than maximum allowed.
        // (you have to subtract the bet amount, because it was already transfered at this point)
        require(((amount * (multiplier - 1e8)) / 1e8) <= (((getContractBalance() - amount - atRisk) * maxLossMantissa) / 1e8), "Max possible win is too high.");
        // Ensure the contract has sufficient funds.
        require(((amount * multiplier) / 1e8) < (getContractBalance() - atRisk), "Insufficient contract funds.");
    }
}