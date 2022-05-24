// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BernoulliGameERC20.sol";

/**
 * This is the exact same as BernoulliGameERC20, it only exists to make it easier for Truffle to deploy and keep
 * track of duplicate contracts.
 * It is intended to be used for a Bernoulli game where bets are placed with Sigma Squared.
 */
contract BernoulliGameSigmaSquared is BernoulliGameERC20 {
    constructor(RandomnessProvider randomnessProviderIn, IERC20 tokenIn)
        BernoulliGameERC20(randomnessProviderIn, tokenIn) {

    }
}