const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

const BernoulliGameSigmaSquared = artifacts.require("BernoulliGameSigmaSquared");
const Sigma = artifacts.require("SigmaSquared");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");

const MANTISSA_MULTPLIER = 1e8;

contract('Bernoulli ERC20 Game Basic', (accounts) => {
    it('Bernoulli ERC20 basic', async() => {
        const game = await BernoulliGameSigmaSquared.deployed();
        const randProvider = await TestRandomnessProvider.deployed();
        const sigma = await Sigma.deployed();
        
        // Mint Sigma Squared tokens.
        await sigma.mint(accounts[0], web3.utils.toWei('10000', 'ether'), {from: accounts[0]});

        // Send Sigma Squared tokens to game contract.
        await sigma.transfer(game.address, web3.utils.toWei('5', 'ether'), {from: accounts[0]});
        var gameBalance = await sigma.balanceOf(game.address);
        assert.equal(gameBalance, web3.utils.toWei('5', 'ether'));
        var balance = await sigma.balanceOf(accounts[0]);
        assert.equal(balance, web3.utils.toWei('9995', 'ether'));

        // Set max loss percentage.
        await game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER, {from: accounts[0]});

        await sigma.approve(game.address, web3.utils.toWei('9995', 'ether'), {from: accounts[0]});

        // Test win.
        var result = await game.placeBet(web3.utils.toBN(web3.utils.toWei('1', 'ether')), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('1', 'ether')});
        var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
        await randProvider.sendRandomness(requestId, web3.utils.toBN('0x7fffffffffffffffffffffffffffffff'), {from: accounts[0]});
        var balance = await sigma.balanceOf(accounts[0]);
        assert.equal(balance, web3.utils.toWei('9996', 'ether'));
        var gameBalance = await sigma.balanceOf(game.address);
        assert.equal(gameBalance, web3.utils.toWei('4', 'ether'));

        // Test loss.
        var result = await game.placeBet(web3.utils.toBN(web3.utils.toWei('1', 'ether')), 2 * MANTISSA_MULTPLIER, {from: accounts[0], value: web3.utils.toWei('1', 'ether')});
        var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;
        await randProvider.sendRandomness(requestId, web3.utils.toBN('0x80000000000000000000000000000000'), {from: accounts[0]});
        var balance = await sigma.balanceOf(accounts[0]);
        assert.equal(balance, web3.utils.toWei('9995', 'ether'));
        var gameBalance = await sigma.balanceOf(game.address);
        assert.equal(gameBalance, web3.utils.toWei('5', 'ether'));

        // Test withdrawing tokens.
        await game.withdraw(web3.utils.toWei('5', 'ether'), {from: accounts[0]});
        var balance = await sigma.balanceOf(accounts[0]);
        assert.equal(balance, web3.utils.toWei('10000', 'ether'));
        var gameBalance = await sigma.balanceOf(game.address);
        assert.equal(gameBalance, web3.utils.toWei('0', 'ether'));

    });

    it ('Bernoulli ERC20 risk', async () => {
        const game = await BernoulliGameSigmaSquared.deployed();
        const randProvider = await TestRandomnessProvider.deployed();
        const sigma = await Sigma.deployed();

        var gameBalance = await sigma.balanceOf(game.address);
        assert.equal(gameBalance, 0, '0 SIGMA2 should be in the game contract at this point.');

        // Mint Sigma Squared tokens.
        await sigma.mint(game.address, web3.utils.toWei('1000', 'ether'), {from: accounts[0]});
        await sigma.mint(accounts[0], web3.utils.toWei('1000', 'ether'), {from: accounts[0]});
        await sigma.approve(game.address, web3.utils.toWei('10000', 'ether'), {from: accounts[0]});

        // Set max loss percentage.
        await game.setMaxLossMantissa(1 * MANTISSA_MULTPLIER / 2, {from: accounts[0]});

        var gameBalance = await sigma.balanceOf(game.address);
        assert.equal(gameBalance, web3.utils.toWei('1000', 'ether'), '1000 SIGMA2 should be in the game contract at this point.');

        // Test bet when win is above limit.
        // Balance is 1000, so possible win can be greater than +500
        await truffleAssert.fails(game.placeBet(web3.utils.toWei('501', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0] }));
        await truffleAssert.fails(game.placeBet(web3.utils.toWei('251', 'ether'), 3 * MANTISSA_MULTPLIER, {from: accounts[0] }));
        // Ensure a bet under the limit is allowed.
        var result = await game.placeBet(web3.utils.toWei('500', 'ether'), 2 * MANTISSA_MULTPLIER, {from: accounts[0] });
        var requestId = result.logs.find((e) => e.event === 'BetAccepted').args.requestId;

        // Send randomness to clear all current bets.
        await randProvider.sendRandomness(requestId, web3.utils.toBN('0x7fffffffffffffffffffffffffffffff'), {from: accounts[1]});
    });
});