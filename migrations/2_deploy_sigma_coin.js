const SigmaSquared = artifacts.require("SigmaSquared");

module.exports = async function(deployer) {
  await deployer.deploy(SigmaSquared);
};
