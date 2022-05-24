const BernoulliGameNative = artifacts.require("BernoulliGameNative");
const BernoulliGameSigmaSquared = artifacts.require("BernoulliGameSigmaSquared");
const BernoulliGameUSDC = artifacts.require("BernoulliGameUSDC");
const ChainlinkRandomnessProvider = artifacts.require("ChainlinkRandomnessProvider");
const SigmaSquared = artifacts.require("SigmaSquared");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");

const externalContractInfo = {
  polygon_mumbai: {
    vrfCoordinator: '0x8C7382F9D8f56b33781fE506E897a4F1e2d17255',
    linkToken: '0x326C977E6efc84E512bB9C30f76E30c160eD06FB',
    vrfKeyHash: '0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4',
    vrfFeeLink: web3.utils.toWei('0.0001', 'ether'),
    usdcToken: '0xe11A86849d99F524cAC3E7A0Ec1241828e332C62',
  }
}

module.exports = async function(deployer, network) {
  console.log("network: " + network);
  if (network == 'develop') {
    await deployer.deploy(TestRandomnessProvider);
    await deployer.deploy(BernoulliGameNative, TestRandomnessProvider.address);
    await deployer.deploy(BernoulliGameSigmaSquared, TestRandomnessProvider.address, SigmaSquared.address);
  } else if (network == 'polygon_mumbai') {
    await deployer.deploy(ChainlinkRandomnessProvider,
                          externalContractInfo.polygon_mumbai.vrfCoordinator,
                          externalContractInfo.polygon_mumbai.linkToken,
                          externalContractInfo.polygon_mumbai.vrfKeyHash,
                          externalContractInfo.polygon_mumbai.vrfFeeLink);
    await deployer.deploy(BernoulliGameNative, ChainlinkRandomnessProvider.address);
    await deployer.deploy(BernoulliGameSigmaSquared, ChainlinkRandomnessProvider.address, SigmaSquared.address);
    await deployer.deploy(BernoulliGameUSDC, ChainlinkRandomnessProvider.address, externalContractInfo.polygon_mumbai.usdcToken);

    // Add the Bernoulli Games as allowed randomness provider users, so they can request randomness.
    const rand = await ChainlinkRandomnessProvider.deployed();
    await rand.addAllowedUser(BernoulliGameNative.address);
    await rand.addAllowedUser(BernoulliGameSigmaSquared.address);
    await rand.addAllowedUser(BernoulliGameUSDC.address);

    // Set initial largest loss mantissa.
    const sigmaGame = await BernoulliGameSigmaSquared.deployed();
    const nativeGame = await BernoulliGameNative.deployed();
    const usdcGame = await BernoulliGameUSDC.deployed();
    await sigmaGame.setMaxLossMantissa(2e7); // 20%
    await nativeGame.setMaxLossMantissa(2e7); // 20%
    await usdcGame.setMaxLossMantissa(2e7); // 20%
  }
};
