// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LargestLossRewards.sol";

/**
 * This is the exact same as LargestLossRewards, it only exists to make it easier to deploy multiple duplicate
 * contracts with Truffle.
 */
contract USDCLargestLossRewards is LargestLossRewards {
    constructor(IERC20 tokenIn, uint256 minBlocksPerRoundIn, uint256 tokensPerBlock, uint256 totalTokensToDistribute)
        LargestLossRewards(tokenIn, minBlocksPerRoundIn, tokensPerBlock, totalTokensToDistribute) {

    }
}