// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface RandomnessConsumer {
    function receiveRandomInt(bytes32 requestID, uint256 randomInt) external;
}