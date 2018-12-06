const Web3Utils = require('web3-utils');
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
var startTime, endTime, timestamps, idx, data, exists, idxUtils, staking, tknsMarket, tknsDSO;

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
        this.NGT.increaseAllowance(this.marketsManager.address, constants.ALLOWED_TOKENS, {from: dso});
        this.NGT.increaseAllowance(this.marketsManager.address, constants.ALLOWED_TOKENS, {from: player});
    });

    describe('Successful markets opening:', function() {
        // Set markets startTime
        timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
        startTime = timestamps.first;

        it('Open a monthly market with the correct parameters', async function() {
            // Define the timestamps
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            endTime = timestamps.last;

            // Open the market
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            // Get the market idx from the smart contract
            idx = await this.marketsManager.calcIdx(player, startTime);

            // Get the market idx web3-utils function
            idxUtils = Web3Utils.soliditySha3(player, startTime);

            // Check the existence mapping behaviour using the two identifier
            exists = await this.marketsManager.getFlag(idx);
            exists.should.be.equal(true);
            exists = await this.marketsManager.getFlag(idxUtils);
            exists.should.be.equal(true);

            // Check state and result
            data = await this.marketsManager.getState(idx);
            data.should.be.bignumber.equal(constants.STATE_WAITING_CONFIRM_TO_START);
            data = await this.marketsManager.getResult(idx);
            data.should.be.bignumber.equal(constants.RESULT_NOT_DECIDED);

            // Check the tokens staking
            staking = await this.NGT.balanceOf(this.marketsManager.address);
            staking.should.be.bignumber.equal(constants.DSO_STAKING);
            data = await this.marketsManager.getDsoStake(idx);
            data.should.be.bignumber.equal(constants.DSO_STAKING);

            // Check player and refereee
            data = await this.marketsManager.getPlayer(idx);
            data.should.be.equal(player);
            data = await this.marketsManager.getReferee(idx);
            data.should.be.equal(referee);

            // Check market period
            data = await this.marketsManager.getStartTime(idx);
            data.should.be.bignumber.equal(startTime);
            data = await this.marketsManager.getEndTime(idx);
            data.should.be.bignumber.equal(endTime);

            // Check maximums
            data = await this.marketsManager.getLowerMaximum(idx);
            data.should.be.bignumber.equal(constants.MAX_LOWER);
            data = await this.marketsManager.getUpperMaximum(idx);
            data.should.be.bignumber.equal(constants.MAX_UPPER);

            // Check revenue/penalty factor
            data = await this.marketsManager.getRevenueFactor(idx);
            data.should.be.bignumber.equal(constants.REV_FACTOR);
            data = await this.marketsManager.getPenaltyFactor(idx);
            data.should.be.bignumber.equal(constants.PEN_FACTOR);
        });

        it('Confirm the opening', async function() {
            // Define the timestamps
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Open the market
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, timestamps.first);

            // Confirm the market
            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            // Check the market state
            data = await this.marketsManager.getState(idx);
            data.should.be.bignumber.equal(constants.STATE_RUNNING);

            // Check the tokens staking
            staking = await this.NGT.balanceOf(this.marketsManager.address);
            staking.should.be.bignumber.equal(constants.DSO_STAKING+constants.PLAYER_STAKING);
            data = await this.marketsManager.getPlayerStake(idx);
            data.should.be.bignumber.equal(constants.PLAYER_STAKING);
        });

        it('Perform a successful refund', async function() {
            // Define the timestamps
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            tknsMarket, tknsDSO, idx = await this.marketsManager.calcIdx(player, startTime);

            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});

            // Set the test time after the declared market beginning
            await time.increaseTo(startTime + 10*60);

            // Try to get the refund
            await this.marketsManager.refund(idx, {from: dso});

            // Check the tokens balances after the refund
            tknsMarket = await this.NGT.balanceOf(this.marketsManager.address);
            tknsMarket.should.be.bignumber.equal(0);
            tknsDSO = await this.NGT.balanceOf(dso);
            tknsDSO.should.be.bignumber.equal(constants.DSO_TOKENS);
        });
    });
});
