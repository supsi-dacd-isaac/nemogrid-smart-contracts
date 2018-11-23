pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./NGT.sol";

contract Markets is Ownable{

    using SafeMath for uint;

    // Enum definitions

    // State of the market
    enum MarketState {
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
        // Address of a trusted referee, which decides the market if dso and player do not agree
        address referee;

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

    // NGT token
    NGT public ngt;

    // DSO related to the history
    address public dso;

    // Player related to the history
    address public player;

    // Markets data and existence flag mappings
    // The markets are indexed considering the month first day
    mapping (uint => MarketData) marketsData;
    mapping (uint => bool) marketsFlag;

    // Functions

    // Constructor
    constructor(address _dso, address _player, address _token) public {
        dso = _dso;
        player = _player;
        ngt = NGT(_token);
    }

    // *********************************************************
    // Negotiation functions:

    // open a market, defined by: dso, player, startTime, endTime
    function open(uint _startTime, uint _endTime, address _referee, uint _maxLow, uint _maxUp, uint _revFactor,
                  uint _penFactor, uint _stakedNGTs, uint _playerNGTs) public {
        // Only the DSO is allowed to create a market
        require(msg.sender == dso);

        // The market does not already exist
        require(marketsFlag[_startTime] == false);

        // check the times
        require(now < _startTime);
        require(_startTime < _endTime);

        // todo: add a checking on _startTime/_endTime to be sure they are the first and last days of a month

        // check the referee
        require(_referee != address(0));
        require(_referee != dso);
        require(_referee != player);

        // check the maximum limits
        require(_maxLow < _maxUp);

        // todo: add checking on revenue/penalty factors

        // check the dso tokens allowance
        require(_stakedNGTs <= ngt.allowance(dso, address(this)));

        // The market can try to start: its data are saved in the mapping
        marketsData[_startTime].state = MarketState.NotRunning;
        marketsData[_startTime].result = MarketResult.NotDecided;
        marketsData[_startTime].endTime = _endTime;
        marketsData[_startTime].referee = _referee;
        marketsData[_startTime].maxPowerLower = _maxLow;
        marketsData[_startTime].maxPowerUpper = _maxUp;
        marketsData[_startTime].revenueFactor = _revFactor;
        marketsData[_startTime].penaltyFactor = _penFactor;
        marketsData[_startTime].dsoStaking = _stakedNGTs;
        marketsData[_startTime].playerStaking = _playerNGTs;
        marketsData[_startTime].tknReleasedToDso = 0;
        marketsData[_startTime].tknReleasedToPlayer = 0;
        marketsData[_startTime].state = MarketState.WaitingConfirmToStart;
        marketsFlag[_startTime] = true;

        // DSO staking: allowed tokens are transferred from dso wallet to this smart contract
        ngt.transferFrom(dso, address(this), marketsData[_startTime].dsoStaking);
    }

    // Confirm/not confirm to play the market, performed by the player
    function confirmOpening(uint _startTime, uint _stakedNGTs) public {

        // check if the player is the sender
        require(msg.sender == player);

        // check if the NGTs amount declared by dso to be staked by the player is correct
        require(marketsData[_startTime].playerStaking == _stakedNGTs);

        // check if the market is waiting for the player starting confirm
        require(marketsData[_startTime].state == MarketState.WaitingConfirmToStart);

        // check if it is not too late to confirm
        require(now <= _startTime);

        // check the player tokens allowance
        require(_stakedNGTs <= ngt.allowance(player, address(this)));

        // The market is allowed to start
        marketsData[_startTime].state = MarketState.Running;

        // Player staking: allowed tokens are transferred from player wallet to this smart contract
        ngt.transferFrom(player, address(this), marketsData[_startTime].playerStaking);
    }

    // refund requested by the DSO (i.e. the player has not confirmed the market opening)
    function refund(uint _startTime) public {
        // Only the DSO is allowed to request a refund
        require(msg.sender == dso);

        // The market has to be in WaitingConfirmToStart state
        require(marketsData[_startTime].state == MarketState.WaitingConfirmToStart);

        // Check the if the market startTime is in the past
        require(_startTime < now);

        // Refund the DSO staking
        ngt.transfer(dso, marketsData[_startTime].dsoStaking);

        // Set the market result
        marketsData[_startTime].result = MarketResult.NotPlayed;

        // Set the market state
        marketsData[_startTime].state = MarketState.ClosedNotPlayed;
    }


    // *********************************************************
    // Market solving functions:

    // Send maximum measured power, requesting to end the market
    function settle(uint _startTime, uint _powerPeak) public {

        // check if the dso is the sender
        require(msg.sender == dso);

        // check if the market is running
        require(marketsData[_startTime].state == MarketState.Running);

        // check if the market period is already ended
        require(now >= marketsData[_startTime].endTime);

        marketsData[_startTime].powerPeakDeclaredByDso = _powerPeak;
        marketsData[_startTime].state = MarketState.WaitingConfirmToEnd;
    }

    // Confirm the maximum power measured, performed by the player
    function confirmSettlement(uint _startTime, uint _powerPeak) public {

        // check if the player is the sender
        require(msg.sender == player);

        // check if the market is waiting for the player ending confirm
        require(marketsData[_startTime].state == MarketState.WaitingConfirmToEnd);

        marketsData[_startTime].powerPeakDeclaredByPlayer = _powerPeak;

        // check if the two peak declarations (DSO and player) are equal
        if(marketsData[_startTime].powerPeakDeclaredByDso == marketsData[_startTime].powerPeakDeclaredByPlayer) {

            // Finish the market sending the tokens to DSO and player according to the measured peak
            _decideMarket(_startTime);
        }
        else {
            // The referee decision is requested
            marketsData[_startTime].state = MarketState.WaitingForTheReferee;
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

        // Send tokens to dso and player

        if(marketsData[idx].result != MarketResult.Prize) {
            ngt.transfer(dso, marketsData[idx].tknReleasedToDso);
        }

        if(marketsData[idx].result != MarketResult.Crash) {
            ngt.transfer(player, marketsData[idx].tknReleasedToPlayer);
        }

        // Close the market
        marketsData[idx].state = MarketState.Closed;
    }

    // The referees takes a decision to close the market
    function performRefereeDecision(uint _startTime, uint _powerPeak) public {

        // the sender has to be the referee
        require(msg.sender == marketsData[_startTime].referee);

        // the market is waiting for the referee decision
        require(marketsData[_startTime].state == MarketState.WaitingForTheReferee);

        // The referee decides taking into account the declared peaks
        uint totalStaking = marketsData[_startTime].dsoStaking.add(marketsData[_startTime].playerStaking);

        // Check if the DSO declared a true peak
        if(marketsData[_startTime].powerPeakDeclaredByDso == _powerPeak)
        {
            marketsData[_startTime].result = MarketResult.DSOCheating;

            ngt.transfer(dso, totalStaking);
        }
        // Check if the player declared a true peak
        else if(marketsData[_startTime].powerPeakDeclaredByPlayer == _powerPeak)
        {
            marketsData[_startTime].result = MarketResult.PlayerCheating;

            ngt.transfer(player, totalStaking);
        }
        // Both dso and player are cheating, the token are sent to address(0) :D
        else {
            marketsData[_startTime].result = MarketResult.Cheaters;

            // Burn the tokens
            ngt.burn(totalStaking);
        }

        // Close the market
        marketsData[_startTime].state = MarketState.ClosedAfterJudgement;
    }
}
