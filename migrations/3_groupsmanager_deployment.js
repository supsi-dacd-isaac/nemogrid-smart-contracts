var abi = require('ethereumjs-abi')

var SafeMath = artifacts.require('../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol');
var NGT = artifacts.require('./NGT.sol');
var GroupsManager = artifacts.require('./GroupsManager.sol');

module.exports = function (deployer, network, accounts) {

    deployer.deploy(SafeMath);
    deployer.link(SafeMath, GroupsManager);
    deployer.deploy(GroupsManager, NGT.address);

    var inputTypes = ["address"];
    var inputArgs = [NGT.address];
    var inputArgsEnc = abi.rawEncode(inputTypes, inputArgs);

    console.log('\tGroupsManager input args: ' + inputArgsEnc.toString('hex') + '\t');
};
