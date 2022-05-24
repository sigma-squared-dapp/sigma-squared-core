// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BernoulliGameBase.sol";

/**
 * Extends the BernoulliGameBase contract to implement a Bernoulli game for ERC20 tokens.
 */
contract BernoulliGameERC20 is BernoulliGameBase {
    using SafeERC20 for IERC20;

    IERC20 private token;

    constructor(RandomnessProvider randomnessProviderIn, IERC20 tokenIn) BernoulliGameBase(randomnessProviderIn) {
        token = tokenIn;
    }

    function getTokenAddress() public view returns(IERC20) {
        return token;
    }

    function _doTransfer(address recepient, uint256 amount) override internal {
        token.safeTransfer(recepient, amount);
    }

    function _receiveFunds(uint256 amount) override internal {
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function getContractBalance() override public view returns(uint256) {
        return token.balanceOf(address(this));
    }
}