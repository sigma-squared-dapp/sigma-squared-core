const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

const Lottery = artifacts.require("LotteryNative");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");

const ZERO_BN = web3.utils.toBN(0);

contract('Lottery Native', (accounts) => {

  it('Lottery native basic', async () => {
    const lottery = await Lottery.deployed();
    const randProvider = await TestRandomnessProvider.deployed();

    const currentRoundPool = async () => {
      return await lottery.getCurrentRoundPool();
    };

    const triggerRoundEnd = async (account) => {
      var result = await lottery.triggerRoundEnd({ from: account });
      return result.logs.find((e) => e.event === 'RoundEndTriggered').args.requestId;
    };

    const lotteryBalance = async () => {
      return web3.utils.toBN(await web3.eth.getBalance(lottery.address));
    };

    const accountBalance = async (account) => {
      return web3.utils.toBN(await web3.eth.getBalance(account));
    };
        

    var startBlock = await lottery.getCurrentRoundStart();
    var endBlock = await lottery.getCurrentRoundEnd();
    var roundLength = await lottery.getRoundMinLength();
    expect(endBlock.sub(startBlock).eq(roundLength)).to.be.true;
    expect(web3.utils.toBN(0).eq(await lottery.getEntrantsCurrentDeposit(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await lottery.getEntrantsCurrentDeposit(accounts[1]))).to.be.true;    

    // Have two people enter, first player wins.
    expect((await currentRoundPool()).eq(ZERO_BN)).to.be.true;
    await lottery.deposit(1, { from: accounts[0], value: 1 });
    expect((await currentRoundPool()).eq(web3.utils.toBN(1))).to.be.true;
    await lottery.deposit(1, { from: accounts[1], value: 1 });
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
    await lottery.deposit(1, { from: accounts[0], value: 1 });
    await lottery.deposit(1, { from: accounts[1], value: 1 });
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


    // Test 2^256 not divisible by total pool amount.
    await lottery.deposit(20000, { from: accounts[0], value: 20000 });
    await lottery.deposit(20000, { from: accounts[1], value: 20000 });
    await lottery.deposit(1, { from: accounts[2], value: 1 });
    await lottery.deposit(10000, { from: accounts[1], value: 10000 });
    // Test account 2 wins.
    var requestId = await triggerRoundEnd(accounts[0]);
    var startAccountBalance = await accountBalance(accounts[2]);
    await randProvider.sendRandomness(requestId, web3.utils.toBN(50000), { from: accounts[4] });
    var endAccountBalance = await accountBalance(accounts[2]);
    expect((await lotteryBalance()).eq(ZERO_BN)).to.be.true;
    expect(endAccountBalance.sub(startAccountBalance).eq(web3.utils.toBN(50001))).to.be.true;
    // Test account 1 wins.
    await lottery.deposit(20000, { from: accounts[0], value: 20000 });
    await lottery.deposit(30000, { from: accounts[1], value: 30000 });
    await lottery.deposit(1, { from: accounts[2], value: 1 });
    var requestId = await triggerRoundEnd(accounts[0]);
    var startAccountBalance = await accountBalance(accounts[1]);
    await randProvider.sendRandomness(requestId, web3.utils.toBN(20000), { from: accounts[4] });
    var endAccountBalance = await accountBalance(accounts[1]);
    expect((await lotteryBalance()).eq(ZERO_BN)).to.be.true;
    expect(endAccountBalance.sub(startAccountBalance).eq(web3.utils.toBN(50001))).to.be.true;
    // Test account 0 wins.
    await lottery.deposit(20000, { from: accounts[0], value: 20000 });
    await lottery.deposit(30000, { from: accounts[1], value: 30000 });
    await lottery.deposit(1, { from: accounts[2], value: 1 });
    var requestId = await triggerRoundEnd(accounts[0]);
    var startAccountBalance = await accountBalance(accounts[0]);
    await randProvider.sendRandomness(requestId, web3.utils.toBN(0), { from: accounts[4] });
    var endAccountBalance = await accountBalance(accounts[0]);
    expect((await lotteryBalance()).eq(ZERO_BN)).to.be.true;
    expect(endAccountBalance.sub(startAccountBalance).eq(web3.utils.toBN(50001))).to.be.true;

    // Test rand int ouside of valid sample space (redraw case).
    await lottery.deposit(20000, { from: accounts[0], value: 20000 });
    await lottery.deposit(10000, { from: accounts[1], value: 10000 });
    await lottery.deposit(1, { from: accounts[2], value: 1 });
    await lottery.deposit(20000, { from: accounts[1], value: 20000 });
    var requestId = await triggerRoundEnd(accounts[0]);
    var startAccountBalance = await accountBalance(accounts[1]);
    // Send randomness that is just outside of the valid sample space.
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd269'), { from: accounts[5] });
    // The keccak256 hash of '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd269'
    // is '0x3089cca0f97cc379432784458dd35cb872b0224bcadeccafbe2513feeee56f71' (the redraw) which when modded with
    // 50001 is 20604.  This means account 1 should win.
    var endAccountBalance = await accountBalance(accounts[1]);
    expect((await lotteryBalance()).eq(ZERO_BN)).to.be.true;
    expect(endAccountBalance.sub(startAccountBalance).eq(web3.utils.toBN(50001))).to.be.true;

    // Test rand int right on the inside of the valid sample space (no redraw).
    await lottery.deposit(20000, { from: accounts[0], value: 20000 });
    await lottery.deposit(30000, { from: accounts[1], value: 30000 });
    await lottery.deposit(1, { from: accounts[2], value: 1 });
    var requestId = await triggerRoundEnd(accounts[0]);
    var startAccountBalance = await accountBalance(accounts[2]);
    // Send randomness that is just outside of the sample space.
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd268'), { from: accounts[5] });
    // The int '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd268' is right on the edge of the valid sample space.
    // This int mod 50001 is 50000, whic meaans account 2 wins.
    var endAccountBalance = await accountBalance(accounts[2]);
    expect((await lotteryBalance()).eq(ZERO_BN)).to.be.true;
    expect(endAccountBalance.sub(startAccountBalance).eq(web3.utils.toBN(50001))).to.be.true;

    expect((await lottery.getTotalContractProfit()).eq(web3.utils.toBN(0)));
  });

  it('Lottery native non-zero house edge', async () => {
    const lottery = await Lottery.deployed();
    const randProvider = await TestRandomnessProvider.deployed();

    const triggerRoundEnd = async (account) => {
      var result = await lottery.triggerRoundEnd({ from: account });
      return result.logs.find((e) => e.event === 'RoundEndTriggered').args.requestId;
    };

    await lottery.setHouseEdge(5e6);  // 5% house edge
    await lottery.deposit(1000, { from: accounts[0], value: 1000 });
    expect((await lottery.getCurrentRoundPool()).eq(web3.utils.toBN(950)));
    var requestId = await triggerRoundEnd(accounts[0]);
    await randProvider.sendRandomness(requestId, web3.utils.toBN(2));
    expect((await lottery.getCurrentRoundPool()).eq(web3.utils.toBN(0)));
    expect((await lottery.getTotalContractProfit()).eq(web3.utils.toBN(50)));
    expect(web3.utils.toBN(await web3.eth.getBalance(lottery.address)).eq(web3.utils.toBN(50)));

    await lottery.setHouseEdge(4e6);  // 4% house edge
    await lottery.deposit(1000, { from: accounts[0], value: 1000 });
    expect((await lottery.getCurrentRoundPool()).eq(web3.utils.toBN(960)));
    var requestId = await triggerRoundEnd(accounts[0]);
    await randProvider.sendRandomness(requestId, web3.utils.toBN(2));
    expect((await lottery.getCurrentRoundPool()).eq(web3.utils.toBN(0)));
    expect((await lottery.getTotalContractProfit()).eq(web3.utils.toBN(110)));
    expect(web3.utils.toBN(await web3.eth.getBalance(lottery.address)).eq(web3.utils.toBN(100)));
    
  });

  it('Lottery native risk basic', async () => {
    const lottery = await Lottery.deployed();

    await lottery.deposit(1000, { from: accounts[0], value: 1000 });
    var result = await lottery.triggerRoundEnd();
    var requestId = result.logs.find((e) => e.event === 'RoundEndTriggered').args.requestId;

    // Test invalid randomness provider.
    await truffleAssert.fails(lottery.receiveRandomInt(requestId, web3.utils.toBN(1), { from: accounts[0] }));

    // Test non-owner setting house edge.
    await truffleAssert.fails(lottery.setHouseEdge(1e7, { from: accounts[1] }));

    // Test non-owner trying to withdraw.
    await truffleAssert.fails(lottery.withdraw(1, { from: accounts[1] }));
  });
});
