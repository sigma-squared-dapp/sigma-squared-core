// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/RandomnessConsumer.sol";
import "./interfaces/RandomnessProvider.sol";

/**
 * Implements the RandomnessProvider interface, and utilizes Chainlink's decentralized VRF V1 functionality to provide
 * randomness.  See the Chainlink documentation for more information.
 */
contract ChainlinkRandomnessProvider is RandomnessProvider, VRFConsumerBase, Ownable {
    using SafeERC20 for IERC20;

    bytes32 internal keyHash;
    uint256 internal fee;

    // Keeps track of all the users who are allowed to request randomness.  These will be game contracts.
    mapping(address => bool) private allowedUsers;
    
    // Maps the given requestId to the address who requested randomness.
    mapping(bytes32 => address) private requestIdToUser;

    constructor(address vrfCoordinator, address linkToken, bytes32 keyHashIn, uint256 feeIn)
        VRFConsumerBase(vrfCoordinator, linkToken) {
        
        keyHash = keyHashIn;
        fee = feeIn;
    }

    function requestRandomness() external override returns(bytes32) {
        require(allowedUsers[msg.sender], "Calling address not allowed to request randomness.");
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK.");
        bytes32 requestId = requestRandomness(keyHash, fee);
        requestIdToUser[requestId] = msg.sender;
        return requestId;
    }

    /**
     * Should be primarily used to withdraw LINK (used to fund randomness requests).
     */
    function withdrawToken(IERC20 token, uint256 amount) external onlyOwner {
        token.safeTransfer(owner(), amount);
    }

    /**
     * Add an address to the list of allowed randomness requestors.
     */
    function addAllowedUser(address user) external onlyOwner {
        allowedUsers[user] = true;
    }

    /**
     * Removes an address from the list of allowed randomness requestors.
     */
    function removeAllowedUser(address user) external onlyOwner {
        allowedUsers[user] = false;
    }

    /**
     * @return allowed Whether or not given address is allowed to request randomness.
     */
    function isAllowedToRequest(address user) public view returns(bool) {
        return allowedUsers[user];
    }


    /**
     * This is the callback that Chainlink VRF uses to deliver a random integer.
     * This function forwards it to the requestor.
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        address requestor = requestIdToUser[requestId];
        delete requestIdToUser[requestId];
        require(requestor != address(0), "Invalid requestor stored for the given request ID.");
        RandomnessConsumer(requestor).receiveRandomInt(requestId, randomness);
    }

}