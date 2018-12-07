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
var startTime, endTime, timestamps, idx, powerPeak, calcDsoTkns, calcPlayerTkns;

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

    describe('Successful settlements:', function() {
        it('PowerPeak <= LowerMaximum: The player takes all the DSO tokens', async function() {
            // Set markets startTime
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Set the measured power peak
            powerPeak = constants.MAX_LOWER - 1;

            // run the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            await this.marketsManager.settle(idx, powerPeak, {from: dso});

            await this.marketsManager.confirmSettlement(idx, powerPeak, {from: player});

            // Check the tokens balances
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(0);
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(constants.DSO_TOKENS-constants.DSO_STAKING);
            (await this.NGT.balanceOf(player)).should.be.bignumber.equal(constants.PLAYER_TOKENS+constants.DSO_STAKING);

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_PRIZE);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED);
        });

        it('LowerMaximum < PowerPeak <= UpperMaximum: The player takes a part of the DSO tokens (revenue)', async function() {
            // Set markets startTime
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Set the measured power peak to 12 kW, inside the maximums interval [10 - 20] kW and the player revenue
            powerPeak = constants.MAX_LOWER + 2;
            calcDsoTkns = (powerPeak - constants.MAX_LOWER) * constants.REV_FACTOR;
            calcPlayerTkns = constants.PLAYER_TOKENS + constants.DSO_STAKING - calcDsoTkns;
            calcDsoTkns = constants.DSO_TOKENS - constants.DSO_STAKING + calcDsoTkns;

            // run the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            await this.marketsManager.settle(idx, powerPeak, {from: dso});
            await this.marketsManager.confirmSettlement(idx, powerPeak, {from: player});

            // Check the tokens balances
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(0);
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(calcDsoTkns);
            (await this.NGT.balanceOf(player)).should.be.bignumber.equal(calcPlayerTkns);

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_REVENUE);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED);
        });

        it('PowerPeak > UpperMaximum AND the player staking is enough: The DSO takes a part of the player tokens (penalty)', async function() {
            // Set markets startTime
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Set the measured power peak to 23 kW and the player penalty
            powerPeak = constants.MAX_UPPER + 3;
            calcDsoTkns = (powerPeak - constants.MAX_UPPER) * constants.PEN_FACTOR;
            calcPlayerTkns = constants.PLAYER_TOKENS - calcDsoTkns;
            calcDsoTkns = constants.DSO_TOKENS + calcDsoTkns;

            // run the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            await this.marketsManager.settle(idx, powerPeak, {from: dso});
            await this.marketsManager.confirmSettlement(idx, powerPeak, {from: player});

            // Check the tokens balances
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(0);
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(calcDsoTkns);
            (await this.NGT.balanceOf(player)).should.be.bignumber.equal(calcPlayerTkns);

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_PENALTY);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED);
        });

        it('PowerPeak > UpperMaximum AND the player staking is not enough: The DSO takes all the player tokens (crash)', async function() {
            // Set markets startTime
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Set the measured power peak too high for the player staking
            powerPeak = constants.MAX_UPPER + (constants.PLAYER_STAKING / constants.PEN_FACTOR) + 1;

            // run the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            await this.marketsManager.open(player, startTime, constants.MARKET_TYPE, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                    constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MARKET_TYPE);

            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            await this.marketsManager.settle(idx, powerPeak, {from: dso});
            await this.marketsManager.confirmSettlement(idx, powerPeak, {from: player});

            // Check the tokens balances
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(0);
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(constants.DSO_TOKENS + constants.PLAYER_STAKING);
            (await this.NGT.balanceOf(player)).should.be.bignumber.equal(constants.PLAYER_TOKENS - constants.PLAYER_STAKING);

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_CRASH);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED);
        });
    });
});
