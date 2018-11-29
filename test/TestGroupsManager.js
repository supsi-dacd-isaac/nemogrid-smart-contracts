// Requirements

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const _ = require('lodash');
const EVMRevert = 'revert';

// Utilities functions

// Advances the block number so that the last mined block is `number`
function advanceBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: Date.now(),
    }, (err, res) => {
      return err ? reject(err) : resolve(res);
    });
  });
}

// Smart contracts
const MarketsManager = artifacts.require('MarketsManager');
const GroupsManager = artifacts.require('GroupsManager');
const NGT = artifacts.require('NGT');

// Markets contract
contract('GroupsManager', function([owner, dso, cheater]) {

    before(async function() {
        // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    // Create the Market and NGT objects
    beforeEach(async function() {
        this.timeout(600000);

        this.NGT = await NGT.new();

        this.groupsManager = await GroupsManager.new(this.NGT.address);
    });

    describe('Management tests:', function() {
        it('Check the smart contracts existence', async function() {
            this.groupsManager.should.exist;
            this.NGT.should.exist;
        });

        it('Add successfully a group of markets', async function() {
            await this.groupsManager.addGroup(dso, {from: owner});

            (await this.groupsManager.getFlag(dso)).should.be.true;
            (await this.groupsManager.getAddress(dso)).should.be.not.equal(0);
        });

        it('Try to open an already opened group', async function() {
            await this.groupsManager.addGroup(dso, {from: owner});

            await this.groupsManager.addGroup(dso, {from: owner}).should.be.rejectedWith(EVMRevert);
        });

        it('A cheater tries to open a group', async function() {
            await this.groupsManager.addGroup(dso, {from: cheater}).should.be.rejectedWith(EVMRevert);
        });

        it('The owner is trying to cheat, opening a group for itself', async function() {
            await this.groupsManager.addGroup(owner, {from: owner}).should.be.rejectedWith(EVMRevert);
        });
    });
});
