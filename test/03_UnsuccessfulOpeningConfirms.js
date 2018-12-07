const shouldFail = require('../node_modules/openzeppelin-solidity/test/helpers/shouldFail');
const time = require('../node_modules/openzeppelin-solidity/test/helpers/time');
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

    describe('Unsuccessful confirms of markets openings:', function() {
        // Set markets startTime
        timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
        startTime = timestamps.first;

        it('A cheater, i.e. a wallet not allowed to confirm, tries to perform a confirm opening', async function() {

            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await shouldFail.reverting(this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: cheater}));
        });

        it('Try to confirm a not-open market', async function() {
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await shouldFail.reverting(this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player}));
        });

        it('Try to confirm with a wrong staking, i.e. the player is trying to cheat', async function() {
            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                    constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await shouldFail.reverting(this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING-1, {from: player}));
        });

        it('Try to confirm an already confirmed market', async function() {
            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);
            // Check the market state before the first confirm,  it has to be constants.STATE_WAITING_CONFIRM_TO_START
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_WAITING_CONFIRM_TO_START);

            // Confirm correctly a market
            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Check the market state after the first confirm,  it has to be constants.STATE_RUNNING
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_RUNNING);

            // Try to confirm again the market
            await shouldFail.reverting(this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player}));
        });

        it('Try to stake too tokens', async function() {
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                    constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await shouldFail.reverting(this.marketsManager.confirmOpening(idx, constants.ALLOWED_TOKENS+1, {from: player}));
        });

        it('Try to perform a too-late confirm', async function() {
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            // Set the test time after the declared market beginning
            await time.increaseTo(startTime + 10*60);

            await shouldFail.reverting(this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player}));
        });
    });

});
