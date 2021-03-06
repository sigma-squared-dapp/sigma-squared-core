const LotteryNative = artifacts.require("LotteryNative");
const LotterySigmaSquared = artifacts.require("LotterySigmaSquared");
const LotteryUSDC = artifacts.require("LotteryUSDC");

const ChainlinkRandomnessProvider = artifacts.require("ChainlinkRandomnessProvider");
const SigmaSquared = artifacts.require("SigmaSquared");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");

const externalContractInfo = {
  polygon_mumbai: {
    usdcToken: '0xe11A86849d99F524cAC3E7A0Ec1241828e332C62',
  },
  polygon: {
    usdcToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  }
}

module.exports = async function(deployer, network) {
  if (network == 'develop') {
    await deployer.deploy(LotteryNative, TestRandomnessProvider.address, 1);
    await deployer.deploy(LotterySigmaSquared, TestRandomnessProvider.address, SigmaSquared.address, 1);
  } else if (network == 'polygon_mumbai') {
    await deployer.deploy(LotteryNative, ChainlinkRandomnessProvider.address, 180);
    await deployer.deploy(LotterySigmaSquared, ChainlinkRandomnessProvider.address, SigmaSquared.address, 180);
    await deployer.deploy(LotteryUSDC, ChainlinkRandomnessProvider.address, externalContractInfo[network].usdcToken, 180);

    // Add the Lottery Games as allowed randomness provider users, so they can request randomness.
    const rand = await ChainlinkRandomnessProvider.deployed();
    await rand.addAllowedUser(LotteryNative.address);
    await rand.addAllowedUser(LotterySigmaSquared.address);
    await rand.addAllowedUser(LotteryUSDC.address);
  } else if (network === 'polygon') {
    // A lottery round should be ~1 week (302400 blocks).
    await deployer.deploy(LotteryNative, ChainlinkRandomnessProvider.address, 302400);
    await deployer.deploy(LotterySigmaSquared, ChainlinkRandomnessProvider.address, SigmaSquared.address, 302400);
    await deployer.deploy(LotteryUSDC, ChainlinkRandomnessProvider.address, externalContractInfo[network].usdcToken, 302400);

    // Add the Lottery Games as allowed randomness provider users, so they can request randomness.
    const rand = await ChainlinkRandomnessProvider.deployed();
    await rand.addAllowedUser(LotteryNative.address);
    await rand.addAllowedUser(LotterySigmaSquared.address);
    await rand.addAllowedUser(LotteryUSDC.address);
  }
};
