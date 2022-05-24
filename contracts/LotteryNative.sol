// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./LotteryBase.sol";

contract LotteryNative is LotteryBase {
    constructor(RandomnessProvider randomnessProviderIn, uint256 roundLengthIn)
        LotteryBase(randomnessProviderIn, roundLengthIn) {

    }

    function _doTransfer(address recepient, uint256 amount) override internal {
        (bool sent,) = recepient.call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    function _receiveFunds(uint256 amount) override internal {
        require(msg.value == amount, "Amount specified does not equal the amount of ether sent.");
    }

    function getContractBalance() override public view returns(uint256) {
        return address(this).balance;
    }

    receive() external payable {

    }
    
}