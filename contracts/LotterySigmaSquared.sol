// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./LotteryERC20.sol";

/**
 * This is the exact same as LotteryERC20, it only exists to make it easier for Truffle to deploy and keep
 * track of duplicate contracts.
 * It is intended to be used for a Lottery where deposits are made in Sigma Squared tokens.
 */
contract LotterySigmaSquared is LotteryERC20 {
    constructor(RandomnessProvider randomnessProviderIn, IERC20 tokenIn, uint256 roundLengthIn)
        LotteryERC20(randomnessProviderIn, tokenIn, roundLengthIn) {

    }
}