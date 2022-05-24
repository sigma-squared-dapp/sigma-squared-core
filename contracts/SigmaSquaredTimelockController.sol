// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * This is the TimelockController used by the SigmaSquaredGovernor.  It ensures that after DAO proposals are voted on
 * and succeed, they are queued and executed at some later time (delays the execution).  The exact delay can be set by
 * the governor / DAO.
 */
contract SigmaSquaredTimelockController is TimelockController {

    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors
    ) TimelockController(minDelay, proposers, executors) {
        
    }
}