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
var monthlyMarket = constants.MARKET_TYPE_MONTHLY;
var dailyMarket = constants.MARKET_TYPE_DAILY;
var hourlyMarket = constants.MARKET_TYPE_HOURLY;

// Markets contract
contract('MarketsManager', function([owner, dso, player, referee]) {

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

    describe('Successful opening of monthly markets:', function() {

        it('Open a market with the correct parameters', async function() {
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            endTime = timestamps.last;

            // Open the market
            await this.marketsManager.open(player, startTime, monthlyMarket, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            // Get the market idx from the smart contract
            idx = await this.marketsManager.calcIdx(player, startTime, monthlyMarket);

            // Check the existence mapping behaviour using the two identifier
            (await this.marketsManager.getFlag(idx)).should.be.equal(true);

            // Check state and result
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_WAITING_CONFIRM_TO_START);
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_NOT_DECIDED);

            // Check the tokens staking
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(constants.DSO_STAKING);
            (await this.marketsManager.getDsoStake(idx)).should.be.bignumber.equal(constants.DSO_STAKING);

            // Check DSO and NGT
            (await this.marketsManager.getDSO()).should.be.equal(dso);
            (await this.marketsManager.getNGT()).should.be.equal(this.NGT.address);

            // Check player and referee
            (await this.marketsManager.getPlayer(idx)).should.be.equal(player);
            (await this.marketsManager.getReferee(idx)).should.be.equal(referee);

            // Check market period
            (await this.marketsManager.getStartTime(idx)).should.be.bignumber.equal(startTime);
            (await this.marketsManager.getEndTime(idx)).should.be.bignumber.equal(endTime);

            // Check maximums
            (await this.marketsManager.getLowerMaximum(idx)).should.be.bignumber.equal(constants.MAX_LOWER);
            (await this.marketsManager.getUpperMaximum(idx)).should.be.bignumber.equal(constants.MAX_UPPER);

            // Check revenue/penalty factor
            (await this.marketsManager.getRevenueFactor(idx)).should.be.bignumber.equal(constants.REV_FACTOR);
            (await this.marketsManager.getPenaltyFactor(idx)).should.be.bignumber.equal(constants.PEN_FACTOR);

            // Check revenue percentage for the referee
            (await this.marketsManager.getRevPercReferee(idx)).should.be.bignumber.equal(constants.PERC_TKNS_REFEREE);
        });

        it('Confirm the market opening', async function() {
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            endTime = timestamps.last;

            // Open the market
            await this.marketsManager.open(player, startTime, monthlyMarket, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, monthlyMarket);

            // Confirm the market
            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Check the market state
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_RUNNING);

            // Check the tokens staking
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(constants.DSO_STAKING+constants.PLAYER_STAKING);
            (await this.marketsManager.getPlayerStake(idx)).should.be.bignumber.equal(constants.PLAYER_STAKING);
        });
    });

    describe('Successful opening of daily markets:', function() {

        it('Open a market with the correct parameters', async function() {
            timestamps = utils.getFirstLastTSNextDay(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            endTime = timestamps.last;

            // Open the market
            await this.marketsManager.open(player, startTime, dailyMarket, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            // Get the market idx from the smart contract
            idx = await this.marketsManager.calcIdx(player, startTime, dailyMarket);

            // Check the existence mapping behaviour using the two identifier
            (await this.marketsManager.getFlag(idx)).should.be.equal(true);

            // Check state and result
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_WAITING_CONFIRM_TO_START);
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_NOT_DECIDED);

            // Check the tokens staking
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(constants.DSO_STAKING);
            (await this.marketsManager.getDsoStake(idx)).should.be.bignumber.equal(constants.DSO_STAKING);

            // Check DSO and NGT
            (await this.marketsManager.getDSO()).should.be.equal(dso);
            (await this.marketsManager.getNGT()).should.be.equal(this.NGT.address);

            // Check player and referee
            (await this.marketsManager.getPlayer(idx)).should.be.equal(player);
            (await this.marketsManager.getReferee(idx)).should.be.equal(referee);

            // Check market period
            (await this.marketsManager.getStartTime(idx)).should.be.bignumber.equal(startTime);
            (await this.marketsManager.getEndTime(idx)).should.be.bignumber.equal(endTime);

            // Check maximums
            (await this.marketsManager.getLowerMaximum(idx)).should.be.bignumber.equal(constants.MAX_LOWER);
            (await this.marketsManager.getUpperMaximum(idx)).should.be.bignumber.equal(constants.MAX_UPPER);

            // Check revenue/penalty factor
            (await this.marketsManager.getRevenueFactor(idx)).should.be.bignumber.equal(constants.REV_FACTOR);
            (await this.marketsManager.getPenaltyFactor(idx)).should.be.bignumber.equal(constants.PEN_FACTOR);

            // Check revenue percentage for the referee
            (await this.marketsManager.getRevPercReferee(idx)).should.be.bignumber.equal(constants.PERC_TKNS_REFEREE);
        });

        it('Confirm the market opening', async function() {
            timestamps = utils.getFirstLastTSNextDay(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            endTime = timestamps.last;

            // Open the market
            await this.marketsManager.open(player, startTime, dailyMarket, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, dailyMarket);

            // Confirm the market
            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Check the market state
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_RUNNING);

            // Check the tokens staking
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(constants.DSO_STAKING+constants.PLAYER_STAKING);
            (await this.marketsManager.getPlayerStake(idx)).should.be.bignumber.equal(constants.PLAYER_STAKING);
        });
    });

    describe('Successful opening of hourly markets:', function() {

        it('Open a market with the correct parameters', async function() {
            timestamps = utils.getFirstLastTSNextHour(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            endTime = timestamps.last;

            // Open the market
            await this.marketsManager.open(player, startTime, hourlyMarket, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            // Get the market idx from the smart contract
            idx = await this.marketsManager.calcIdx(player, startTime, hourlyMarket);

            // Check the existence mapping behaviour using the two identifier
            (await this.marketsManager.getFlag(idx)).should.be.equal(true);

            // Check state and result
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_WAITING_CONFIRM_TO_START);
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_NOT_DECIDED);

            // Check the tokens staking
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(constants.DSO_STAKING);
            (await this.marketsManager.getDsoStake(idx)).should.be.bignumber.equal(constants.DSO_STAKING);

            // Check DSO and NGT
            (await this.marketsManager.getDSO()).should.be.equal(dso);
            (await this.marketsManager.getNGT()).should.be.equal(this.NGT.address);

            // Check player and referee
            (await this.marketsManager.getPlayer(idx)).should.be.equal(player);
            (await this.marketsManager.getReferee(idx)).should.be.equal(referee);

            // Check market period
            (await this.marketsManager.getStartTime(idx)).should.be.bignumber.equal(startTime);
            (await this.marketsManager.getEndTime(idx)).should.be.bignumber.equal(endTime);

            // Check maximums
            (await this.marketsManager.getLowerMaximum(idx)).should.be.bignumber.equal(constants.MAX_LOWER);
            (await this.marketsManager.getUpperMaximum(idx)).should.be.bignumber.equal(constants.MAX_UPPER);

            // Check revenue/penalty factor
            (await this.marketsManager.getRevenueFactor(idx)).should.be.bignumber.equal(constants.REV_FACTOR);
            (await this.marketsManager.getPenaltyFactor(idx)).should.be.bignumber.equal(constants.PEN_FACTOR);

            // Check revenue percentage for the referee
            (await this.marketsManager.getRevPercReferee(idx)).should.be.bignumber.equal(constants.PERC_TKNS_REFEREE);
        });

        it('Confirm the market opening', async function() {
            // Open the market
            await this.marketsManager.open(player, startTime, hourlyMarket, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, hourlyMarket);

            // Confirm the market
            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Check the market state
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_RUNNING);

            // Check the tokens staking
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(constants.DSO_STAKING+constants.PLAYER_STAKING);
            (await this.marketsManager.getPlayerStake(idx)).should.be.bignumber.equal(constants.PLAYER_STAKING);
        });
    });
});
