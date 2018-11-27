pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./NGT.sol";

contract Markets is Ownable{

    using SafeMath for uint;

    // Enum definitions

    // State of the market
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

    // Result of the market
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

        // Revenue factor for the player (max_power_lower < max(P) < max_power_upper) (NMT/kW)
        uint revenueFactor;

        // Penalty factor for the player (max(P) > max_power_upper) (NMT/kW)
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

        // State of the market
        MarketState state;

        // Result of the market
        MarketResult result;
    }

    // Variables declaration

    // NGT token
    NGT public ngt;

    // DSO related to the markets
    address public dso;

    // Mappings related to markets data and flag
    mapping (uint => MarketData) marketsData;
    mapping (uint => bool) marketsFlag;

    // Functions

    // Constructor
    constructor(address _dso, address _token) public {
        dso = _dso;
        ngt = NGT(_token);
    }

    // *********************************************************
    // Negotiation functions:

    // open a market, defined by: dso, player, startTime, endTime
    function open(address _player, uint _startTime, uint _endTime, address _referee, uint _maxLow, uint _maxUp,
                  uint _revFactor, uint _penFactor, uint _stakedNGTs, uint _playerNGTs) public {

        // create the idx hashing the player and the startTime
        uint idx = uint(keccak256(abi.encodePacked(_player, _startTime)));

        // Only the sender is allowed to create a market
        require(msg.sender == dso);

        // The market does not exist
        require(marketsFlag[idx] == false);

        // check the times
        require(now < _startTime);
        require(_startTime < _endTime);

        // todo: add a checking on _startTime/_endTime to be sure they are the first and last days of a month

        // check the referee
        require(_referee != address(0));
        require(_referee != dso);
        require(_referee != _player);

        // check the maximum limits
        require(_maxLow < _maxUp);

        // todo: add checking on revenue factor
        // (_maxUp - _maxLow)*_revFactor == _stakedNGTs

        // check the dso tokens allowance
        require(_stakedNGTs <= ngt.allowance(dso, address(this)));

        // The market can try to start: its data are saved in the mapping
        marketsData[idx].startTime = _startTime;
        marketsData[idx].endTime = _endTime;
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
        marketsData[idx].state = MarketState.WaitingConfirmToStart;
        marketsData[idx].result = MarketResult.NotDecided;
        marketsFlag[idx] = true;

        // DSO staking: allowed tokens are transferred from dso wallet to this smart contract
        ngt.transferFrom(dso, address(this), marketsData[idx].dsoStaking);
    }

    // Confirm/not confirm to play the market, performed by the player
    function confirmOpening(uint idx, uint stakedNGTs) public {

        // check if the player is the sender
        require(msg.sender == marketsData[idx].player);

        // check if the market exists
        require(marketsFlag[idx] == true);

        // check if the NGTs amount declared by dso to be staked by the player is correct
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
    }

    // refund requested by the DSO (i.e. the player has not confirmed the market opening)
    function refund(uint idx) public {
        // Only the DSO is allowed to request a refund
        require(msg.sender == dso);

        // check if the market exists
        require(marketsFlag[idx] == true);

        // The market has to be in WaitingConfirmToStart state
        require(marketsData[idx].state == MarketState.WaitingConfirmToStart);

        // Check if the market startTime is passed
        require(marketsData[idx].startTime < now);

        // Refund the DSO staking
        ngt.transfer(dso, marketsData[idx].dsoStaking);

        // Set the market result
        marketsData[idx].result = MarketResult.NotPlayed;

        // Set the market state
        marketsData[idx].state = MarketState.ClosedNotPlayed;
    }

    // *********************************************************
    // Market solving functions:

    // Send maximum measured power, requesting to end the market
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
    }

    // Confirm the maximum power measured, performed by the player
    function confirmSettlement(uint idx, uint powerPeak) public {

        // check if the player is the sender
        require(msg.sender == marketsData[idx].player);

        // check if the market exists
        require(marketsFlag[idx] == true);

        // check if the market is waiting for the player ending confirm
        require(marketsData[idx].state == MarketState.WaitingConfirmToEnd);

        marketsData[idx].powerPeakDeclaredByPlayer = powerPeak;

        // check if the two peak declarations (DSO and player) are equal
        if(marketsData[idx].powerPeakDeclaredByDso == marketsData[idx].powerPeakDeclaredByPlayer) {

            // Finish the market sending the tokens to DSO and player according to the measured peak
            _decideMarket(idx);
        }
        else {
            // The referee decision is requested
            marketsData[idx].state = MarketState.WaitingForTheReferee;
        }
    }

    // The referees takes a decision to close the market
    function _decideMarket(uint idx) private {
        uint peak = marketsData[idx].powerPeakDeclaredByDso;
        uint tokensForDso;
        uint tokensForPlayer;
        uint peakDiff;

        // measured peak < lowerMax => PRIZE: the player takes all the DSO staking
        if(peak < marketsData[idx].maxPowerLower) {
            tokensForDso = 0;
            tokensForPlayer = marketsData[idx].dsoStaking.add(marketsData[idx].playerStaking);

            // Set the market result as a player prize
            marketsData[idx].result = MarketResult.Prize;
        }
        // lowerMax <= measured peak <= upperMax => REVENUE: the player takes a part of the DSO staking
        else if(peak >= marketsData[idx].maxPowerLower && peak <= marketsData[idx].maxPowerUpper) {
            // Calculate the revenue amount
            peakDiff = peak.sub(marketsData[idx].maxPowerLower);

            tokensForDso = peakDiff.mul(marketsData[idx].revenueFactor);

            tokensForPlayer = marketsData[idx].dsoStaking.sub(tokensForDso);

            tokensForPlayer = tokensForPlayer.add(marketsData[idx].playerStaking);

            // Set the market result as a player revenue
            marketsData[idx].result = MarketResult.Revenue;
        }
        // measured peak > upperMax => PENALTY: the DSO takes a part of the revenue staking
        else {
            // Calculate the penalty amount
            peakDiff = peak.sub(marketsData[idx].maxPowerUpper);

            tokensForDso = peakDiff.mul(marketsData[idx].penaltyFactor);

            // If the penalty tokens exceed the staking => the DSO takes it all
            if(tokensForDso >= marketsData[idx].playerStaking) {
                tokensForPlayer = 0;
                tokensForDso = marketsData[idx].dsoStaking.add(marketsData[idx].playerStaking);

                // Set the market result as a player penalty
                marketsData[idx].result = MarketResult.Penalty;
            }
            else {
                tokensForPlayer = marketsData[idx].playerStaking.sub(tokensForDso);
                tokensForDso = tokensForDso.add(marketsData[idx].dsoStaking);

                // Set the market result as a player penalty
                marketsData[idx].result = MarketResult.Penalty;
            }
        }

        _saveAndTransfer(idx, tokensForDso, tokensForPlayer);
    }

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
    }

    // The referees takes a decision to close the market
    function performRefereeDecision(uint idx, uint _powerPeak) public {

        // the sender has to be the referee
        require(msg.sender == marketsData[idx].referee);

        // the market is waiting for the referee decision
        require(marketsData[idx].state == MarketState.WaitingForTheReferee);

        // The referee decides taking into account the declared peaks
        uint totalStaking = marketsData[idx].dsoStaking.add(marketsData[idx].playerStaking);

        // Check if the DSO declared the truth (i.e. player cheated)
        if(marketsData[idx].powerPeakDeclaredByDso == _powerPeak)
        {
            marketsData[idx].result = MarketResult.DSOCheating;

            ngt.transfer(dso, totalStaking);
        }
        // Check if the player declared the truth (i.e. DSO cheated)
        else if(marketsData[idx].powerPeakDeclaredByPlayer == _powerPeak)
        {
            marketsData[idx].result = MarketResult.PlayerCheating;

            ngt.transfer(marketsData[idx].player, totalStaking);
        }
        // Both dso and player are cheating, the token are sent to address(0) :D
        else {
            marketsData[idx].result = MarketResult.Cheaters;

            // Burn the tokens
            ngt.burn(totalStaking);
        }

        // Close the market
        marketsData[idx].state = MarketState.ClosedAfterJudgement;
    }

    // Calculate the idx of market hashing an address (the player) and a timestamp (the market starting time)
    function calcIdx(address _addr, uint _ts) pure public returns(uint) {
        return uint(keccak256(abi.encodePacked(_addr, _ts)));
    }

    // Getters
    function getState(uint _idx) view public returns(MarketState)       { return marketsData[_idx].state; }
    function getResult(uint _idx) view public returns(MarketResult)     { return marketsData[_idx].result; }
    function getPlayer(uint _idx) view public returns(address)          { return marketsData[_idx].player; }
    function getReferee(uint _idx) view public returns(address)         { return marketsData[_idx].referee; }
    function getStartTime(uint _idx) view public returns(uint)          { return marketsData[_idx].startTime; }
    function getEndTime(uint _idx) view public returns(uint)            { return marketsData[_idx].endTime; }
    function getLowerMaximum(uint _idx) view public returns(uint)       { return marketsData[_idx].maxPowerLower; }
    function getUpperMaximum(uint _idx) view public returns(uint)       { return marketsData[_idx].maxPowerUpper; }
    function getRevenueFactor(uint _idx) view public returns(uint)      { return marketsData[_idx].revenueFactor; }
    function getPenaltyFactor(uint _idx) view public returns(uint)      { return marketsData[_idx].penaltyFactor; }
    function getDsoStake(uint _idx) view public returns(uint)           { return marketsData[_idx].dsoStaking; }
    function getPlayerStake(uint _idx) view public returns(uint)        { return marketsData[_idx].playerStaking; }
    function getFlag(uint idx) view public returns(bool)                { return marketsFlag[idx];}
}
