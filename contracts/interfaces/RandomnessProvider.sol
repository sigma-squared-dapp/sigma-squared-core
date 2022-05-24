// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface RandomnessProvider {
    /**
     * Requests randomness.
     * @return requestID An ID associated with the randomness request.
     */
    function requestRandomness() external returns(bytes32);
}