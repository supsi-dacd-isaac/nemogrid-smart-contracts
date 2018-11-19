pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./NGT.sol";

contract Market is Ownable{

    // Variables

    // Owner address
    address public owner;

    // DSO (distribution system operator) address
    address public dso;

    // Player address, i.e. the element playing the market with the DSO
    address public player;

    // Starting time of the market (timestamp)
    uint public startTime;

    // Ending time of the market (timestamp)
    uint public endTime;

    // State of the market
    enum MarketState {
                        NotRunning,             // Market not running
                        WaitingConfirmToStart,  // Waiting for player confirm to start
                        Running,                // Market running
                        WaitingConfirmToEnd,    // Waiting for player confirm to end the market and assign the tokens
                        WaitingForTheJudge      // Waiting for judge decision
                     }

    // Result of the market
    enum MarketResult {
                        NotDecided,     // The market is not ended
                        Winning,        // The player takes all the NGTs staked by the DSO
                        Revenue,        // The player takes a part of the NGTs staked by the DSO
                        Penalty,        // The DSO takes a part of the NGTs staked by the player
                        JudgeOKDSO,     // The judge assigns the NGT staked by the player to the DSO
                        JudgeOKPlayer,  // The judge assigns the NGT staked by the DSO to the player
                        JudgeDeuce      // The judge decide that both DSO and the player will be refunded
                      }

    // Market data
    struct MarketData {
        // Address of a trusted referee, which decides the market if dso and player do not agree
        address referee;

        // Lower maximum power threshold (W)
        uint maxPowerLower;

        // Upper maximum power threshold (W)
        uint maxPowerUpper;

        // Maximum measured power
        uint maxMeasuredPower;

        // Revenue factor for the player (max_power_lower < max(P) < max_power_upper) (NMT/kW)
        uint revenueFactor;

        // Penalty factor for the player (max(P) > max_power_upper) (NMT/kW)
        uint penaltyFactor;

        // Amount staked by the DSO
        uint dsoStaking;

        // Amount staked by the player
        uint playerStaking;

        // State of the market
        MarketState state;

        // Result of the market
        MarketResult result;
    }
    MarketData public marketData;

    // NGT token
    NGT public ngt;

    // Events

    // Functions

    // Constructor
    constructor(address _dso,
                address _player,
                uint _startTime,
                uint _endTime,
                address _referee,
                uint _maxLow,
                uint _maxUp,
                uint _revFactor,
                uint _penFactor,
                uint _stakedNGTs,
                uint _playerNGTs) public {
        owner = msg.sender;

        dso = _dso;
        player = _player;
        startTime = _startTime;
        endTime = _endTime;

        // Set the initial state
        marketData.state = MarketState.NotRunning;
        marketData.result = MarketResult.NotDecided;

        // request to play the market
        open(_referee, _maxLow, _maxUp, _revFactor, _penFactor, _stakedNGTs, _playerNGTs);
    }

    // *********************************************************
    // Negotiation functions:

    // Open the market
    function open(address _referee, uint _maxLow, uint _maxUp, uint _revFactor, uint _penFactor,
                  uint _stakedNGTs, uint _playerNGTs) private {

        // check if the dso is the sender
        require(msg.sender == dso);

        // check if the market is not running
        require(marketData.state == MarketState.NotRunning);

        // save data and change the market s
        marketData.referee = _referee;
        marketData.maxPowerLower = _maxLow;
        marketData.maxPowerUpper = _maxUp;
        marketData.revenueFactor = _revFactor;
        marketData.penaltyFactor = _penFactor;
        marketData.dsoStaking = _stakedNGTs;
        marketData.playerStaking = _playerNGTs;
        marketData.state = MarketState.WaitingConfirmToStart;

        // staking of the DSO tokens
        // ....
    }

    // Confirm/not confirm to play the market, performed by the player
    function confirmOpening(bool confirm, uint stakedNGTs) public {

        // check if the player is the sender
        require(msg.sender == player);

        // check if the NGTs amount declared by dso to be staked by the player is correct
        require(marketData.playerStaking == stakedNGTs);

        // check if the market is waiting for the player starting confirm
        require(marketData.state == MarketState.WaitingConfirmToStart);

        // check if it is not too late to confirm
        require(now <= startTime);

        marketData.state = MarketState.Running;

        // staking of the player tokens
        // .....
    }

    // Refund dso with the staked tokens (in case the market was not confirmed by the player)
    function refundDso() public {

        // check if the player is the dso
        require(msg.sender == dso);

        // check if the market is in the right state, i.e. waiting for the player starting confirm
        require(marketData.state == MarketState.WaitingConfirmToStart);

        // check if it is too late to confirm
        require(now > startTime);

        // refund the staked token, this market (dso-player-startTime-endTime) has not be played
        // .....
    }

    // *********************************************************
    // Market solving functions:

    // Send maximum measured power, requesting to end the market
    function settle(uint _powerPeak) public {

        // check if the dso is the sender
        require(msg.sender == dso);

        // check if the market is running
        require(marketData.state == MarketState.Running);

        marketData.maxMeasuredPower = _powerPeak;
        marketData.state = MarketState.WaitingConfirmToEnd;
    }

    // Confirm the maximum power measured, performed by the player
    function confirmSettlement(uint _powerPeak) public {

        // check if the player is the sender
        require(msg.sender == player);

        // check if the market is waiting for the player ending confirm
        require(marketData.state == MarketState.WaitingConfirmToEnd);


        if(marketData.maxMeasuredPower == _powerPeak){

            // Finish the market sending properly the token to DSO and player
            // .....

            // Close definitely the market
            marketData.state = MarketState.NotRunning;
        }
        else {
            // The referee decision is requested
            marketData.state = MarketState.WaitingForTheJudge;
        }
    }

    // The referees takes a decision
    function performRefereeDecision(uint _powerPeak) public {

        require(msg.sender == marketData.referee);
        require(marketData.state == MarketState.WaitingForTheJudge);

        // Referee judges
        // ....

        // Close definitely the market
        marketData.state = MarketState.NotRunning;
    }
}
