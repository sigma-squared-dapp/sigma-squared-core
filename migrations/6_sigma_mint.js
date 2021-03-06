const BernoulliGameSigmaSquared = artifacts.require("BernoulliGameSigmaSquared");
const SigmaSquared = artifacts.require("SigmaSquared");
const SigmaSquaredLargestLossRewards = artifacts.require("SigmaSquaredLargestLossRewards");
const USDCLargestLossRewards = artifacts.require("USDCLargestLossRewards");
const NativeLargestLossRewards = artifacts.require("NativeLargestLossRewards");
const SigmaSquaredTimelockController = artifacts.require("SigmaSquaredTimelockController");

module.exports = async function(deployer, network, accounts) {
    if (network === 'polygon_mumbai' || network === 'polygon') {
        const sigma = await SigmaSquared.deployed();

        await sigma.mint(BernoulliGameSigmaSquared.address, web3.utils.toWei('2500000', 'ether'));

        await sigma.mint(SigmaSquaredLargestLossRewards.address, web3.utils.toWei('4500000', 'ether'));
        await sigma.mint(USDCLargestLossRewards.address, web3.utils.toWei('2250000', 'ether'));
        await sigma.mint(NativeLargestLossRewards.address, web3.utils.toWei('2250000', 'ether'));

        await sigma.mint(SigmaSquaredTimelockController.address, web3.utils.toWei('500000', 'ether'));

        await sigma.mint(accounts[0], web3.utils.toWei('500000', 'ether'));
    }
}