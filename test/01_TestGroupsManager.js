const shouldFail = require('../node_modules/openzeppelin-solidity/test/helpers/shouldFail');
const advance = require('../node_modules/openzeppelin-solidity/test/helpers/advanceToBlock');

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

const GroupsManager = artifacts.require('GroupsManager');
const NGT = artifacts.require('NGT');

// Markets contract
contract('GroupsManager', function([owner, dso, cheater]) {

    before(async function() { await advance.advanceBlock(); });

    beforeEach(async function() {
        this.timeout(600000);

        this.NGT = await NGT.new();

        this.groupsManager = await GroupsManager.new(this.NGT.address);
    });

    describe('Management tests:', function() {

        it('Add successfully a group of markets', async function() {
            await this.groupsManager.addGroup(dso, {from: owner});

            (await this.groupsManager.getFlag(dso)).should.be.true;
            (await this.groupsManager.getAddress(dso)).should.be.not.equal(0);
        });

        it('Try to open an already opened group', async function() {
            await this.groupsManager.addGroup(dso, {from: owner});

            await shouldFail.reverting(this.groupsManager.addGroup(dso, {from: owner}));
        });

        it('A cheater tries to open a group', async function() {
            await shouldFail.reverting(this.groupsManager.addGroup(dso, {from: cheater}));
        });

        it('The owner is trying to cheat, opening a group for itself', async function() {
            await shouldFail.reverting(this.groupsManager.addGroup(owner, {from: owner}));
        });
    });
});
