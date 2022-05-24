const SigmaSquared = artifacts.require("SigmaSquared");
const SigmaSquaredTimelockController = artifacts.require("SigmaSquaredTimelockController");
const SigmaSquaredGovernor = artifacts.require("SigmaSquaredGovernor");

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

module.exports = async function(deployer, network, accounts) {
    if (network === 'polygon_mumbai') {
        await deployer.deploy(SigmaSquaredTimelockController, 0, [], []);
        await deployer.deploy(SigmaSquaredGovernor, SigmaSquared.address, SigmaSquaredTimelockController.address, 20);
        const timelock = await SigmaSquaredTimelockController.deployed();
        const gov = await SigmaSquaredGovernor.deployed();
        // Add the governor as the sole proposer.
        await timelock.grantRole(await timelock.PROPOSER_ROLE(), gov.address);
        // Allow anyone to execute queued transactions.
        await timelock.grantRole(await timelock.EXECUTOR_ROLE(), ZERO_ADDRESS);
        // Ensure only the timelock itself is the admin.
        await timelock.revokeRole(await timelock.TIMELOCK_ADMIN_ROLE(), accounts[0]);
    }
};
