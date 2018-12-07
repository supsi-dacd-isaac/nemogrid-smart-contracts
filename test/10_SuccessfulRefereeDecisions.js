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

    describe('Successful referee decisions:', function() {

        it('DSO has cheated: The referee retains a tokens percentage decided during the opening and assigns all the remaining part to the player', async function() {
            // run the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);

            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            await this.marketsManager.settle(idx, constants.MAX_LOWER+5, {from: dso});

            await this.marketsManager.confirmSettlement(idx, constants.MAX_LOWER, {from: player});

            // The referee performs its decision
            await this.marketsManager.performRefereeDecision(idx, constants.MAX_LOWER, {from: referee});

            // Check the tokens balances
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(0);
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(constants.DSO_TOKENS - constants.DSO_STAKING);
            (await this.NGT.balanceOf(player)).should.be.bignumber.equal(constants.PLAYER_TOKENS - constants.PLAYER_STAKING + (constants.DSO_STAKING + constants.PLAYER_STAKING)*(1-constants.PERC_TKNS_REFEREE/1e2));
            (await this.NGT.balanceOf(referee)).should.be.bignumber.equal(constants.REFEREE_TOKENS + (constants.DSO_STAKING + constants.PLAYER_STAKING)*constants.PERC_TKNS_REFEREE/1e2);

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_DSO_CHEATING);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED_AFTER_JUDGEMENT);
        });

        it('Player has cheated: The referee retains a tokens percentage decided during the opening and assigns all the remaining part to the DSO', async function() {
            // run the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);

            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            await this.marketsManager.settle(idx, constants.MAX_LOWER+5, {from: dso});

            await this.marketsManager.confirmSettlement(idx, constants.MAX_LOWER, {from: player});

            // The referee performs its decision
            await this.marketsManager.performRefereeDecision(idx, constants.MAX_LOWER+5, {from: referee});

            // Check the tokens balances
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(0);
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(constants.DSO_TOKENS - constants.DSO_STAKING + (constants.DSO_STAKING + constants.PLAYER_STAKING)*(1-constants.PERC_TKNS_REFEREE/1e2));
            (await this.NGT.balanceOf(player)).should.be.bignumber.equal(constants.PLAYER_TOKENS - constants.PLAYER_STAKING);
            (await this.NGT.balanceOf(referee)).should.be.bignumber.equal(constants.REFEREE_TOKENS + (constants.DSO_STAKING + constants.PLAYER_STAKING)*constants.PERC_TKNS_REFEREE/1e2);

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_PLAYER_CHEATING);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED_AFTER_JUDGEMENT);
        });

        it('Both DSO and player have cheated: The referee retains a tokens percentage decided during the opening and burns all the remaining part', async function() {
            // run the market
            timestamps = utils.getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            await this.marketsManager.open(player, startTime, constants.MONTHLY, referee, constants.MAX_LOWER, constants.MAX_UPPER, constants.REV_FACTOR,
                                           constants.PEN_FACTOR, constants.DSO_STAKING, constants.PLAYER_STAKING, constants.PERC_TKNS_REFEREE, {from: dso});
            idx = await this.marketsManager.calcIdx(player, startTime, constants.MONTHLY);

            await this.marketsManager.confirmOpening(idx, constants.PLAYER_STAKING, {from: player});

            endTime = await this.marketsManager.getEndTime(idx);
            await time.increaseTo(parseInt(endTime) + 60);

            await this.marketsManager.settle(idx, constants.MAX_LOWER+5, {from: dso});

            await this.marketsManager.confirmSettlement(idx, constants.MAX_LOWER, {from: player});

            // The referee performs its decision
            await this.marketsManager.performRefereeDecision(idx, constants.MAX_LOWER+2, {from: referee});

            // Check the tokens balances
            (await this.NGT.balanceOf(this.marketsManager.address)).should.be.bignumber.equal(0);
            (await this.NGT.balanceOf(dso)).should.be.bignumber.equal(constants.DSO_TOKENS - constants.DSO_STAKING);
            (await this.NGT.balanceOf(player)).should.be.bignumber.equal(constants.PLAYER_TOKENS - constants.PLAYER_STAKING);
            (await this.NGT.balanceOf(referee)).should.be.bignumber.equal(constants.REFEREE_TOKENS + (constants.DSO_STAKING + constants.PLAYER_STAKING)*constants.PERC_TKNS_REFEREE/1e2);

            // Check the tokens urning
            (await this.NGT.totalSupply()).should.be.bignumber.equal(constants.TOTAL_TOKENS - (constants.DSO_STAKING + constants.PLAYER_STAKING)*(1-constants.PERC_TKNS_REFEREE/1e2));

            // Check market result and state
            (await this.marketsManager.getResult(idx)).should.be.bignumber.equal(constants.RESULT_CHEATERS);
            (await this.marketsManager.getState(idx)).should.be.bignumber.equal(constants.STATE_CLOSED_AFTER_JUDGEMENT);
        });
    });
});
