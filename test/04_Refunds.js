const time = require('../node_modules/openzeppelin-solidity/test/helpers/time');
const shouldFail = require('../node_modules/openzeppelin-solidity/test/helpers/shouldFail');
const advance = require('../node_modules/openzeppelin-solidity/test/helpers/advanceToBlock');
const utils = require('./helpers/Utils');
const constants = require('./helpers/Constants');

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

const MarketsManager = artifacts.require('MarketsManager');
const NGT = artifacts.require('NGT');

// Main variables
var startTime, timestamps, idx;

// Markets contract
contract('MarketsManager', function([owner, dso, player, referee, cheater]) {

    before(async function() { await advance.advanceBlock(); });

    beforeEach(async function() {
        this.timeout(600000);

        this.NGT = await NGT.new();

        this.marketsManager = await MarketsManager.new(dso, this.NGT.address);

        // Mint tokens
        await this.NGT.mint(dso, constants.DSO_TOKENS);
        await this.NGT.mint(player, constants.PLAYER_TOKENS);
        await this.NGT.mint(referee, constants.REFEREE_TOKENS);

        // Set tokens allowance
        await this.NGT.increaseAllowance(this.marketsManager.address, constants.ALLOWED_TOKENS, {from: dso});
        await this.NGT.increaseAllowance(this.marketsManager.address, constants.ALLOWED_TOKENS, {from: player});
    });

    describe('Refunds:', function() {
        // Set markets startTime
        timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
        startTime = timestamps.first;

        it('A cheater, i.e. a wallet not allowed to be refunded, tries to perform a refund', async function() {
            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);

            await shouldFail.reverting(this.marketsManager.refund(idx, {from: cheater}));
        });

        it('Try to get a refund from a not-open market', async function() {
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);
            await shouldFail.reverting(this.marketsManager.refund(idx, {from: dso}));
        });

        it('Try to get a refund from an already confirmed market', async function() {
            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);

            // Check the market state before the first confirm,  it has to be constants.STATE_WAITING_CONFIRM_TO_START
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_WAITING_CONFIRM_TO_START);

            // Confirm correctly a market
            this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Check the market state after the first confirm,  it has to be constants.STATE_RUNNING
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_RUNNING);

            // Try to get the refund
            await shouldFail.reverting(this.marketsManager.refund(idx, {from: dso}));
        });

        it('Try to get the refund too early, the player can still confirm', async function() {
            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);

            // Try to get the refund
            await shouldFail.reverting(this.marketsManager.refund(idx, {from: dso}));
        });

        it('Perform a successful refund', async function() {
            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);

            // Set the test time after the declared market beginning
            await time.increaseTo(startTime + 10*60);

            // Perform the refund
            await this.marketsManager.refund(idx, {from: dso});

            // Check the DSO token balance
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(constants.DSO_TOKENS);

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_NOT_PLAYED);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED_NO_PLAYED);
        });
    });
});
