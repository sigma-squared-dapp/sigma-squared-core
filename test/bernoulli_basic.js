const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

const BernoulliGame = artifacts.require("BernoulliGameNative");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");
const mantissaMultiplier = 1e8;
const maxUint128 = web3.utils.toBN(2).pow(web3.utils.toBN(128));

contract('Bernoulli Game Basic', (accounts) => {
  

  it('Bernoulli basic', async () => {
    const testSingleBet = async (gameContract, randProviderContract, accountAddress, betAmountInWei, multiplierMantissa) => {
      // Test loss.
      assert.equal(await gameContract.getNumActiveBets(), 0);
      var totalAtRisk = web3.utils.toBN(await gameContract.getTotalAtRisk());
      expect(totalAtRisk.eq(web3.utils.toBN(0))).to.be.true;
      var startBalance = web3.utils.toBN(await web3.eth.getBalance(accountAddress));
      var gameStartBalance = web3.utils.toBN(await web3.eth.getBalance(gameContract.address));
      var result = await gameContract.placeBet(web3.utils.toBN(betAmountInWei), web3.utils.toBN(multiplierMantissa), {from: accountAddress, value: betAmountInWei});
      var requestId = result.logs[1].args.requestId;
      // Check balances before bet is settled.
      var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
      var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
      var intermittentBalance = web3.utils.toBN(await web3.eth.getBalance(accountAddress));
      var gameIntermittentBalance = web3.utils.toBN(await web3.eth.getBalance(gameContract.address));
      expect(intermittentBalance.eq(startBalance.sub(effectiveGasPrice.mul(gasUsed)).sub(web3.utils.toBN(betAmountInWei)))).to.be.true;
      expect(gameIntermittentBalance.eq(gameStartBalance.add(web3.utils.toBN(betAmountInWei)))).to.be.true;
      assert.equal(await gameContract.getNumActiveBets(), 1);
      var totalAtRisk = web3.utils.toBN(await gameContract.getTotalAtRisk());
      expect(totalAtRisk.eq(web3.utils.toBN(betAmountInWei).mul(web3.utils.toBN(multiplierMantissa)).div(web3.utils.toBN(mantissaMultiplier)))).to.be.true;

      let randIntForLoss = maxUint128.mul(web3.utils.toBN(mantissaMultiplier)).div(web3.utils.toBN(multiplierMantissa));
      var result = await randProviderContract.sendRandomness(requestId, randIntForLoss, {from: accountAddress});
      var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
      var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
      var endBalance = web3.utils.toBN(await web3.eth.getBalance(accountAddress));
      var gameEndBalance = web3.utils.toBN(await web3.eth.getBalance(gameContract.address));
      expect(gameEndBalance.eq(gameIntermittentBalance)).to.be.true;
      expect(endBalance.eq(intermittentBalance.sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;
      assert.equal(await gameContract.getNumActiveBets(), 0);
      var totalAtRisk = web3.utils.toBN(await gameContract.getTotalAtRisk());
      expect(totalAtRisk.eq(web3.utils.toBN(0))).to.be.true;
    
      // Test win.
      var startBalance = web3.utils.toBN(await web3.eth.getBalance(accountAddress));
      var gameStartBalance = web3.utils.toBN(await web3.eth.getBalance(gameContract.address));
      var result = await gameContract.placeBet(betAmountInWei, web3.utils.toBN(multiplierMantissa), {from: accountAddress, value: betAmountInWei});
      var requestId = result.logs[1].args.requestId;
      // Check balances before bet is settled.
      var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
      var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
      var intermittentBalance = web3.utils.toBN(await web3.eth.getBalance(accountAddress));
      var gameIntermittentBalance = web3.utils.toBN(await web3.eth.getBalance(gameContract.address));
      expect(intermittentBalance.eq(startBalance.sub(effectiveGasPrice.mul(gasUsed)).sub(web3.utils.toBN(betAmountInWei)))).to.be.true;
      expect(gameIntermittentBalance.eq(gameStartBalance.add(web3.utils.toBN(betAmountInWei)))).to.be.true;
      assert.equal(await gameContract.getNumActiveBets(), 1);
      var totalAtRisk = web3.utils.toBN(await gameContract.getTotalAtRisk());
      expect(totalAtRisk.eq(web3.utils.toBN(betAmountInWei).mul(web3.utils.toBN(multiplierMantissa)).div(web3.utils.toBN(mantissaMultiplier)))).to.be.true;

      let rantIntForWin = randIntForLoss.sub(web3.utils.toBN(1));
      var result = await randProviderContract.sendRandomness(requestId, rantIntForWin, {from: accountAddress});
      var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
      var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
      var endBalance = web3.utils.toBN(await web3.eth.getBalance(accountAddress));
      var gameEndBalance = web3.utils.toBN(await web3.eth.getBalance(gameContract.address));
      expect(gameEndBalance.eq(gameIntermittentBalance.sub(web3.utils.toBN(betAmountInWei).mul(web3.utils.toBN(multiplierMantissa)).div(web3.utils.toBN(mantissaMultiplier))))).to.be.true;
      expect(endBalance.eq(intermittentBalance.add(web3.utils.toBN(betAmountInWei).mul(web3.utils.toBN(multiplierMantissa)).div(web3.utils.toBN(mantissaMultiplier))).sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;
      assert.equal(await gameContract.getNumActiveBets(), 0);
      var totalAtRisk = web3.utils.toBN(await gameContract.getTotalAtRisk());
      expect(totalAtRisk.eq(web3.utils.toBN(0))).to.be.true;
    };

    const game = await BernoulliGame.deployed();
    const randProvider = await TestRandomnessProvider.deployed();

    // Transfer ethereum to game contract.
    await game.sendTransaction({from: accounts[0], value: web3.utils.toWei('50', 'ether')});
    balance = await web3.eth.getBalance(game.address);
    assert.equal(balance, web3.utils.toWei('50', 'ether'), "50 ether wasn't in the contract");

    // Set max loss percentage for the game.
    await game.setMaxLossMantissa(1 * mantissaMultiplier, {from:accounts[0]});
    
    // Test placing single bets with different amounts and multipliers.  The utility function tests both the win and loss case.
    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('2', 'ether'), 2 * mantissaMultiplier);
    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('1', 'ether'), 3 * mantissaMultiplier);
    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('2', 'ether'), 7 * mantissaMultiplier);
    const totalVolume = await game.getTotalVolume();
    expect(web3.utils.toBN(web3.utils.toWei('10', 'ether')).eq(totalVolume)).to.be.true;
    
    // Check total contract profit.
    var totalContractProfit = web3.utils.toBN(await game.getTotalContractProfit());
    expect(totalContractProfit.eq(web3.utils.toBN(web3.utils.toWei('-11', 'ether')))).to.be.true;
    var contractBalance = web3.utils.toBN(await web3.eth.getBalance(game.address));
    expect(contractBalance.eq(web3.utils.toBN(web3.utils.toWei('39', 'ether')))).to.be.true;
    expect(contractBalance.eq(web3.utils.toBN(await game.getContractBalance())));

    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('0.01', 'ether'), 100 * mantissaMultiplier);
    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('0.01', 'ether'), 1000 * mantissaMultiplier);

    // Test multiplier that has a decimal.
    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('2', 'ether'), 11 * 1e7); // 1.1x
    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('2', 'ether'), 15 * 1e7); // 1.5x
    await testSingleBet(game, randProvider, accounts[0], web3.utils.toWei('2', 'ether'), 39 * 1e7); // 3.9x

    // Ensure that a multiplier less than or equal to 1 is not allowed.
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('1', 'ether'), 1 * mantissaMultiplier, {from: accounts[0], value: web3.utils.toWei('1', 'ether')}));
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('1', 'ether'), 09 * 1e7, {from: accounts[0], value: web3.utils.toWei('1', 'ether')}));

    // Test withdrawing game's funds.
    var contractBalance = web3.utils.toBN(await web3.eth.getBalance(game.address));
    expect(contractBalance.gt(web3.utils.toBN(0))).to.be.true;
    await game.withdraw(contractBalance, {from: accounts[0]});
    var contractBalance = web3.utils.toBN(await web3.eth.getBalance(game.address));
    expect(contractBalance.eq(web3.utils.toBN(0))).to.be.true;
  });
});
