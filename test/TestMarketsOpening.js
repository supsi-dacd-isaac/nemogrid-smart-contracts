/*
 * Requieres
 */

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const _ = require('lodash');
const { ecsign } = require('ethereumjs-util');
const moment = require('moment');
const Web3Utils = require('web3-utils');
const abi = require('ethereumjs-abi');
const BN = require('bn.js');
const EVMRevert = 'revert';

/*
 * Utilities functions
 */

// Ethers
function ether(n) {
  return new web3.BigNumber(web3.toWei(n, 'ether'));
}

// Latest time
function latestTime() {
  return web3.eth.getBlock('latest').timestamp;
}

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

// Increase time
function increaseTime(duration) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1);

      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
}

function increaseTimeTo(target) {
  let now = latestTime();
  if (target < now) throw Error(`Cannot increase current time(${now}) to a moment in the past(${target})`);
  let diff = target - now;
  return increaseTime(diff);
}

// Returns the first and last timestamps of the month X given a timestamp in X
function getFirstLastTSNextMonth(ts) {
    var m = moment.utc(ts)
    m = m.add(1, 'months');

    return {
        first: parseInt(m.startOf('month').valueOf()/1000),
        last: parseInt(m.endOf('month').valueOf()/1000)
    };
}

const duration = {
  seconds: function(val) {
    return val;
  },
  minutes: function(val) {
    return val * this.seconds(60);
  },
  hours: function(val) {
    return val * this.minutes(60);
  },
  days: function(val) {
    return val * this.hours(24);
  },
  weeks: function(val) {
    return val * this.days(7);
  },
  years: function(val) {
    return val * this.days(365);
  },
};

const expectEvent = (res, eventName) => {
  const ev = _.find(res.logs, {
    event: eventName
  })
  expect(ev).to.not.be.undefined
  return ev
}


// Smart contracts
const MarketsManager = artifacts.require('MarketsManager');
const Markets = artifacts.require('Markets');
const NGT = artifacts.require('NGT');

// Markets contract
contract('Markets', function([owner, dso, player, referee, cheater]) {
    // NGT has 18 decimals => all is multiplied by 1e18

    // Markets states
    const STATE_NONE = 0;
    const STATE_NOT_RUNNING = 1;
    const STATE_WAITING_CONFIRM_TO_START = 2;
    const STATE_RUNNING = 3;
    const STATE_WAITING_CONFIRM_TO_END = 4;
    const STATE_WAITING_FOR_THE_REFEREE = 5;
    const STATE_CLOSED = 6;
    const STATE_CLOSED_AFTER_JUDGEMENT = 7;
    const STATE_CLOSED_NO_PLAYED = 8;

    // Markets result
    const RESULT_NONE = 0;
    const RESULT_NOT_DECIDED = 1;
    const RESULT_NOT_PLAYED = 2;
    const RESULT_PRIZE = 3;
    const RESULT_REVENUE = 4;
    const RESULT_PENALTY = 5;
    const RESULT_CRASH = 6;
    const RESULT_DSO_CHEATING = 7;
    const RESULT_PLAYER_CHEATING = 8;
    const CHEATERS = 9;

    // Token amounts
    const DSO_TOKENS = 1000;
    const PLAYER_TOKENS = 1000;
    const ALLOWED_TOKENS = 100;

    const WRONG_STARTTIME = moment.utc('2017-12-01 00:00:00').toDate().getTime() / 1000;

    // Lower maximum [kW]
    const MAX_LOWER = 10;

    // Upper maximum [kW]
    const MAX_UPPER = 20;

    // Revenue factor [NGT/kW]
    const REV_FACTOR = 1;

    // Penalty factor [NGT/kW]
    const PEN_FACTOR = 2;

    // DSO staked NGTs
    const DSO_STAKING = 10;

    // Player staked NGTs
    const PLAYER_STAKING = 15;

    var startTime;

    before(async function() {
        // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    // Create the Market and NGT objects
    beforeEach(async function() {
        this.timeout(600000);

        this.NGT = await NGT.new();

        this.markets = await Markets.new(dso, this.NGT.address);

        // Mint tokens
        await this.NGT.mint(dso, DSO_TOKENS);
        await this.NGT.mint(player, PLAYER_TOKENS);

        // Set tokens allowance
        this.NGT.increaseAllowance(this.markets.address, ALLOWED_TOKENS, {from: dso});
        this.NGT.increaseAllowance(this.markets.address, ALLOWED_TOKENS, {from: player});
    });

    describe('Initial tests:', function() {
        it('Check the smart contracts existence', async function() {
            this.markets.should.exist;
            this.NGT.should.exist;
        });
    });

    describe('Tests related to unsuccessful markets openings:', function() {
        // Set markets startTime
        var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
        startTime = timestamps.first;

        it('A cheater, i.e. a wallet not allowed to open a market, tries to perform an opening', async function() {
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: cheater}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to open an already opened market', async function() {
            // Open correctly a market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});

            // Try to open it again
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to open a market with bad timestamps', async function() {
            // Start time in the past
            await this.markets.open(player, WRONG_STARTTIME, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso}).should.be.rejectedWith(EVMRevert);

            // Start time not related to a date in format YYYY-MM-01 00:00:00
            await this.markets.open(player, startTime + 60, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to set a not allowed referee', async function() {
            // The dso is also the referee
            await this.markets.open(player, startTime, dso, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso}).should.be.rejectedWith(EVMRevert);

            // The player is also the referee
            await this.markets.open(player, startTime, player, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso}).should.be.rejectedWith(EVMRevert);

            // The referee is the address 0
            await this.markets.open(player, startTime, 0, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to set wrong maximums', async function() {
            await this.markets.open(player, startTime, referee, MAX_UPPER, MAX_LOWER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to stake too tokens', async function() {
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, ALLOWED_TOKENS+1, PLAYER_TOKENS, {from: dso}).should.be.rejectedWith(EVMRevert);
        });
    });

    describe('Tests related to unsuccessful confirms of markets openings:', function() {
        it('A cheater, i.e. a wallet not allowed to confirm, tries to perform a confirm opening', async function() {
            // Open correctly a market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});

            var idx = await this.markets.calcIdx(player, startTime);

            await this.markets.confirmOpening(idx, PLAYER_STAKING, {from: cheater}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to confirm a not-open market', async function() {
            var idx = await this.markets.calcIdx(player, startTime);

            await this.markets.confirmOpening(idx, PLAYER_STAKING, {from: player}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to confirm with a wrong staking, i.e. the player is trying to cheat', async function() {
            // Open correctly a market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});

            var idx = await this.markets.calcIdx(player, startTime);

            await this.markets.confirmOpening(idx, PLAYER_STAKING-1, {from: player}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to confirm an already confirmed market', async function() {
            // Open correctly a market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});

            var idx = await this.markets.calcIdx(player, startTime), data;
            // Check the market state before the first confirm,  it has to be STATE_WAITING_CONFIRM_TO_START
            data = await this.markets.getState(idx);
            data.should.be.bignumber.equal(STATE_WAITING_CONFIRM_TO_START);

            // Confirm correctly a market
            await this.markets.confirmOpening(idx, PLAYER_STAKING, {from: player}).should.not.be.rejectedWith(EVMRevert);

            // Check the market state after the first confirm,  it has to be STATE_RUNNING
            data = await this.markets.getState(idx);
            data.should.be.bignumber.equal(STATE_RUNNING);

            // Try to confirm again the market
            await this.markets.confirmOpening(idx, PLAYER_STAKING, {from: player}).should.be.rejectedWith(EVMRevert);

        });

        it('Try to stake too tokens', async function() {
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});

            var idx = await this.markets.calcIdx(player, startTime);

            await this.markets.confirmOpening(idx, ALLOWED_TOKENS+1, {from: player}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to perform a too-late confirm', async function() {
            var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});
            var idx = await this.markets.calcIdx(player, startTime);

            // Set the test time after the declared market beginning
            await increaseTimeTo(startTime + 10*60);

            await this.markets.confirmOpening(idx, PLAYER_STAKING, {from: player}).should.be.rejectedWith(EVMRevert);
        });
    });

    describe('Tests related to unsuccessful refunds:', function() {
        it('A cheater, i.e. a wallet not allowed to be refunded, tries to perform a refund', async function() {
            // Set markets startTime
            var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Open correctly a market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});
            var idx = await this.markets.calcIdx(player, startTime);

            await this.markets.refund(idx, {from: cheater}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to get a refund from a not-open market', async function() {
            var idx = await this.markets.calcIdx(player, startTime);
            await this.markets.refund(idx, {from: dso}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to get a refund from an already confirmed market', async function() {
            var data;
            var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Open correctly a market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});
            var idx = await this.markets.calcIdx(player, startTime);

            // Check the market state before the first confirm,  it has to be STATE_WAITING_CONFIRM_TO_START
            data = await this.markets.getState(idx);
            data.should.be.bignumber.equal(STATE_WAITING_CONFIRM_TO_START);

            // Confirm correctly a market
            await this.markets.confirmOpening(idx, PLAYER_STAKING, {from: player}).should.not.be.rejectedWith(EVMRevert);

            // Check the market state after the first confirm,  it has to be STATE_RUNNING
            data = await this.markets.getState(idx);
            data.should.be.bignumber.equal(STATE_RUNNING);

            // Try to get the refund
            await this.markets.refund(idx, {from: dso}).should.be.rejectedWith(EVMRevert);
        });

        it('Try to get the refund too early, the player can still confirm', async function() {
            var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Open correctly a market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});
            var idx = await this.markets.calcIdx(player, startTime);

            // Try to get the refund
            await this.markets.refund(idx, {from: dso}).should.be.rejectedWith(EVMRevert);
        });
    });

    describe('Tests related to successful markets opening:', function() {
        it('Open a monthly market with the correct parameters', async function() {

            var exists, data, idx, idxUtils, staking;

            // Define the timestamps
            var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;
            var endTime = timestamps.last;

            // Open the market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});

            // Get the market idx from the smart contract
            idx = await this.markets.calcIdx(player, startTime);

            // Get the market idx web3-utils function
            idxUtils = Web3Utils.soliditySha3(player, startTime);

            // Check the existence mapping behaviour using the two identifier
            exists = await this.markets.getFlag(idx);
            exists.should.be.equal(true);
            exists = await this.markets.getFlag(idxUtils);
            exists.should.be.equal(true);

            // Check state and result
            data = await this.markets.getState(idx);
            data.should.be.bignumber.equal(STATE_WAITING_CONFIRM_TO_START);
            data = await this.markets.getResult(idx);
            data.should.be.bignumber.equal(RESULT_NOT_DECIDED);

            // Check the tokens staking
            staking = await this.NGT.balanceOf(this.markets.address);
            staking.should.be.bignumber.equal(DSO_STAKING);
            data = await this.markets.getDsoStake(idx);
            data.should.be.bignumber.equal(DSO_STAKING);

            // Check player and refereee
            data = await this.markets.getPlayer(idx);
            data.should.be.equal(player);
            data = await this.markets.getReferee(idx);
            data.should.be.equal(referee);

            // Check market period
            data = await this.markets.getStartTime(idx);
            data.should.be.bignumber.equal(startTime);
            data = await this.markets.getEndTime(idx);
            data.should.be.bignumber.equal(endTime);

            // Check maximums
            data = await this.markets.getLowerMaximum(idx);
            data.should.be.bignumber.equal(MAX_LOWER);
            data = await this.markets.getUpperMaximum(idx);
            data.should.be.bignumber.equal(MAX_UPPER);

            // Check revenue/penalty factor
            data = await this.markets.getRevenueFactor(idx);
            data.should.be.bignumber.equal(REV_FACTOR);
            data = await this.markets.getPenaltyFactor(idx);
            data.should.be.bignumber.equal(PEN_FACTOR);
        });

        it('Confirm the opening', async function() {

            var data, idx, staking;

            // Define the timestamps
            var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            // Open the market
            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});
            idx = await this.markets.calcIdx(player, timestamps.first);

            // Confirm the market
            await this.markets.confirmOpening(idx, PLAYER_STAKING, {from: player});

            // Check the market state
            data = await this.markets.getState(idx);
            data.should.be.bignumber.equal(STATE_RUNNING);

            // Check the tokens staking
            staking = await this.NGT.balanceOf(this.markets.address);
            staking.should.be.bignumber.equal(DSO_STAKING+PLAYER_STAKING);
            data = await this.markets.getPlayerStake(idx);
            data.should.be.bignumber.equal(PLAYER_STAKING);
        });

        it('Perform a successful refund', async function() {
            // Define the timestamps
            var timestamps = getFirstLastTSNextMonth(parseInt(web3.eth.getBlock(web3.eth.blockNumber).timestamp)*1000);
            startTime = timestamps.first;

            var tknsMarket, tknsDSO, idx = await this.markets.calcIdx(player, startTime);

            await this.markets.open(player, startTime, referee, MAX_LOWER, MAX_UPPER, REV_FACTOR,
                                    PEN_FACTOR, DSO_STAKING, PLAYER_STAKING, {from: dso});

            // Set the test time after the declared market beginning
            await increaseTimeTo(startTime + 10*60);

            // Try to get the refund
            await this.markets.refund(idx, {from: dso});

            // Check the tokens balances after the refund
            tknsMarket = await this.NGT.balanceOf(this.markets.address);
            tknsMarket.should.be.bignumber.equal(0);
            tknsDSO = await this.NGT.balanceOf(dso);
            tknsDSO.should.be.bignumber.equal(DSO_TOKENS);
        });
    });
});
