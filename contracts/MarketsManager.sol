pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DateTime.sol";
import "./NGT.sol";

/// @title A manager to handle energy markets
contract MarketsManager is Ownable, DateTime {
    // todo Separate contract for the market logic
    // todo Daily market

    using SafeMath for uint;

    // Enum definitions

    /// State of the market
    enum MarketState {
                        None,
                        NotRunning,             // Market not running
                        WaitingConfirmToStart,  // Waiting for player confirm to start
                        Running,                // Market running
                        WaitingConfirmToEnd,    // Waiting for player confirm to end the market and assign the tokens
                        WaitingForTheReferee,   // Waiting for the referee decision
                        Closed,                 // Market closed
                        ClosedAfterJudgement,   // Market closed after referee judgement
                        ClosedNotPlayed         // Market closed because not played by the player
                     }

    /// Result of the market
    enum MarketResult {
                        None,
                        NotDecided,         // The market is not ended
                        NotPlayed,          // The market is not played by the player
                        Prize,              // The player takes all the NGTs staked by the DSO
                        Revenue,            // The player takes a part of the NGTs staked by the DSO
                        Penalty,            // The DSO takes a part of the NGTs staked by the player
                        Crash,              // The DSO takes all the NGTs staked by the player
                        DSOCheating,        // The referee assigns the NGT staked by the player to the DSO
                        PlayerCheating,     // The referee assigns the NGT staked by the DSO to the player
                        Cheaters            // The referee decides that both DSO and the player will be refunded
                      }

    // Struct data

    // Market data
    struct MarketData {
        // Address of the player
        address player;

        // Address of a trusted referee, which decides the market if dso and player do not agree
        address referee;

        // Starting time of the market (timestamp)
        uint startTime;

        // Ending time of the market (timestamp)
        uint endTime;

        // Lower maximum power threshold (W)
        uint maxPowerLower;

        // Upper maximum power threshold (W)
        uint maxPowerUpper;

        // Revenue factor for the player (max_power_lower < max(P) < max_power_upper) (NGT/kW)
        uint revenueFactor;

        // Penalty factor for the player (max(P) > max_power_upper) (NGT/kW)
        uint penaltyFactor;

        // Amount staked by the DSO
        uint dsoStaking;

        // Amount staked by the player
        uint playerStaking;

        // Token released to the DSO after the market ending
        uint tknReleasedToDso;

        // Token released to the player after the market ending
        uint tknReleasedToPlayer;

        // Power peak declared by the DSO
        uint powerPeakDeclaredByDso;

        // Power peak declared by the player
        uint powerPeakDeclaredByPlayer;

        // Revenue token for the referee
        uint revPercReferee;

        // State of the market
        MarketState state;

        // Result of the market
        MarketResult result;
    }

    // Variables declaration

    /// Nemogrid token (NGT) used in the markets
    NGT public ngt;

    /// DSO related to the markets
    address public dso;

    /// Mapping related to markets data
    mapping (uint => MarketData) marketsData;

    /// Mapping related to markets existence
    mapping (uint => bool) marketsFlag;

    // Events

    /// Market opened by DSO
    /// @param player player address
    /// @param startTime timestamp of the market starting time
    /// @param idx market identifier
    event Opened(address player, uint startTime, uint idx);

    /// Market opening confirmed by the player
    /// @param player player address
    /// @param startTime timestamp of the market starting time
    /// @param idx market identifier
    event ConfirmedOpening(address player, uint startTime, uint idx);

    /// DSO has been refunded
    /// @param dso dso address
    /// @param idx market identifier
    event RefundedDSO(address dso, uint idx);

    /// Market settled by DSO
    /// @param player player address
    /// @param startTime timestamp of the market starting time
    /// @param idx market identifier
    /// @param powerPeak maximum power consumed by player during the market
    event Settled(address player, uint startTime, uint idx, uint powerPeak);

    /// Market settlement confirmed by player
    /// @param player player address
    /// @param startTime timestamp of the market starting time
    /// @param idx market identifier
    /// @param powerPeak maximum power consumed by player during the market
    event ConfirmedSettlement(address player, uint startTime, uint idx, uint powerPeak);

    /// Successful settlement, player and DSO agree on the declared power peaks
    event SuccessfulSettlement();

    /// Unsuccessful settlement, player and DSO do not agree on the declared power peaks
    /// @param powerPeakDSO maximum power declared by dso
    /// @param powerPeakPlayer maximum power declared by player
    event UnsuccessfulSettlement(uint powerPeakDSO, uint powerPeakPlayer);

    /// Market result is Prize
    /// @param tokensForDso NGTs amount for the DSO
    /// @param tokensForPlayer NGTs amount for the player
    event Prize(uint tokensForDso, uint tokensForPlayer);

    /// Market result is Revenue
    /// @param tokensForDso NGTs amount for the DSO
    /// @param tokensForPlayer NGTs amount for the player
    event Revenue(uint tokensForDso, uint tokensForPlayer);

    /// Market result is Penalty
    /// @param tokensForDso NGTs amount for the DSO
    /// @param tokensForPlayer NGTs amount for the player
    event Penalty(uint tokensForDso, uint tokensForPlayer);

    /// Market result is Crash
    /// @param tokensForDso NGTs amount for the DSO
    /// @param tokensForPlayer NGTs amount for the player
    event Crash(uint tokensForDso, uint tokensForPlayer);

    /// Market has been closed
    /// @param marketResult market final result
    event Closed(MarketResult marketResult);

    /// Intervention of the referee to decide the market
    /// @param player player address
    /// @param startTime timestamp of the market starting time
    /// @param idx market identifier
    event RefereeIntervention(address player, uint startTime, uint idx);

    /// Player cheated
    event PlayerCheated();

    /// DSO cheated
    event DSOCheated();

    /// Both DSO and player cheated
    event DSOAndPlayerCheated();

    /// Burnt NGTs tokens for the cheatings
    /// @param burntTokens burnt tokens
    event BurntTokens(uint burntTokens);

    /// Market closed after judge intervention
    /// @param marketResult market final result
    event ClosedAfterJudgement(MarketResult marketResult);

    // Functions

    /// Constructor
    /// @param _dso DSO wallet
    /// @param _token NGT token address
    constructor(address _dso, address _token) public {
        dso = _dso;
        ngt = NGT(_token);
    }

    /// Open a new market defined by the couple (player, startTime)
    /// @param _player player wallet
    /// @param _startTime initial timestamp of the market
    /// @param _referee referee wallet
    /// @param _maxLow lower limit of the maximum power consumed by player
    /// @param _maxUp upper limit of the maximum power consumed by player
    /// @param _revFactor revenue factor [NGT/kW]
    /// @param _penFactor penalty factor [NGT/kW]
    /// @param _stakedNGTs DSO staking of NGTs token
    /// @param _playerNGTs NGT amount that player will have to stake in order to successfully confirm the opening
    /// @param _revPercReferee referee revenue percentage
    function open(address _player,
                  uint _startTime,
                  address _referee,
                  uint _maxLow,
                  uint _maxUp,
                  uint _revFactor,
                  uint _penFactor,
                  uint _stakedNGTs,
                  uint _playerNGTs,
                  uint _revPercReferee) public {

        // create the idx hashing the player and the startTime
        uint idx = calcIdx(_player, _startTime);

        // only the dso is allowed to open a market
        require(msg.sender == dso);

        // check the market existence
        require(marketsFlag[idx] == false);

        // check the startTime timestamp
        require(now < _startTime);
        require(_checkStartTime(_startTime));

        // check the referee address
        require(_referee != address(0));
        require(_referee != dso);
        require(_referee != _player);

        // check the maximum limits
        require(_maxLow < _maxUp);

        // check the revenue factor
        require(_checkRevenueFactor(_maxUp, _maxLow, _revFactor, _stakedNGTs) == true);

        // check the dso tokens allowance
        require(_stakedNGTs <= ngt.allowance(dso, address(this)));

        // The market can try to start: its data are saved in the mapping
        marketsData[idx].startTime = _startTime;
        marketsData[idx].endTime = _calcEndTime(_startTime);
        marketsData[idx].referee = _referee;
        marketsData[idx].player = _player;
        marketsData[idx].maxPowerLower = _maxLow;
        marketsData[idx].maxPowerUpper = _maxUp;
        marketsData[idx].revenueFactor = _revFactor;
        marketsData[idx].penaltyFactor = _penFactor;
        marketsData[idx].dsoStaking = _stakedNGTs;
        marketsData[idx].playerStaking = _playerNGTs;
        marketsData[idx].tknReleasedToDso = 0;
        marketsData[idx].tknReleasedToPlayer = 0;
        marketsData[idx].revPercReferee = _revPercReferee;
        marketsData[idx].state = MarketState.WaitingConfirmToStart;
        marketsData[idx].result = MarketResult.NotDecided;
        marketsFlag[idx] = true;

        // DSO staking: allowed tokens are transferred from dso wallet to this smart contract
        ngt.transferFrom(dso, address(this), marketsData[idx].dsoStaking);

        emit Opened(_player, _startTime, idx);
    }

    /// Confirm to play the market opening, performed by the player
    /// @param idx market identifier
    /// @param stakedNGTs DSO staking of NGTs token
    function confirmOpening(uint idx, uint stakedNGTs) public {

        // check if the player is the sender
        require(msg.sender == marketsData[idx].player);

        // check if the market exists
        require(marketsFlag[idx] == true);

        // check if the NGTs amount declared by dso that has to be staked by the player is correct
        require(marketsData[idx].playerStaking == stakedNGTs);

        // check if the market is waiting for the player starting confirm
        require(marketsData[idx].state == MarketState.WaitingConfirmToStart);

        // check the player tokens allowance
        require(stakedNGTs <= ngt.allowance(marketsData[idx].player, address(this)));

        // check if it is not too late to confirm
        require(now <= marketsData[idx].startTime);

        // Player staking: allowed tokens are transferred from player wallet to this smart contract
        ngt.transferFrom(marketsData[idx].player, address(this), marketsData[idx].playerStaking);

        // The market is allowed to start
        marketsData[idx].state = MarketState.Running;

        emit ConfirmedOpening(marketsData[idx].player, marketsData[idx].startTime, idx);
    }

    /// Refund requested by the DSO (i.e. the player has not confirmed the market opening)
    /// @param idx market identifier
    function refund(uint idx) public {
        // only the DSO is allowed to request a refund
        require(msg.sender == dso);

        // check if the market exists
        require(marketsFlag[idx] == true);

        // the market has to be in WaitingConfirmToStart state
        require(marketsData[idx].state == MarketState.WaitingConfirmToStart);

        // check if the market startTime is passed
        require(marketsData[idx].startTime < now);

        // refund the DSO staking
        ngt.transfer(dso, marketsData[idx].dsoStaking);

        // Set the market result
        marketsData[idx].result = MarketResult.NotPlayed;

        // Set the market state
        marketsData[idx].state = MarketState.ClosedNotPlayed;

        emit RefundedDSO(dso, idx);
    }

    /// Settle the market, performed by dso
    /// @param idx market identifier
    /// @param powerPeak maximum power consumed by the player during the market
    function settle(uint idx, uint powerPeak) public {

        // check if the dso is the sender
        require(msg.sender == dso);

        // check if the market exists
        require(marketsFlag[idx] == true);

        // check if the market is running
        require(marketsData[idx].state == MarketState.Running);

        // check if the market period is already ended
        require(now >= marketsData[idx].endTime);

        marketsData[idx].powerPeakDeclaredByDso = powerPeak;
        marketsData[idx].state = MarketState.WaitingConfirmToEnd;

        emit Settled(marketsData[idx].player, marketsData[idx].startTime, idx, powerPeak);
    }

    /// Confirm the market settlement, performed by the player
    /// @param idx market identifier
    /// @param powerPeak maximum power consumed by the player during the market
    function confirmSettlement(uint idx, uint powerPeak) public {

        // check if the player is the sender
        require(msg.sender == marketsData[idx].player);

        // check if the market exists
        require(marketsFlag[idx] == true);

        // check if the market is waiting for the player ending confirm
        require(marketsData[idx].state == MarketState.WaitingConfirmToEnd);

        marketsData[idx].powerPeakDeclaredByPlayer = powerPeak;

        emit ConfirmedSettlement(marketsData[idx].player, marketsData[idx].startTime, idx, powerPeak);

        // check if the two peak declarations (DSO and player) are equal
        if(marketsData[idx].powerPeakDeclaredByDso == marketsData[idx].powerPeakDeclaredByPlayer) {

            // Finish the market sending the tokens to DSO and player according to the measured peak
            _decideMarket(idx);

            emit SuccessfulSettlement();
        }
        else {
            // The referee decision is requested
            marketsData[idx].state = MarketState.WaitingForTheReferee;

            emit UnsuccessfulSettlement(marketsData[idx].powerPeakDeclaredByDso, marketsData[idx].powerPeakDeclaredByPlayer);
        }
    }

    /// Decide the market final result
    /// @param idx market identifier
    function _decideMarket(uint idx) private {
        uint peak = marketsData[idx].powerPeakDeclaredByDso;
        uint tokensForDso;
        uint tokensForPlayer;
        uint peakDiff;

        // measured peak < lowerMax => PRIZE: the player takes all the DSO staking
        if(peak <= marketsData[idx].maxPowerLower) {
            tokensForDso = 0;
            tokensForPlayer = marketsData[idx].dsoStaking.add(marketsData[idx].playerStaking);

            // Set the market result as a player prize
            marketsData[idx].result = MarketResult.Prize;

            emit Prize(tokensForDso, tokensForPlayer);
        }
        // lowerMax <= measured peak <= upperMax => REVENUE: the player takes a part of the DSO staking
        else if(peak > marketsData[idx].maxPowerLower && peak <= marketsData[idx].maxPowerUpper) {
            // Calculate the revenue amount
            peakDiff = peak.sub(marketsData[idx].maxPowerLower);

            tokensForDso = peakDiff.mul(marketsData[idx].revenueFactor);

            tokensForPlayer = marketsData[idx].dsoStaking.sub(tokensForDso);

            tokensForPlayer = tokensForPlayer.add(marketsData[idx].playerStaking);

            // Set the market result as a player revenue
            marketsData[idx].result = MarketResult.Revenue;

            emit Revenue(tokensForDso, tokensForPlayer);
        }
        // measured peak > upperMax => PENALTY/CRASH: the DSO takes a part of/all the revenue staking
        else {
            // Calculate the penalty amount
            peakDiff = peak.sub(marketsData[idx].maxPowerUpper);

            tokensForDso = peakDiff.mul(marketsData[idx].penaltyFactor);

            // If the penalty exceeds the staking => the DSO takes it all
            if(tokensForDso >= marketsData[idx].playerStaking) {
                tokensForPlayer = 0;
                tokensForDso = marketsData[idx].dsoStaking.add(marketsData[idx].playerStaking);

                // Set the market result as a player penalty
                marketsData[idx].result = MarketResult.Crash;

                emit Crash(tokensForDso, tokensForPlayer);
            }
            else {
                tokensForPlayer = marketsData[idx].playerStaking.sub(tokensForDso);
                tokensForDso = tokensForDso.add(marketsData[idx].dsoStaking);

                // Set the market result as a player penalty
                marketsData[idx].result = MarketResult.Penalty;

                emit Penalty(tokensForDso, tokensForPlayer);
            }
        }

        _saveAndTransfer(idx, tokensForDso, tokensForPlayer);
    }

    /// Save the final result and transfer the tokens
    /// @param idx market identifier
    /// @param _tokensForDso NGTSs to send to DSO
    /// @param _tokensForPlayer NGTSs to send to player
    function _saveAndTransfer(uint idx, uint _tokensForDso, uint _tokensForPlayer) private {
        // save the amounts to send
        marketsData[idx].tknReleasedToDso = _tokensForDso;
        marketsData[idx].tknReleasedToPlayer = _tokensForPlayer;

        // Send tokens to dso
        if(marketsData[idx].result != MarketResult.Prize) {
            ngt.transfer(dso, marketsData[idx].tknReleasedToDso);
        }

        // Send tokens to player
        if(marketsData[idx].result != MarketResult.Crash) {
            ngt.transfer(marketsData[idx].player, marketsData[idx].tknReleasedToPlayer);
        }

        // Close the market
        marketsData[idx].state = MarketState.Closed;
        emit Closed(marketsData[idx].result);
    }

    /// Takes the final decision to close the market whene player and DSO do not agree about the settlement, performed by the referee
    /// @param idx market identifier
    /// @param _powerPeak maximum power consumed by the player during the market
    function performRefereeDecision(uint idx, uint _powerPeak) public {

        // the sender has to be the referee
        require(msg.sender == marketsData[idx].referee);

        // the market is waiting for the referee decision
        require(marketsData[idx].state == MarketState.WaitingForTheReferee);

        // Calculate the total staking
        uint tokensStaked = marketsData[idx].dsoStaking.add(marketsData[idx].playerStaking);

        // Calculate the tokens for the referee
        uint tokensForReferee = tokensStaked.div(uint(100).div(marketsData[idx].revPercReferee));

        // Calculate the tokens amount for the honest actor
        uint tokensForHonest = tokensStaked.sub(tokensForReferee);

        emit RefereeIntervention(marketsData[idx].player, marketsData[idx].startTime, idx);

        // Check if the DSO declared the truth (i.e. player cheated)
        if(marketsData[idx].powerPeakDeclaredByDso == _powerPeak)
        {
            marketsData[idx].result = MarketResult.PlayerCheating;

            // Send tokens to the honest DSO
            ngt.transfer(dso, tokensForHonest);

            emit PlayerCheated();
        }
        // Check if the player declared the truth (i.e. DSO cheated)
        else if(marketsData[idx].powerPeakDeclaredByPlayer == _powerPeak)
        {
            marketsData[idx].result = MarketResult.DSOCheating;

            // Send tokens to the honest player
            ngt.transfer(marketsData[idx].player, tokensForHonest);

            emit DSOCheated();
        }
        // Both dso and player are cheating, the token are sent to address(0) :D
        else {
            marketsData[idx].result = MarketResult.Cheaters;

            // There are no honest, the related tokens are burnt
            ngt.burn(tokensForHonest);

            emit DSOAndPlayerCheated();
            emit BurntTokens(tokensForHonest);
        }

        // Send tokens to referee
        ngt.transfer(marketsData[idx].referee, tokensForReferee);

        // Close the market
        marketsData[idx].state = MarketState.ClosedAfterJudgement;
        emit ClosedAfterJudgement(marketsData[idx].result);
    }

    /// Check the revenue factor
    /// @param _maxLow lower limit of the maximum power consumed by player
    /// @param _maxUp upper limit of the maximum power consumed by player
    /// @param _revFactor revenue factor [NGT/kW]
    /// @param _stakedNGTs DSO staking of NGTs token
    /// @return TRUE if the the checking is passed, FALSE otherwise
    function _checkRevenueFactor(uint _maxUp, uint _maxLow, uint _revFactor, uint _stakedNGTs) pure private returns(bool) {
        uint calcNGTs = _maxUp.sub(_maxLow);
        calcNGTs = calcNGTs.mul(_revFactor);

        // (_maxUp - _maxLow)*_revFactor == _stakedNGTs
        return calcNGTs == _stakedNGTs;
    }

    /// Check the startTime
    /// @param ts timestamp
    /// @return TRUE (timestamp related to a YYYY-MM-01 00:00:00 date), FALSE otherwise
    function _checkStartTime(uint _ts) pure private returns(bool) {
        return (getDay(_ts) == 1) && (getHour(_ts) == 0) && (getMinute(_ts) == 0) && (getSecond(_ts) == 0);
    }

    /// Calculate the endTime timestamp (it will be YYYY-MM-LAST_DAY_OF_THE_MONTH 23:59:59)
    /// @param ts starting market timestamp
    /// @return ending startime
    function _calcEndTime(uint _ts) pure private returns(uint) {
        return toTimestamp(getYear(_ts), getMonth(_ts), getDaysInMonth(getMonth(_ts), getYear(_ts)), 23, 59, 59);
    }

    /// Calculate the idx of market hashing an address (the player) and a timestamp (the market starting time)
    /// @param _addr address wallet
    /// @param _ts timestamp
    /// @return hash of the two inputs
    function calcIdx(address _addr, uint _ts) pure public returns(uint) {
        return uint(keccak256(abi.encodePacked(_addr, _ts)));
    }

    // Getters

    /// @param idx market identifier
    /// @return market state (0: None, 1: NotRunning, 2: WaitingConfirmToStart, 3: Running, 4: WaitingConfirmToEnd, 5: WaitingForTheReferee, 6: Closed, 7: ClosedAfterJudgement, 8: ClosedNotPlayed)
    function getState(uint _idx) view public returns(MarketState)       { return marketsData[_idx].state; }

    /// @param idx market identifier
    /// @return market final result (0: None, 1: NotDecided, 2: NotPlayed, 3: Prize, 4: Revenue, 5: Penalty, 6: Crash, 7: DSOCheating, 8: PlayerCheating, 9: Cheaters)
    function getResult(uint _idx) view public returns(MarketResult)     { return marketsData[_idx].result; }

    /// @param idx market identifier
    /// @return the player address
    function getPlayer(uint _idx) view public returns(address)          { return marketsData[_idx].player; }

    /// @param idx market identifier
    /// @return the referee address
    function getReferee(uint _idx) view public returns(address)         { return marketsData[_idx].referee; }

    /// @param idx market identifier
    /// @return the market starting timestamp
    function getStartTime(uint _idx) view public returns(uint)          { return marketsData[_idx].startTime; }

    /// @param idx market identifier
    /// @return the market ending timestamp
    function getEndTime(uint _idx) view public returns(uint)            { return marketsData[_idx].endTime; }

    /// @param idx market identifier
    /// @return the lower maximum limit
    function getLowerMaximum(uint _idx) view public returns(uint)       { return marketsData[_idx].maxPowerLower; }

    /// @param idx market identifier
    /// @return the upper maximum limit
    function getUpperMaximum(uint _idx) view public returns(uint)       { return marketsData[_idx].maxPowerUpper; }

    /// @param idx market identifier
    /// @return the revenue factor
    function getRevenueFactor(uint _idx) view public returns(uint)      { return marketsData[_idx].revenueFactor; }

    /// @param idx market identifier
    /// @return the penalty factor
    function getPenaltyFactor(uint _idx) view public returns(uint)      { return marketsData[_idx].penaltyFactor; }

    /// @param idx market identifier
    /// @return the DSO staked amount
    function getDsoStake(uint _idx) view public returns(uint)           { return marketsData[_idx].dsoStaking; }

    /// @param idx market identifier
    /// @return the player staked amount
    function getPlayerStake(uint _idx) view public returns(uint)        { return marketsData[_idx].playerStaking; }

    /// @param idx market identifier
    /// @return TRUE if the market exists, FALSE otherwise
    function getFlag(uint idx) view public returns(bool)                { return marketsFlag[idx];}
}
