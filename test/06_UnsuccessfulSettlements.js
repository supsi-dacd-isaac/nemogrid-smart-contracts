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
var startTime, endTime, timestamps, idx;

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

    describe('Unsuccessful settlements:', function() {
        // Set markets startTime
        it('Try to settle a not existing market', async function() {
            // Open the market and not confirm it
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            // The cheater tries to settle
            await shouldFail.reverting(this.marketsManager.settle(idx, constants.MAX_LOWER, {from: dso}));
        });

        it('Try to settle the market too early', async function() {
            // Open the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            // Confirm the market
            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Set the time a minute after the market opening
            await time.increaseTo(startTime + 60);

            // Try to settle
            await shouldFail.reverting(this.marketsManager.settle(idx, constants.MAX_LOWER, {from: dso}));
        });

        it('A cheater, i.e. a wallet not allowed to settle a market, tries to perform a settlement', async function() {
            // Open the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            // Confirm the market
            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Set the time a minute after the market end
            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            // The cheater tries to settle
            await shouldFail.reverting(this.marketsManager.settle(idx, constants.MAX_LOWER, {from: cheater}));
        });

        it('Try to settle a not confirmed market', async function() {
            // Open the market and not confirm it
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            // Set the time a minute after the market end
            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            // The cheater tries to settle
            await shouldFail.reverting(this.marketsManager.settle(idx, constants.MAX_LOWER, {from: dso}));
        });
    });
});
