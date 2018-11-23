pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./NGT.sol";
import "./Market.sol";

contract MarketsHistory is Ownable{

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
                        ClosedAfterJudgement    // Market closed after referee judgement
                     }

    // Result of the market
    enum MarketResult {
                        NotDecided,     // The market is not ended
                        Winning,        // The player takes all the NGTs staked by the DSO
                        Revenue,        // The player takes a part of the NGTs staked by the DSO
                        Penalty,        // The DSO takes a part of the NGTs staked by the player
                        AllToDSO,       // The referee assigns the NGT staked by the player to the DSO
                        AllToPlayer,    // The referee assigns the NGT staked by the DSO to the player
                        Cheaters        // The referee decides that both DSO and the player will be refunded
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
    MarketData public marketData;

    // NGT token
    NGT public ngt;

    // Variables

    // Owner address
    address public owner;

    // DSO related to the history
    address public dso;

    // Player related to the history
    address public player;

    // Markets data mapping (startTime => data)
    mapping (uint => MarketData) marketsData;

    // Markets existence flag (startTime => bool)
    mapping (uint => bool) marketsFlag;

    // Functions

    // Constructor
    constructor(address _dso, address _player, address _token) public {
        owner = msg.sender;
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

        // The market does not exist
        require(marketsFlag[_startTime] == false);

        // check the times
        require(_startTime > now);
        require(_endTime > _startTime);

        // check the referee
        require(_referee != address(0));
        require(_referee != dso);
        require(_referee != player);

        // check the maximum limits
        require(_maxLow < _maxUp);

        // check it the dso tokens allowance for this contract is enough to start the market
        require(_stakedNGTs <= ngt.allowance(dso, address(this)));

        // Save the market data in the mapping (the markets are indexed considering the month first day)
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
        require(marketData.playerStaking == _stakedNGTs);

        // check if the market is waiting for the player starting confirm
        require(marketData.state == MarketState.WaitingConfirmToStart);

        // check if it is not too late to confirm
        require(now <= _startTime);

        // check it the player tokens allowance for this contract is enough to start the market
        require(_stakedNGTs <= ngt.allowance(player, address(this)));

        // The market is allowed to start
        marketData.state = MarketState.Running;

        // Player staking: allowed tokens are transferred from player wallet to this smart contract
        ngt.transferFrom(player, address(this), marketsData[_startTime].playerStaking);
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
        require(marketData.state == MarketState.WaitingConfirmToEnd);

        marketsData[_startTime].powerPeakDeclaredByPlayer = _powerPeak;

        // check if the two peak declarations (DSO and player) are equal
        if(marketsData[_startTime].powerPeakDeclaredByDso == marketsData[_startTime].powerPeakDeclaredByPlayer) {

            // Finish the market sending properly the token to DSO and player

            // Define the values to send back according to the power peak
            uint tokensForDso = 0;
            uint tokensForPlayer = 0;

            marketsData[_startTime].tknReleasedToDso = tokensForDso;
            marketsData[_startTime].tknReleasedToPlayer = tokensForPlayer;

            // Send back the tokens to dso and player
            ngt.transfer(dso, marketsData[_startTime].tknReleasedToDso);
            ngt.transfer(player, marketsData[_startTime].tknReleasedToPlayer);

            // Close the market
            marketsData[_startTime].state = MarketState.Closed;
        }
        else {
            // The referee decision is requested
            marketsData[_startTime].state = MarketState.WaitingForTheReferee;
        }
    }

    // The referees takes a decision to close the market
    function performRefereeDecision(uint _startTime, uint _powerPeak) public {

        // the sender has to be the referee
        require(msg.sender == marketData.referee);

        // the market is waiting for the referee decision
        require(marketsData[_startTime].state == MarketState.WaitingForTheReferee);

        // The referee decides taking into account the declared peaks
        uint totalStaking = marketsData[_startTime].dsoStaking.add(marketsData[_startTime].playerStaking);

        // Check if the DSO declared a true peak
        if(marketsData[_startTime].powerPeakDeclaredByDso == _powerPeak)
        {
            marketsData[_startTime].result = MarketResult.AllToDSO;

            ngt.transfer(dso, totalStaking);
        }
        // Check if the player declared a true peak
        else if(marketsData[_startTime].powerPeakDeclaredByPlayer == _powerPeak)
        {
            marketsData[_startTime].result = MarketResult.AllToPlayer;

            ngt.transfer(player, totalStaking);
        }
        // Both dso and player are cheating, the token are sent to address(0) :D
        else {
            marketsData[_startTime].result = MarketResult.Cheaters;

            ngt.transfer(address(0), totalStaking);
        }

        // Close the market
        marketsData[_startTime].state = MarketState.ClosedAfterJudgement;
    }
}
