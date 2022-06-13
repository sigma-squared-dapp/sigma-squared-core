const { assert, expect } = require('chai');
const truffleAssert = require('truffle-assertions');

const BernoulliGameSigmaSquared = artifacts.require("BernoulliGameSigmaSquared");
const Sigma = artifacts.require("SigmaSquared");
const SigmaRewards = artifacts.require("SigmaSquaredLargestLossRewards");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");

const mantissaMultiplier = 1e8;
const maxUint128 = web3.utils.toBN(2).pow(web3.utils.toBN(128));

contract('Sigma Squared Rewards', (accounts) => {

  it('Sigma rewards basic', async () => {
    
    const triggerWin = async (gameContract, randProviderContract, accountAddress, betAmountInWei, multiplierMantissa) => {
        var result = await gameContract.placeBet(web3.utils.toBN(betAmountInWei), web3.utils.toBN(multiplierMantissa), {from: accountAddress});
        var requestId = result.logs[1].args.requestId;
        let randIntForWin = maxUint128.mul(web3.utils.toBN(mantissaMultiplier)).div(web3.utils.toBN(multiplierMantissa)).sub(web3.utils.toBN(1));
        var result = await randProviderContract.sendRandomness(requestId, randIntForWin, {from:accountAddress});
    };

    const triggerLoss = async(gameContract, randProviderContract, accountAddress, betAmountInWei, multiplierMantissa) => {
        var result = await gameContract.placeBet(web3.utils.toBN(betAmountInWei), web3.utils.toBN(multiplierMantissa), {from: accountAddress});
        var requestId = result.logs[1].args.requestId;
        let randIntForLoss = maxUint128.mul(web3.utils.toBN(mantissaMultiplier)).div(web3.utils.toBN(multiplierMantissa));
        var result = await randProviderContract.sendRandomness(requestId, randIntForLoss, {from:accountAddress});

    };

    const game = await BernoulliGameSigmaSquared.deployed();
    const randProvider = await TestRandomnessProvider.deployed();
    const sigma = await Sigma.deployed();
    const sigmaRewards = await SigmaRewards.deployed();

    const lifetimeDistributions = await sigmaRewards.getLifetimeRewards();
    expect(lifetimeDistributions.eq(web3.utils.toBN(web3.utils.toWei('100000', 'ether')))).to.be.true;

    // Mint Sigma Squared tokens.
    await sigma.mint(accounts[0], web3.utils.toWei('10000', 'ether'), {from: accounts[0]});
    await sigma.mint(accounts[1], web3.utils.toWei('10000', 'ether'), {from: accounts[0]});
    await sigma.mint(accounts[2], web3.utils.toWei('10000', 'ether'), {from: accounts[0]});
    await sigma.mint(accounts[3], web3.utils.toWei('10000', 'ether'), {from: accounts[0]});
    await sigma.mint(accounts[4], web3.utils.toWei('10000', 'ether'), {from: accounts[0]});
    await sigma.mint(game.address, web3.utils.toWei('10000', 'ether'), {from: accounts[0]});
    await sigma.mint(sigmaRewards.address, web3.utils.toWei('10000', 'ether'), {from: accounts[0]});

    // Check game rewards contract.
    assert.equal(sigmaRewards.address, await game.getGameRewards());

    // Approve allowance for game from all accounts.
    await sigma.approve(game.address, web3.utils.toWei('10000', 'ether'), {from: accounts[0]});
    await sigma.approve(game.address, web3.utils.toWei('10000', 'ether'), {from: accounts[1]});
    await sigma.approve(game.address, web3.utils.toWei('10000', 'ether'), {from: accounts[2]});
    await sigma.approve(game.address, web3.utils.toWei('10000', 'ether'), {from: accounts[3]});
    await sigma.approve(game.address, web3.utils.toWei('10000', 'ether'), {from: accounts[4]});

    // Set max loss percentage.
    await game.setMaxLossMantissa(1e8, {from: accounts[0]});

    // Ensure token distribution is weighted based on largest loss.
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[1]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[2]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[3]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[4]))).to.be.true;
    await triggerWin(game, randProvider, accounts[0], web3.utils.toWei('4', 'ether'), 2e8);
    await triggerLoss(game, randProvider, accounts[0], web3.utils.toWei('2', 'ether'), 3e8);
    await triggerLoss(game, randProvider, accounts[1], web3.utils.toWei('2', 'ether'), 3e8);
    await triggerLoss(game, randProvider, accounts[2], web3.utils.toWei('1', 'ether'), 3e8);
    await triggerLoss(game, randProvider, accounts[3], web3.utils.toWei('3', 'ether'), 2e8);
    await triggerWin(game, randProvider, accounts[3], web3.utils.toWei('5', 'ether'), 3e8);
    await triggerWin(game, randProvider, accounts[4], web3.utils.toWei('5', 'ether'), 3e8);
    // Largest loss at this point:
    // Account 0: 2 ... (2/8 = 25%)
    // Account 1: 2 ... (2/8 = 25%)
    // Account 2: 1 ... (1/8 = 12.5%)
    // Account 3: 3 ... (2/8 = 37.5%)
    // Account 4: 0 ... (2/8 = 0%)
    expect(web3.utils.toBN(web3.utils.toWei('2', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('2', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[1]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('1', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[2]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('3', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[3]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('0', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[4]))).to.be.true;

    // Get original block number
    var startBlock = await sigmaRewards.getCurrentRoundStart();

    // Ensure each account doesn't have any rewards initially.
    assert.equal(await sigmaRewards.calculateCurrentRewards(accounts[0]), 0);
    assert.equal(await sigmaRewards.calculateCurrentRewards(accounts[1]), 0);
    assert.equal(await sigmaRewards.calculateCurrentRewards(accounts[2]), 0);
    assert.equal(await sigmaRewards.calculateCurrentRewards(accounts[3]), 0);
    assert.equal(await sigmaRewards.calculateCurrentRewards(accounts[4]), 0);
    // Trigger round.
    await sigmaRewards.triggerRound();
    var endBlock = await sigmaRewards.getCurrentRoundStart();
    // Ensure each account has the expected rewards available.
    var expectedAmount = web3.utils.toBN(endBlock - startBlock).mul(web3.utils.toBN(web3.utils.toWei('10', 'ether')));
    var account0Rewards = await sigmaRewards.calculateCurrentRewards(accounts[0]);
    expect(account0Rewards.eq(expectedAmount.div(web3.utils.toBN(4)))).to.be.true;
    var account1Rewards = await sigmaRewards.calculateCurrentRewards(accounts[1]);
    expect(account1Rewards.eq(expectedAmount.div(web3.utils.toBN(4)))).to.be.true;
    var account2Rewards = await sigmaRewards.calculateCurrentRewards(accounts[2]);
    expect(account2Rewards.eq(expectedAmount.div(web3.utils.toBN(8)))).to.be.true;
    var account3Rewards = await sigmaRewards.calculateCurrentRewards(accounts[3]);
    expect(account3Rewards.eq(expectedAmount.mul(web3.utils.toBN(3)).div(web3.utils.toBN(8)))).to.be.true;
    var account4Rewards = await sigmaRewards.calculateCurrentRewards(accounts[4]);
    expect(account4Rewards.eq(web3.utils.toBN(0))).to.be.true;

    // Have some accounts claim rewards, while other do not.
    var startBalance = await sigma.balanceOf(accounts[0]);
    await sigmaRewards.claimRewards({from: accounts[0]});
    var endBalance = await sigma.balanceOf(accounts[0]);
    expect(endBalance.sub(startBalance).eq(account0Rewards)).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[0]))).to.be.true;
    var startBalance = await sigma.balanceOf(accounts[1]);
    await sigmaRewards.claimRewards({from: accounts[1]});
    var endBalance = await sigma.balanceOf(accounts[1]);
    expect(endBalance.sub(startBalance).eq(account1Rewards)).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[1]))).to.be.true;
    var startBalance = await sigma.balanceOf(accounts[4]);
    await sigmaRewards.claimRewards({from: accounts[4]});
    var endBalance = await sigma.balanceOf(accounts[4]);
    expect(endBalance.sub(startBalance).eq(account4Rewards)).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[4]))).to.be.true;

    // In the next round, ensure future rewards are added to current unclaimed rewards.
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[1]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[2]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[3]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[4]))).to.be.true;
    await triggerLoss(game, randProvider, accounts[0], web3.utils.toWei('2', 'ether'), 2e8);
    await triggerLoss(game, randProvider, accounts[0], web3.utils.toWei('1', 'ether'), 2e8);
    await triggerLoss(game, randProvider, accounts[2], web3.utils.toWei('1', 'ether'), 2e8);
    await triggerLoss(game, randProvider, accounts[3], web3.utils.toWei('2', 'ether'), 3e8);
    await triggerLoss(game, randProvider, accounts[4], web3.utils.toWei('2', 'ether'), 2e8);
    await triggerLoss(game, randProvider, accounts[4], web3.utils.toWei('4', 'ether'), 3e8);
    await triggerWin(game, randProvider, accounts[4], web3.utils.toWei('5', 'ether'), 4e8);
    // Largest loss for this round:
    // Account 0: 2 ... (2/9 = 22.2%)
    // Account 1: 0 ... (0/7 = 0%)
    // Account 2: 1 ... (1/9 = 11.1%)
    // Account 3: 2 ... (2/9 = 22.2%)
    // Account 4: 4 ... (4/9 = 44.4%)
    expect(web3.utils.toBN(web3.utils.toWei('2', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('0', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[1]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('1', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[2]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('2', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[3]))).to.be.true;
    expect(web3.utils.toBN(web3.utils.toWei('4', 'ether')).eq(await sigmaRewards.getBettorsCurrentLargestLoss(accounts[4]))).to.be.true;

    var startBlock = await sigmaRewards.getCurrentRoundStart();

    // Ensure each account doesn't have any rewards initially, other than those from previous rounds.
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[1]))).to.be.true;
    expect(account2Rewards.eq(await sigmaRewards.calculateCurrentRewards(accounts[2]))).to.be.true;
    expect(account3Rewards.eq(await sigmaRewards.calculateCurrentRewards(accounts[3]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[4]))).to.be.true;
    // Trigger round.
    await sigmaRewards.triggerRound();
    var endBlock = await sigmaRewards.getCurrentRoundStart();
    
    // Ensure each account has the expected rewards available.
    var expectedAmount = web3.utils.toBN(endBlock - startBlock).mul(web3.utils.toBN(web3.utils.toWei('10', 'ether')));
    var account0Rewards = await sigmaRewards.calculateCurrentRewards(accounts[0]);
    expect(account0Rewards.eq(expectedAmount.mul(web3.utils.toBN(2)).div(web3.utils.toBN(9)))).to.be.true;

    var account1Rewards = await sigmaRewards.calculateCurrentRewards(accounts[1]);
    expect(account1Rewards.eq(web3.utils.toBN(0))).to.be.true;

    var prevAccount2Rewards = account2Rewards;
    var account2Rewards = await sigmaRewards.calculateCurrentRewards(accounts[2]);
    expect(account2Rewards.eq(expectedAmount.mul(web3.utils.toBN(1)).div(web3.utils.toBN(9)).add(prevAccount2Rewards))).to.be.true;

    var prevAccount3Rewards = account3Rewards;
    var account3Rewards = await sigmaRewards.calculateCurrentRewards(accounts[3]);
    expect(account3Rewards.eq(expectedAmount.mul(web3.utils.toBN(2)).div(web3.utils.toBN(9)).add(prevAccount3Rewards))).to.be.true;

    var account4Rewards = await sigmaRewards.calculateCurrentRewards(accounts[4]);
    expect(account4Rewards.eq(expectedAmount.mul(web3.utils.toBN(4)).div(web3.utils.toBN(9)))).to.be.true;

    // Claim all rewards.
    var startBalance = await sigma.balanceOf(accounts[0]);
    await sigmaRewards.claimRewards({from: accounts[0]});
    var endBalance = await sigma.balanceOf(accounts[0]);
    expect(endBalance.sub(startBalance).eq(account0Rewards)).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[0]))).to.be.true;
    var startBalance = await sigma.balanceOf(accounts[1]);
    await sigmaRewards.claimRewards({from: accounts[1]});
    var endBalance = await sigma.balanceOf(accounts[1]);
    expect(endBalance.sub(startBalance).eq(account1Rewards)).to.be.true;
    var startBalance = await sigma.balanceOf(accounts[2]);
    await sigmaRewards.claimRewards({from: accounts[2]});
    var endBalance = await sigma.balanceOf(accounts[2]);
    expect(endBalance.sub(startBalance).eq(account2Rewards)).to.be.true;
    var startBalance = await sigma.balanceOf(accounts[3]);
    await sigmaRewards.claimRewards({from: accounts[3]});
    var endBalance = await sigma.balanceOf(accounts[3]);
    expect(endBalance.sub(startBalance).eq(account3Rewards)).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[1]))).to.be.true;
    var startBalance = await sigma.balanceOf(accounts[4]);
    await sigmaRewards.claimRewards({from: accounts[4]});
    var endBalance = await sigma.balanceOf(accounts[4]);
    expect(endBalance.sub(startBalance).eq(account4Rewards)).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[4]))).to.be.true;

    // Make sure there are no available rewards now.
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[0]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[1]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[2]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[3]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.calculateCurrentRewards(accounts[4]))).to.be.true;
    expect(web3.utils.toBN(0).eq(await sigmaRewards.getUnclaimedRewards())).to.be.true;

    expect(web3.utils.toBN(0).lt(await sigmaRewards.getTotalRewardsAllocated())).to.be.true;

  });

  it('Sigma rewards security', async () => {
    const game = await BernoulliGameSigmaSquared.deployed();
    const sigmaRewards = await SigmaRewards.deployed();

    assert.equal(await sigmaRewards.isGame(game.address), true);
    assert.equal(await sigmaRewards.isGame(accounts[0]), false);

    await truffleAssert.fails(sigmaRewards.recordLoss(accounts[0], 1, '0x0'));
    await truffleAssert.fails(sigmaRewards.recordWin(accounts[0], 1, 1, '0x0'));
  });
});