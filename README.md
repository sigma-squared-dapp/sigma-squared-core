# Overview

Sigma Squared is an open-source, decentralized gambling protocol, built on top of the Polygon blockchain.  It was created with the goal of providing a truly decentralized gambling solution, where the players are the house. It is non-custodial and anyone with a Polygon wallet can play.  Randomness and fairness in games is ensured using Chainlink’s verifiable random functions.

Players can place bets with 0% house edge using SIGMA2 tokens, or place bets with a small house edge using other tokens.  All game contracts and treasury are owned by a DAO controlled by SIGMA2 token holders.  Any house profit accumulated is owned by SIGMA2 token holders.

Read the Whitepaper and other documentation to learn more.

This repository contains all the core Smart Contract code that is deployed on the Polygon blockchain.

# Setup

The Truffle framework is used for testing and deployment.  To get started install Truffle and setup dependencies for the project.

``$npm -g install truffle``

``$npm install``

``$truffle compile``

See the [Truffle documentation](https://trufflesuite.com/docs/truffle/) for more information on available Truffle commands.

For testing it is recommended to use a local Ganache blockchain.

``$npm -g install ganache``

``$ganache``

Make sure the truffle-config file points to the correct ip/port Ganache is running on.

From there you can deploy the contracts and run tests against deployed contracts.

Example:

``$truffle migrate --network develop``

``$truffle test --network develop``

# Contributions

Any contributions are welcome! See ``CONTRIBUTING.md`` for more information.