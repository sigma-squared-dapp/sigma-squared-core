const BernoulliGameSigmaSquared = artifacts.require("BernoulliGameSigmaSquared");
const BernoulliGameUSDC = artifacts.require("BernoulliGameUSDC");
const BernoulliGameNative = artifacts.require("BernoulliGameNative");
const SigmaSquared = artifacts.require("SigmaSquared");
const SigmaSquaredLargestLossRewards = artifacts.require("SigmaSquaredLargestLossRewards");
const USDCLargestLossRewards = artifacts.require("USDCLargestLossRewards");
const NativeLargestLossRewards = artifacts.require("NativeLargestLossRewards");

module.exports = async function(deployer, network) {
    if (network == 'develop') {
        await deployer.deploy(SigmaSquaredLargestLossRewards, SigmaSquared.address, 1, web3.utils.toWei('10', 'ether'), web3.utils.toWei('100000', 'ether'));
        await (await SigmaSquaredLargestLossRewards.deployed()).addGame(BernoulliGameSigmaSquared.address);
        await (await BernoulliGameSigmaSquared.deployed()).setGameRewards(SigmaSquaredLargestLossRewards.address);
    }

    if (network == 'polygon_mumbai') {
        /**
         * Each round should be about 1 hour, and there should be ~10 SIGMA2 released during that time period.
         */
        
        await deployer.deploy(SigmaSquaredLargestLossRewards, SigmaSquared.address, 360, web3.utils.toWei('20', 'ether'), web3.utils.toWei('4250000', 'ether'));
        await (await SigmaSquaredLargestLossRewards.deployed()).addGame(BernoulliGameSigmaSquared.address);
        await (await BernoulliGameSigmaSquared.deployed()).setGameRewards(SigmaSquaredLargestLossRewards.address);

        await deployer.deploy(USDCLargestLossRewards, SigmaSquared.address, 360, web3.utils.toWei('10', 'ether'), web3.utils.toWei('2125000', 'ether'));
        await (await USDCLargestLossRewards.deployed()).addGame(BernoulliGameUSDC.address);
        await (await BernoulliGameUSDC.deployed()).setGameRewards(USDCLargestLossRewards.address);
        
        await deployer.deploy(NativeLargestLossRewards, SigmaSquared.address, 360, web3.utils.toWei('10', 'ether'), web3.utils.toWei('2125000', 'ether'));
        await (await NativeLargestLossRewards.deployed()).addGame(BernoulliGameNative.address);
        await (await BernoulliGameNative.deployed()).setGameRewards(NativeLargestLossRewards.address);

    }
}