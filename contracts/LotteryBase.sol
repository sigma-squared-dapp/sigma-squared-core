// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./GameBase.sol";
import "./interfaces/RandomnessConsumer.sol";
import "./interfaces/RandomnessProvider.sol";
import "./interfaces/SigmaGameRewards.sol";

abstract contract LotteryBase is RandomnessConsumer, GameBase {

    event Deposit(address indexed bettor, uint256 indexed round, uint256 amount, uint256 roundDepositTotal);
    event RoundEndTriggered(uint256 indexed round, bytes32 requestId, uint256 totalPool);
    event RoundEnd(uint256 indexed round, address winner, uint256 totalPool, uint256 randInt);

    event HouseEdgeChanged(uint256 prevValue, uint256 newValue);

    uint256 MAX_UINT_256 = 2**256 - 1;

    /**
     * Represents a single user (address)'s entry in a lottery round.
     */
    struct Entry {
        address entrant;
        uint256 totalDeposit;
    }

    /**
     * Represents a lottery round.  At the end of the round, the entire pool is given to a single winner.
     */
    struct Round {
        Entry[] entries;
        uint256 totalPool;
        uint256 startingBlock;
        uint256 endingBlock;
        uint256 lastRandomnessRequestBlock;
        bytes32 randomnessRequestId;
        bool settled;
        address winner;
    }

    // The minimum round length in blocks.
    uint256 private roundMinLength;

    // The house edge percentage for each bet.  This must be between 0 and 1 (1e8) inclusive.
    uint256 private houseEdgeMantissa = 0;  // 8 decimal places

    // An array of lottery rounds.  The current (active) round is the last item in the array.
    Round[] private rounds;

    // The total profit this contact has aquired from its house edge, since inception.
    uint256 totalContractProfit = 0;

    // Contains a mapping from entrant address to entries index, for the current round.
    mapping(address => uint256) entrantIndices;

    /**
     * @param randomnessProviderIn The randomness provider that is allowed to supply this contract with random ints.
     * @param roundLengthIn The minimum length, in blocks, a round can be.
     */
    constructor(RandomnessProvider randomnessProviderIn, uint256 roundLengthIn) GameBase(randomnessProviderIn) {
        roundMinLength = roundLengthIn;

        // Initialize first round.
        rounds.push();
        Round storage firstRound = rounds[0];
        firstRound.startingBlock = block.number;
        firstRound.endingBlock = block.number + roundLengthIn;
    }

    /**
     * Enter the current lottery round by depositing some amount. The chance of winning is weighted by the total
     * amount each player has deposited for the round.  If there is a non-zero house edge, it is taken out of the
     * deposit at this point.
     */
    function deposit(uint256 amount) external payable {
        Round storage currentRound = rounds[rounds.length - 1];

        // Make sure current round is active.
        require(currentRound.randomnessRequestId == bytes32(0), "Current round is no longer active");
        require(!currentRound.settled, "Current round is already settled.");

        _receiveFunds(amount);

        // Check if player already has an entry.
        uint256 entryI = entrantIndices[msg.sender];
        // Take out any house edge necessary.
        uint256 depositAmount = (amount * (1e8 - houseEdgeMantissa)) / 1e8;
        totalContractProfit += (amount * houseEdgeMantissa) / 1e8;
        if (currentRound.entries.length > entryI && currentRound.entries[entryI].entrant == msg.sender) {
            // An entry already exists, update it.
            currentRound.entries[entryI].totalDeposit += depositAmount;
            currentRound.totalPool += depositAmount;
            emit Deposit(msg.sender, rounds.length - 1, depositAmount, currentRound.entries[entryI].totalDeposit);
        } else {
            // Otherwise, add new entry.
            entrantIndices[msg.sender] = currentRound.entries.length;
            currentRound.entries.push(Entry(msg.sender, depositAmount));
            currentRound.totalPool += depositAmount;
            emit Deposit(msg.sender, rounds.length - 1, depositAmount, depositAmount);
        }
    }

    /**
     * Trigger the end of a lottery round.  After this is called, no one else can deposit/enter into the current round.
     * Randomness will be requested and the winner will be determined when randomness is received later on.  See receiveRandomInt.
     */
    function triggerRoundEnd() external {
        Round storage currentRound = rounds[rounds.length - 1];

        // Make sure the current round is not already settled.
        require(!currentRound.settled, "Round is already settled.");
        // Make sure current round is over.
        require(currentRound.endingBlock <= block.number, "Current round isn't over");
        // Make sure there are entries.
        require(currentRound.totalPool > 0, "Nothing in the pool.");
        require(currentRound.entries.length > 0, "No entries.");

        // Ensure randomness hasn't been requested before, or enough time has passed since the last randomness
        // request (in case of RandomnessProvider failure).
        require(currentRound.lastRandomnessRequestBlock == 0 || currentRound.lastRandomnessRequestBlock + 1000 < block.number,
                "Randomness has already been requested within the past 1000 blocks.  Wait for settlement or for 1000 blocks to pass.");

        currentRound.randomnessRequestId = getRandomnessProvider().requestRandomness();
        currentRound.lastRandomnessRequestBlock = block.number;
        emit RoundEndTriggered(rounds.length - 1, currentRound.randomnessRequestId, currentRound.totalPool);
    }

    /**
     * Receive generated randomness from the designated randomness provider.  This randomness is used to settle the
     * current round.  A winner is determined and the round's entire pool is transfered to them.
     */
    function receiveRandomInt(bytes32 requestId, uint256 randomInt) external onlyRandomnessProvider {
        uint256 originalRandInt = randomInt;
        Round storage currentRound = rounds[rounds.length - 1];
        require(currentRound.randomnessRequestId == requestId, "Request IDs don't match.");

        // Using random entropy provided, get a random number between 0 (inclusive) and the round's total pool (exclusive).
        // For an unbiased random number in this range, the underlying sample size must be divisble by the total pool amount.
        uint256 sampleSpaceRemainder = (MAX_UINT_256 % currentRound.totalPool) + 1;
        while (randomInt > MAX_UINT_256 - sampleSpaceRemainder) {
            // The random number will be continually "redrawn" until it is inside the required sample space.
            randomInt = uint256(keccak256(abi.encode(randomInt)));
        }
        randomInt = randomInt % currentRound.totalPool;

        // Use this number to choose the winner.
        uint256 winnerI = 0;
        uint256 remaining = randomInt;
        while (remaining > 0 && winnerI < currentRound.entries.length) {
            Entry memory currentEntry = currentRound.entries[winnerI];
            if (remaining >= currentEntry.totalDeposit) {
                remaining -= currentEntry.totalDeposit;
                ++winnerI;
            } else {
                remaining = 0;
            }
        }
        require(winnerI < currentRound.entries.length, "Did not find winner, something is very wrong.");
        address winner = currentRound.entries[winnerI].entrant;

        // Settle the round.
        currentRound.winner = winner;
        _doTransfer(winner, currentRound.totalPool);
        currentRound.settled = true;
        emit RoundEnd(rounds.length - 1, winner, currentRound.totalPool, originalRandInt);

        // Start new round.
        rounds.push();
        Round storage newRound = rounds[rounds.length - 1];
        require(!newRound.settled);
        newRound.startingBlock = block.number;
        newRound.endingBlock = block.number + roundMinLength;
    }

    /**
     * Set the minimum length a lottery round can be.
     * @param roundLengthBlocks The minimum duration in blocks.
     */
    function setRoundMinLength(uint256 roundLengthBlocks) external onlyOwner {
        roundMinLength = roundLengthBlocks;
    }

    /**
     * Sets the house edge for each entry, as a percentage of the deposit.
     * @param mantissa The house edge taken from each deposit expressed as a percentage mantissa (8 decimal places).
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
     * @return roundMinLength The min length a lottery round can be, in blocks.
     */
    function getRoundMinLength() public view returns(uint256) {
        return roundMinLength;
    }

    /**
     * @return prizePool The total prize pool for the current lottery round.
     */
    function getCurrentRoundPool() public view returns(uint256) {
        return rounds[rounds.length - 1].totalPool;
    }

    /**
     * @return roundStart The block the current lottery round started on.
     */
    function getCurrentRoundStart() public view returns(uint256) {
        return rounds[rounds.length - 1].startingBlock;
    }

    /**
     * @return roundEnd The earliest block on which the current lottery round can end.
     *
     * NOTE: To actually end the round, triggerRoundEnd() needs to be called after roundEnd has pasted.
     */
    function getCurrentRoundEnd() public view returns(uint256) {
        return rounds[rounds.length - 1].endingBlock;
    }

    /**
     * @return houseEdgeMantissa The house edge for each deposit.
     */
    function getHouseEdge() public view returns(uint256) {
        return houseEdgeMantissa;
    }

    /**
     * @return totalProfit The total contract profit since inception.
     */
    function getTotalContractProfit() public view returns(uint256) {
        return totalContractProfit;
    }

    /**
     * @return totalDeposit The total amount the given entrant has deposited in the current lottery round.
     */
    function getEntrantsCurrentDeposit(address entrant) public view returns(uint256) {
        uint256 i = entrantIndices[entrant];
        Entry[] memory entries = rounds[rounds.length - 1].entries;
        if (i >= entries.length  || entries[i].entrant != entrant) {
            return 0;
        } else {
            return entries[i].totalDeposit;
        }
    }

    /**
     * @return entries All entries in the current lottery round.
     */
    function getAllCurrentRoundEntries() public view returns(Entry[] memory) {
        return rounds[rounds.length - 1].entries;
    }

    /**
     * @return currentRoundIndex The index of the current round.
     */
    function getCurrentRoundIndex() public view returns(uint256) {
        return rounds.length - 1;
    }

    /**
     * @return currentRound A struct representing the current lottery round.
     */
    function getCurrentRound() public view returns(Round memory) {
        return rounds[rounds.length - 1];
    }

}