// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/SigmaGameRewards.sol";

/**
 * This contract provides functionality to distribute rewards to users based on the largest loss they experience
 * in a game in a given round.
 * 
 * A game reports losses to this contract.  For every round, the distributed tokens are prorated to all losers
 * based on their largest loss in the period.
 */
contract LargestLossRewards is SigmaGameRewards, Ownable {
    using SafeERC20 for IERC20;

    event NewLargestLoss(address indexed bettor, uint256 amount, bytes32 requestId, uint256 round);
    event RoundEnd(uint256 indexed round, uint256 tokensDistributed, uint256 totalLargestLosses);

    IERC20 private rewardsToken;

    // The total amount of tokens to distibute over the lifetime of the contract.
    uint256 lifetimeDistributions;

    // The total amount of tokens that have been allocated to players in past round, so far.  This includes unclaimed rewards.
    uint256 totalRewards = 0;

    // The total amount of tokens that have been allocated to player in past rounds, but are not claimed.
    uint256 unclaimedRewards = 0;

    // A mapping that keeps track of what games are allowed to report to this rewards contract.
    mapping (address => bool) allowedGames;

    // The current distribution "round".  This starts as 0 and is used as an indice in the below arrays.
    uint256 private currentRound;
    // The block associated with the end of each distrubion round.
    uint256[] private roundBlock;
    // The total token amount to distributed in each round.
    uint256[] private roundDistributions;
    // The largest loss a given bettor has experienced in the given round.
    mapping(address => uint256[]) private bettorRoundLargestLoss;
    // The sum of all players' largest loss in the given round.
    uint256[] private roundTotalLargestLosses;
    // The last claimed round for each player.
    mapping(address => uint256) private lastClaimedRound;

    // The min number of blocks between each distribution round.
    uint256 private minBlocksPerRound;
    // The number of Sigma Squared tokens to distributed each round.
    uint256 private tokensDistributedPerBlock;

    modifier onlyGame {
        require(
            allowedGames[msg.sender],
            "Only the designated game contract can call this function."
        );
        _;
    }

    /**
     * @param tokenIn The address of the token to distribute as rewards.
     * @param minBlocksPerRoundIn The minimum number of blocks that must exist between successive rounds.
     * @param tokensPerBlock The amount of tokens to distribute each block.
     * @param totalTokensToDistribute The total amount of tokens to distribute over the life of this contract.
     */
    constructor(IERC20 tokenIn, uint256 minBlocksPerRoundIn, uint256 tokensPerBlock, uint256 totalTokensToDistribute) {
        rewardsToken = tokenIn;
        minBlocksPerRound = minBlocksPerRoundIn;
        tokensDistributedPerBlock = tokensPerBlock;

        // Add a first round that ends on the current block, where nothing is distributed.
        roundBlock.push(block.number);
        roundDistributions.push(0);
        roundTotalLargestLosses.push(0);

        currentRound = 1;

        lifetimeDistributions = totalTokensToDistribute;
    }

    /**
     * Add a game that's allowed to report wins/loss.
     */
    function addGame(address game) onlyOwner external {
        allowedGames[game] = true;
    }

    /**
     * Revokes an address's permission to report wins/losses.
     */
    function removeGame(address game) onlyOwner external {
        allowedGames[game] = false;
    }

    /**
     * Check if the provided address is allowed to report wins/loss.
     */
    function isGame(address game) public view returns(bool) {
        return allowedGames[game];
    }

    function recordWin(address bettor, uint256 betAmount, uint256 winAmount, bytes32 requestId) onlyGame external {
        // Do nothing.
    }

    function recordLoss(address bettor, uint256 betAmount, bytes32 requestId) onlyGame external {
        while (currentRound >= bettorRoundLargestLoss[bettor].length) {
            bettorRoundLargestLoss[bettor].push(0);
        }
        require(currentRound == bettorRoundLargestLoss[bettor].length - 1);

        while (currentRound >= roundTotalLargestLosses.length) {
            roundTotalLargestLosses.push(0);
        }
        require(currentRound == roundTotalLargestLosses.length - 1);

        // If this is the bettor's largest loss yet, update state.
        if (betAmount > bettorRoundLargestLoss[bettor][currentRound]) {
            roundTotalLargestLosses[currentRound] -= bettorRoundLargestLoss[bettor][currentRound];
            roundTotalLargestLosses[currentRound] += betAmount;

            bettorRoundLargestLoss[bettor][currentRound] = betAmount;

            emit NewLargestLoss(bettor, betAmount, requestId, currentRound);
        }

    }

    function triggerRound() external {
        require(lifetimeDistributions > totalRewards, "All the rewards have been given out already.");
        require(currentRound > 0);
        // Ensure there have been some bets placed this round.
        require(currentRound == roundTotalLargestLosses.length - 1, "No bets have been placed this round.");

        // Ensure enough time has passed since last round.
        require(block.number - roundBlock[currentRound - 1] >= minBlocksPerRound, "Not enough blocks since last round.");

        // Record round's ending block.
        roundBlock.push(block.number);
        require(currentRound == roundBlock.length - 1);

        // Calculate token amount to distributed.
        uint256 blockDiff = block.number - roundBlock[currentRound - 1];
        uint256 tokens = blockDiff * tokensDistributedPerBlock;
        if (tokens > lifetimeDistributions - totalRewards) {
            tokens = lifetimeDistributions - totalRewards;
        }
        roundDistributions.push(tokens);
        totalRewards += tokens;
        unclaimedRewards += tokens;
        require(currentRound == roundDistributions.length - 1);
        emit RoundEnd(currentRound, tokens, roundTotalLargestLosses[currentRound]);
        ++currentRound;
    }

    /**
     * Claim all the rewards available to the caller (msg.sender).
     */
    function claimRewards() external {
        require(currentRound - 1 > lastClaimedRound[msg.sender], "Nothing to claim.");
        uint256 rewards = calculateCurrentRewards(msg.sender);
        lastClaimedRound[msg.sender] = currentRound - 1;

        unclaimedRewards -= rewards;
        rewardsToken.safeTransfer(msg.sender, rewards);
    }

    /**
     * @return rewards The amount of current rewards that can be claimed.
     */
    function calculateCurrentRewards(address bettor) public view returns(uint256) {
        uint256 r = lastClaimedRound[bettor] + 1;
        uint256 rewards = 0;

        while (r < currentRound) {
            if (bettorRoundLargestLoss[bettor].length <= r) {
                ++r;
                continue;
            }
            // This has the potential for overflows, but given the total supply of sigma it should never happen.  It will fail in such a case.
            uint256 roundRewards = roundDistributions[r] * bettorRoundLargestLoss[bettor][r] / roundTotalLargestLosses[r];
            rewards += roundRewards;
            ++r;
        }

        return rewards;
    }

    function getMinBlocksPerRound() public view returns(uint256) {
        return minBlocksPerRound;
    }

    function getTokensDistributedPerBlock() public view returns(uint256) {
        return tokensDistributedPerBlock;
    }

    /**
     * @return roundStartBlock The block that the current round started on, or the last round ended on.
     */
    function getRoundStartingBlock() public view returns(uint256) {
        return roundBlock[currentRound - 1];
    }

    /**
     * @return lifetimeDistributions The total amount of tokens to be distributed over the lifetime of the contract.
     */
    function getLifetimeRewards() public view returns(uint256) {
        return lifetimeDistributions;
    }

    /**
     * @return totalRewards The total amount of tokens that have been distributed to players so far, since contract
     *                      creation.  This includes unclaimed rewards.
     */
    function getTotalRewardsAllocated() public view returns(uint256) {
        return totalRewards;
    }

    /**
     * @return unclaimedRewards The total amount of tokens that have been allocated to players, but have not been claimed yet.
     */
    function getUnclaimedRewards() public view returns(uint256) {
        return unclaimedRewards;
    }

    /**
     * @return largestLoss The provided bettor's largest loss in the current round.
     */
    function getBettorsCurrentLargestLoss(address bettor) public view returns(uint256) {
        if (currentRound + 1 == bettorRoundLargestLoss[bettor].length) {
            return bettorRoundLargestLoss[bettor][currentRound];
        } else {
            return 0;
        }
    }

    function getCurrentRound() public view returns(uint256) {
        return currentRound;
    }

    /**
     * Used to withdraw any tokens that have not been distributed.
     */
    function withdrawToken(IERC20 tokenToWithdraw, uint256 amount) external onlyOwner {
        tokenToWithdraw.safeTransfer(owner(), amount);
    }

}