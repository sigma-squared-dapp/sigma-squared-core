// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/RandomnessConsumer.sol";
import "../interfaces/RandomnessProvider.sol";

/**
 * A testing helper that implements the RandomnessProvider interface.
 * The user can manually call into it to control the randomness sent to the consumer.
 */
contract TestRandomnessProvider is RandomnessProvider {

    uint32 currentId = 0;

    // Maps the given requestId to the address who requested randomness.
    mapping(bytes32 => address) public requestIdToUser;

    function requestRandomness() public returns(bytes32) {
        ++currentId;
        requestIdToUser[bytes32(abi.encode(currentId))] = msg.sender;
        return bytes32(abi.encode(currentId));
    }

    function sendRandomness(bytes32 requestId, uint256 r) public {
        require(requestIdToUser[requestId] != address(0));
        RandomnessConsumer(requestIdToUser[requestId]).receiveRandomInt(requestId, r);
    }
}