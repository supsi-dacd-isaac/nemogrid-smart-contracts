var SafeMath = artifacts.require('../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol');
var NGT = artifacts.require('./NGT.sol');
var GroupsManager = artifacts.require('./GroupsManager.sol');

module.exports = function (deployer, network, accounts) {

    deployer.deploy(SafeMath);
    deployer.link(SafeMath, GroupsManager);
    deployer.deploy(GroupsManager, NGT.address);
};
