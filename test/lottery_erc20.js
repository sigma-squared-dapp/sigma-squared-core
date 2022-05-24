const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

const Lottery = artifacts.require("LotterySigmaSquared");
const SigmaSquared = artifacts.require("SigmaSquared");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");

const ZERO_BN = web3.utils.toBN(0);

contract('Lottery ERC20', (accounts) => {

  it('Lottery erc20 basic', async () => {
    const lottery = await Lottery.deployed();
    const randProvider = await TestRandomnessProvider.deployed();
    var sigma = await SigmaSquared.deployed();

    const currentRoundPool = async () => {
      return await lottery.getCurrentRoundPool();
    };

    const triggerRoundEnd = async (account) => {
      var result = await lottery.triggerRoundEnd({ from: account });
      return result.logs.find((e) => e.event === 'RoundEndTriggered').args.requestId;
    };

    const lotteryBalance = async () => {
      return web3.utils.toBN(await sigma.balanceOf(lottery.address));
    };

    const accountBalance = async (account) => {
      return web3.utils.toBN(await sigma.balanceOf(account));
    };
    

    await sigma.mint(accounts[0], 1000);
    await sigma.approve(lottery.address, 1000, { from: accounts[0] });
    await sigma.mint(accounts[1], 1000);
    await sigma.approve(lottery.address, 1000, { from: accounts[1] });

    var startBlock = await lottery.getCurrentRoundStart();
    var endBlock = await lottery.getCurrentRoundEnd();
    var roundLength = await lottery.getRoundMinLength();
    expect(endBlock.sub(startBlock).eq(roundLength)).to.be.true;

    // Have two people enter, first player wins.
    expect((await currentRoundPool()).eq(ZERO_BN)).to.be.true;
    await lottery.deposit(1, { from: accounts[0] });
    expect((await currentRoundPool()).eq(web3.utils.toBN(1))).to.be.true;
    await lottery.deposit(1, { from: accounts[1] });
    expect((await currentRoundPool()).eq(web3.utils.toBN(2))).to.be.true;
    expect(web3.utils.toBN(1).eq(await lottery.getEntrantsCurrentDeposit(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(1).eq(await lottery.getEntrantsCurrentDeposit(accounts[1]))).to.be.true;

    var startAccount0Balance = await accountBalance(accounts[0]);
    var requestId = await triggerRoundEnd(accounts[1]);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc'), { from: accounts[5] });
    var endAccount0Balance = await accountBalance(accounts[0]);
    expect((await lotteryBalance()).eq(ZERO_BN)).to.be.true;
    expect(endAccount0Balance.sub(startAccount0Balance).eq(web3.utils.toBN(2))).to.be.true;
    expect((await currentRoundPool()).eq(ZERO_BN)).to.be.true;

    // Two people enter, second player wins.
    await lottery.deposit(1, { from: accounts[0] });
    await lottery.deposit(1, { from: accounts[1] });
    expect((await currentRoundPool()).eq(web3.utils.toBN(2))).to.be.true;
    expect(web3.utils.toBN(1).eq(await lottery.getEntrantsCurrentDeposit(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(1).eq(await lottery.getEntrantsCurrentDeposit(accounts[1]))).to.be.true;
    var requestId = await triggerRoundEnd(accounts[0]);
    var startAccount1Balance = await accountBalance(accounts[1]);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd'), { from: accounts[5] });
    var endAccount1Balance = await accountBalance(accounts[1]);
    expect((await lotteryBalance()).eq(ZERO_BN)).to.be.true;
    expect(endAccount1Balance.sub(startAccount1Balance).eq(web3.utils.toBN(2))).to.be.true;
    expect((await currentRoundPool()).eq(ZERO_BN)).to.be.true;
  });
});
