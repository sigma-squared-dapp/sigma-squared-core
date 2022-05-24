const { randomBytes } = require('crypto');

// Parameters for Monte Carlo simulations.
const numRuns = 1000;
const multiplierMantissa = 2e8;
const betAmount = web3.utils.toWei('1', 'ether');


const BernoulliGame = artifacts.require("BernoulliGameSigmaSquared");
const Sigma = artifacts.require("SigmaSquared");
const TestRandomnessProvider = artifacts.require("TestRandomnessProvider");


/* returns a random BN of size 256 */
const randGen = async () => { 
    const value = randomBytes(32);
    const bigInt = `0x${value.toString('hex')}`;
    const bn = web3.utils.toBN(bigInt);
    return bn;
}


contract('Monte Carlo', (accounts) => {
    it('Monte Carlo', async() => {
        const game = await BernoulliGame.deployed();
        const randProvider = await TestRandomnessProvider.deployed();
        const sigma = await Sigma.deployed();

        // Mint Sigma Squared tokens.
        await sigma.mint(accounts[0], web3.utils.toWei('2000000', 'ether'), {from: accounts[0]});
        console.log("Minted Sigma Squared tokens (2 million).");

        // Send Sigma Squared tokens to game contract.
        await sigma.transfer(game.address, web3.utils.toWei('1000000', 'ether'), {from: accounts[0]});
        console.log("Transfered 1 million Sigma Squared to the game contract.");
        var gameBalance = await sigma.balanceOf(game.address);
        var balance = await sigma.balanceOf(accounts[0]);
        console.log(`Game balance: ${gameBalance}`);
        console.log(`User balance: ${balance}`);

        // Set max loss percentage.
        await game.setMaxLossMantissa(1e8, {from: accounts[0]});
        console.log("Set max loss percentage to 100%.");

        await sigma.approve(game.address, web3.utils.toWei('1000000', 'ether'), {from: accounts[0]});
        console.log("Gave game contract an allowance of 1 million Sigma Squared (approve).");

        const startBalance = web3.utils.toBN(await sigma.balanceOf(accounts[0]));

        for (var i = 0; i < numRuns; ++i) {
            console.log(`Placing bet #${i}`);
            await game.placeBet(betAmount, web3.utils.toBN(multiplierMantissa), {from: accounts[0]});
            await randProvider.sendRandomness(await randGen(), {from: accounts[0]});
        }

        const endBalance = web3.utils.toBN(await sigma.balanceOf(accounts[0]));
        const avgWin = endBalance.sub(startBalance).div(web3.utils.toBN(numRuns));

        // Print out report.
        console.log(`Starting balance: ${startBalance.toString()}`);
        console.log(`End balance: ${endBalance.toString()}`);
        console.log(`Average win: ${avgWin.toString()}`);
    });
});