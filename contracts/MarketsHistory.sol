pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./Market.sol";

contract MarketsHistory is Ownable{

    // Variables

    // Owner address
    address public owner;

    // DSO related to the history
    address public dso;

    // Player related to the history
    address public player;

    // Markets mapping
    mapping (uint => Market) markets;
    mapping (uint => bool) marketsFlag;

    // Functions

    // Constructor
    constructor(address _dso, address _player) public {
        owner = msg.sender;
        dso = _dso;
        player = _player;

    }

    // create a market, defined by: dso, player, startTime, endTime
    function createMarket(uint _startTime, uint _endTime, address _referee, uint _maxLow, uint _maxUp, uint _revFactor,
                          uint _penFactor, uint _stakedNGTs, uint _playerNGTs) public returns(address) {
        // todo: add some require

        // Only the DSO is allowed to create a market
        require(msg.sender == dso);

        // The market does not exist
        require(marketsFlag[_startTime] == false);

        // check the times
        require(_startTime > now);
        require(_endTime > _startTime);

        // check the referee
        require(_referee != address(0));

        // check the maximum limits
        require(_maxLow < _maxUp);


        // markets indexed considering the first day of the month
        markets[_startTime] = new Market(dso, player, _startTime, _endTime, _referee, _maxLow, _maxUp, _revFactor,
                                         _penFactor, _stakedNGTs, _playerNGTs);
        marketsFlag[_startTime] = true;

        // return the market address just created
        return address(markets[_startTime]);
    }
}
