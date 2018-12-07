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
var startTime, timestamps;

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

    describe('Unsuccessful markets openings:', function() {
        // Set markets startTime
        timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
        startTime = timestamps.first;

        it('A cheater, i.e. a wallet not allowed to open a market, tries to perform an opening', async function() {
            await shouldFail.reverting(this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: cheater}));
        });

        it('Try to open an already opened market', async function() {
            // Open correctly a market
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                    constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            // Try to open it again
            await shouldFail.reverting(this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso}));
        });

        it('Try to open a market with bad timestamps', async function() {
            // Start time in the past
            await shouldFail.reverting(this.marketsManager.open(player, constants.WRONG_STARTTIME, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso}));

            // Start time not related to a date in format YYYY-MM-01 00:00:00
            await shouldFail.reverting(this.marketsManager.open(player, startTime + 60, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso}));
        });

        it('Try to set a not allowed referee', async function() {
            // The dso is also the referee
            await shouldFail.reverting(this.marketsManager.open(player, startTime, constants.MARKET_TYPE, dso, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso}));

            // The player is also the referee
            await shouldFail.reverting(this.marketsManager.open(player, startTime, constants.MARKET_TYPE, player, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso}));

            // The referee is the address 0
            await shouldFail.reverting(this.marketsManager.open(player, startTime, constants.MARKET_TYPE, 0, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso}));
        });

        it('Try to set wrong maximums', async function() {
            await shouldFail.reverting(this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_UPPER, constants.MAX_LOWER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso}));
        });

        it('Try to stake too tokens', async function() {
            await shouldFail.reverting(this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                       constants.PEN_FACTOR, constants.ALLOWED_TOKENS+1, constants.PLAYER_TOKENS, constants.PERC_TKNS_REFEREE, {from: dso}));
        });
    });
});
