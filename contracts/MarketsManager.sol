pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./MarketsHistory.sol";

contract MarketsManager is Ownable{

    // Variables

    // Owner address
    address public owner;

    // DSO address
    address public dso;

    // Markets mapping
    mapping (address => MarketsHistory) marketsHistories;
    mapping (address => bool) marketsHistoriesFlag;

    // Functions

    // Constructor
    constructor(address _dso) public {

        owner = msg.sender;
        dso = _dso;

    }

    // *********************************************************
    // Negotiation functions:

    // Add a markets history
    function add(address _player) onlyOwner public returns(address) {
        require(marketsHistoriesFlag[_player] == false);

        marketsHistories[_player] = new MarketsHistory(dso, _player);
        marketsHistoriesFlag[_player] = true;

        return address(marketsHistories[_player]);
    }

}
