const { assert, expect } = require('chai');
const truffleAssert = require('truffle-assertions');

const BernoulliGame = artifacts.require("BernoulliGameNative");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");

const MANTISSA_MULTPLIER = 1e8;

contract('Bernoulli Game Advanced', (accounts) => {

  it('Bernoulli risk', async () => {
    const game = await BernoulliGame.deployed();
    const randProvider = await TestRandomnessProvider.deployed();

    await game.sendTransaction({from: accounts[0], value: web3.utils.toWei('5', 'ether')});
    await game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER, {from: accounts[0]});

    // Test min bet.
    await game.setMinBet(web3.utils.toWei('1', 'ether'), {from: accounts[0]});
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('0.9', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('0.9', 'ether')}));
    await game.setMinBet(1, {from: accounts[0]});

    // Test insufficient contract funds.
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('5.1', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('5.1', 'ether')}));

    await game.sendTransaction({from: accounts[0], value: web3.utils.toWei('550', 'ether')});
    // Ensure bet can be placed after.
    var result = await game.placeBet(web3.utils.toWei('5', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('5', 'ether')});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    // Bet is lost.
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x80000000000000000000000000000000'), {from: accounts[1]});
    let gameBalance = await web3.eth.getBalance(game.address);
    assert.equal(gameBalance, web3.utils.toWei('560', 'ether'), '560 ether should be in the game contract at this point.');

    var totalAtRisk = web3.utils.toBN(await game.getTotalAtRisk());
    expect(totalAtRisk.eq(web3.utils.toBN(0))).to.be.true;

    // Test insufficient bettor funds.
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('500', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('500', 'ether')}));

    // Test bet possible win is above set limit.
    var totalAtRisk = web3.utils.toBN(await game.getTotalAtRisk());
    expect(totalAtRisk.eq(web3.utils.toBN(0))).to.be.true;
    await game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER / 10, {from:accounts[0]});
    // Current balance of game is 560. The bet could win +57 which is greater than 560*0.1=59 so this is not allowed.
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('57', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('57', 'ether')}));
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('29', 'ether'), 3 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('29', 'ether')}));
    // A bet of 29 should be allowed (following similar reasoning).
    var result = await game.placeBet(web3.utils.toWei('56', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('56', 'ether')});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;

    // Send randomness to clear all current bets.
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x7fffffffffffffffffffffffffffffff'), {from: accounts[1]});

  });

  it('Bernoulli integer edge cases', async() => {
    const game = await BernoulliGame.deployed();
    const randProvider = await TestRandomnessProvider.deployed();

    await game.sendTransaction({from: accounts[0], value: web3.utils.toWei('5', 'ether')});
    await game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER, {from:accounts[0]});

    assert.equal(await game.getNumActiveBets(), 0);

    // Test smallest possible bet.
    var startBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    var result = await game.placeBet(1, 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: 1});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
    var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x7fffffffffffffffffffffffffffffff'), {from: accounts[1]});
    var endBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    expect(endBalance.eq(startBalance.add(web3.utils.toBN(1)).sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;
    // smallest bet with a multiplier less than two should result in receiving nothing when winning, because of
    // integer rounding.
    assert.equal(await game.getNumActiveBets(), 0);
    var startBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    var result = await game.placeBet(1, 19 * 1e7, {from: accounts[0], value: 1});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
    var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x7fffffffffffffffffffffffffffffff'), {from: accounts[1]});
    var endBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    expect(endBalance.eq(startBalance.sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;

    // Test possible win amount overflow / max possible multiplier.
    await truffleAssert.fails(game.placeBet(web3.utils.toWei('100', 'ether'), web3.utils.toBN(2).pow(web3.utils.toBN(256)).sub(web3.utils.toBN(1)), {from: accounts[0], value: web3.utils.toWei('100', 'ether')}));

    
  });

  it('Bernoulli non-zero house edge', async() => {
    const game = await BernoulliGame.deployed();
    const randProvider = await TestRandomnessProvider.deployed();

    await game.sendTransaction({from: accounts[0], value: web3.utils.toWei('5', 'ether')});
    await game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER, {from:accounts[0]});

    // Test bets when there is some positive house edge.
    await game.setHouseEdge(5e7, {from: accounts[0]});  // Set's the house edge to 50%.
    // With a multiplier of 2x, there should be a 25% chance of winning.

    // Test loss.
    var startBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    var result = await game.placeBet(1, 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: 1});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
    var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x40000000000000000000000000000000'), {from: accounts[1]});
    var endBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    expect(endBalance.eq(startBalance.sub(web3.utils.toBN(1)).sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;

    // Test win.
    var startBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    var result = await game.placeBet(1, 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: 1});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
    var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x3fffffffffffffffffffffffffffffff'), {from: accounts[1]});
    var endBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    expect(endBalance.eq(startBalance.add(web3.utils.toBN(1)).sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;


    await game.setHouseEdge(25e6, {from: accounts[0]});  // Set's the house edge to 25%.
    // With a multiplier of 5x, there should be a 15% chance of winning.

    // Test loss.
    var startBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    var result = await game.placeBet(1, 5 * MANTISSA_MULTPLIER, {from: accounts[0], value: 1});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
    var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]});
    var endBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    expect(endBalance.eq(startBalance.sub(web3.utils.toBN(1)).sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;

    // Test win.
    var startBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    var result = await game.placeBet(1, 5 * MANTISSA_MULTPLIER, {from: accounts[0], value: 1});
    var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    var effectiveGasPrice = web3.utils.toBN(result.receipt.effectiveGasPrice);
    var gasUsed = web3.utils.toBN(result.receipt.cumulativeGasUsed);
    await randProvider.sendRandomness(requestId, web3.utils.toBN('0x26666666666666666666666666666665'), {from: accounts[1]});
    var endBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    expect(endBalance.eq(startBalance.add(web3.utils.toBN(4)).sub(effectiveGasPrice.mul(gasUsed)))).to.be.true;

    // Ensure house edge can't be set greater than 1.
    await truffleAssert.fails(game.setHouseEdge(11e7, {from: accounts[0]}));
    // Ensure that house edge of 1 (100%) is valid though.
    await game.setHouseEdge(1e8, {from: accounts[0]});
    
    await game.setHouseEdge(0, {from: accounts[0]});
  });

  it('Bernoulli multiple bets', async() => {
    const game = await BernoulliGame.deployed();
    const randProvider = await TestRandomnessProvider.deployed();

    await game.sendTransaction({from: accounts[0], value: web3.utils.toWei('5', 'ether')});
    await game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER, {from:accounts[0]});

    // Test betting multiple times before randomness is provided.
    // Randomness should be requested after first bet is placed.
    assert.equal(await game.getNumActiveBets(), 0);
    var result = await game.placeBet(web3.utils.toWei('0.1', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('0.1', 'ether')});
    var requestId1 = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    assert.equal(await game.getNumActiveBets(), 1);
    var result = await game.placeBet(web3.utils.toWei('0.1', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('0.1', 'ether')});
    var requestId2 = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    assert.equal(await game.getNumActiveBets(), 2);
    var result = await game.placeBet(web3.utils.toWei('0.1', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('0.1', 'ether')});
    var requestId3 = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    assert.equal(await game.getNumActiveBets(), 3);
    var result = await game.placeBet(web3.utils.toWei('0.1', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('0.1', 'ether')});
    var requestId4 = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    assert.equal(await game.getNumActiveBets(), 4);
    var result = await game.placeBet(web3.utils.toWei('0.1', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('0.1', 'ether')});
    var requestId5 = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    assert.equal(await game.getNumActiveBets(), 5);
    var result = await game.placeBet(web3.utils.toWei('0.1', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('0.1', 'ether')});
    var requestId6 = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
    assert.equal(await game.getNumActiveBets(), 6);
    
    // Each bet should be settled as soon as the randomness provider returns a result for the given request ID.
    await randProvider.sendRandomness(requestId6, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]});
    assert.equal(await game.getNumActiveBets(), 5);
    await randProvider.sendRandomness(requestId5, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]});
    assert.equal(await game.getNumActiveBets(), 4);
    await randProvider.sendRandomness(requestId4, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]});
    assert.equal(await game.getNumActiveBets(), 3);
    await randProvider.sendRandomness(requestId3, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]});
    assert.equal(await game.getNumActiveBets(), 2);
    await randProvider.sendRandomness(requestId2, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]});
    assert.equal(await game.getNumActiveBets(), 1);

    // The same bet shouldn't bet settled more than once.
    await truffleAssert.fails(randProvider.sendRandomness(requestId2, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]}));
    assert.equal(await game.getNumActiveBets(), 1);
    await truffleAssert.fails(randProvider.sendRandomness(requestId6, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]}));
    assert.equal(await game.getNumActiveBets(), 1);

    // Settle last bet.
    await randProvider.sendRandomness(requestId1, web3.utils.toBN('0x26666666666666666666666666666666'), {from: accounts[1]});
    assert.equal(await game.getNumActiveBets(), 0);
  });

  it('Bernoulli security basic', async() => {
    const game = await BernoulliGame.deployed();

    // Test invalid randomness provider.
    await truffleAssert.fails(game.receiveRandomInt(1,{from: accounts[0]}));

    // Test non-owner setting randomness provider or max loss percentage.
    await truffleAssert.fails(game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER, {from: accounts[1]}));
    await truffleAssert.fails(game.setRandomnessProvider(accounts[2], {from: accounts[1]}));
    // Ensure owner is allowed to modify randomness provider.
    await game.setRandomnessProvider(accounts[2], {from: accounts[0]});

    // Test non-owner setting the house edge.
    await truffleAssert.fails(game.setHouseEdge(1e7, {from: accounts[1]}));

    // Test non-owner setting min bet.
    await truffleAssert.fails(game.setMinBet(1, {from: accounts[1]}));
  });
});
