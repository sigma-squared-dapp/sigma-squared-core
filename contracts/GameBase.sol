// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/RandomnessProvider.sol";
import "./interfaces/SigmaGameRewards.sol";

/**
 * The base contract for all gambling games.  This contains any logic that can be shared across all games.
 */
abstract contract GameBase is Ownable {
    
    event RandomnessProviderChanged(address prevProvider, address newProvider);
    event GameRewardsChanged(address prevRewards, address newRewards);

    modifier onlyRandomnessProvider {
        require(
            msg.sender == address(randomnessProvider),
            "Only the designated randomness provider can call this function."
        );
        _;
    }

    RandomnessProvider private randomnessProvider;
    SigmaGameRewards private rewardsContract;

    constructor(RandomnessProvider randomnessProviderIn) {
        randomnessProvider = randomnessProviderIn;
    }

    /**
     * Sets the designated randomness provider.  This is the only contract/account allowed to provide randomness
     * used in the game.
     * WARNING: This should only ever be changed with extreme care, as it affects the integrity of the game.
     * @param randomnessProviderIn The address of the new randomness provider.
     */
    function setRandomnessProvider(RandomnessProvider randomnessProviderIn) external onlyOwner {
        emit RandomnessProviderChanged(address(randomnessProvider), address(randomnessProviderIn));
        randomnessProvider = randomnessProviderIn;
    }

    /**
     * Sets the rewards contract that wins and losses are reported to.
     * @param rewardsIn The address of the rewards contracts (or the zero address if nothing should be reported).
     */
    function setGameRewards(SigmaGameRewards rewardsIn) external onlyOwner {
        emit GameRewardsChanged(address(rewardsContract), address(rewardsIn));
        rewardsContract = rewardsIn;
    }

    /**
     * @return randomnessProvider The current randomness provider.  This is the only contract/address allowed to provided randomness to the game.
     */
    function getRandomnessProvider() public view returns(RandomnessProvider) {
        return randomnessProvider;
    }

    /**
     * @return rewardsContract The current rewards contract where losses and wins are reported to.
     */
    function getGameRewards() public view returns(SigmaGameRewards) {
        return rewardsContract;
    }
    

    /**
     * Called internally to transfer funds from the contract to some recepient.  This should be overriden by children
     * and send either an ERC20 token or the native chain token.
     * @param recepient The address to receive the funds.
     * @param amount The amount to send.
     */
    function _doTransfer(address recepient, uint256 amount) virtual internal;

    /**
     * Called internally when the contract should receive funds from a user.  This should be overriden by children
     * contracts and either initiate a ERC20 transfer, or ensure the caller has provided the needed native token.
     */
    function _receiveFunds(uint256 amount) virtual internal;

    /**
     * @return The current contract's balance (current unsettled bets not included).
     */
    function getContractBalance() virtual public view returns(uint256);

}