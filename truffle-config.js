const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');
const mnemonic = fs.readFileSync(".secret").toString().trim();

module.exports = {
  // Uncommenting the defaults below 
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!
  //
  networks: {
   develop: {
     host: "127.0.0.1",
     port: 8545,
     network_id: "*"
   },
   polygon_mumbai: {
    provider: () => new HDWalletProvider(mnemonic, `https://polygon-mumbai.g.alchemy.com/v2/n56fHIjLa8Pofpf3-FoiDZatKEm0DxJV`),
    network_id: 80001,
    confirmations: 2,
    timeoutBlocks: 200,
    skipDryRun: false
  },
  },
  //
  // Truffle DB is currently disabled by default; to enable it, change enabled:
  // false to enabled: true. The default storage location can also be
  // overridden by specifying the adapter settings, as shown in the commented code below.
  //
  // NOTE: It is not possible to migrate your contracts to truffle DB and you should
  // make a backup of your artifacts to a safe location before enabling this feature.
  //
  // After you backed up your artifacts you can utilize db by running migrate as follows: 
  // $ truffle migrate --reset --compile-all
  //
  // db: {
    // enabled: false,
    // host: "127.0.0.1",
    // adapter: {
    //   name: "sqlite",
    //   settings: {
    //     directory: ".db"
    //   }
    // }
  // }
  compilers: {
    solc: {
      version: "^0.8.0",
      settings: {
        optimizer: {
          enabled: true,
          runs: 10
        }
      }
    }
  },
  plugins: [
    'truffle-flatten'
  ]
};
