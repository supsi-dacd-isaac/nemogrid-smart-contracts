module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  networks: {
    "development": {
      host: "localhost",
      port: 7545,
      gas: 4700000,
      gasPrice: 65000000000,
      network_id: "*"
    },
    "ropsten": {
      host: "localhost",
      port: 8545,
      gas: 4700000,
      gasPrice: 65000000000,
      network_id: 3,
    }
  }
}

