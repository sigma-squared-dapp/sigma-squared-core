// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * An interface implemented by contracts that give rewards to game users based on their activity.
 * This provides a standard interfacts for game contracts to report user activity.
 */
interface SigmaGameRewards {
    function recordWin(address bettor, uint256 betAmount, uint256 winAmount, bytes32 requestId) external;

    function recordLoss(address bettor, uint256 betAmount, bytes32 requestId) external;
}