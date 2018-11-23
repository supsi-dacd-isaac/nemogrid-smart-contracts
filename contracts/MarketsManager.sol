pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./Markets.sol";

contract MarketsManager is Ownable{

    // Variables

    // Owner address
    address public owner;

    // DSO address
    address public dso;

    // token address
    address public token;

    // Markets mapping
    mapping (address => Markets) markets;
    mapping (address => bool) marketsFlag;

    // Functions

    // Constructor
    constructor(address _dso, address _token) public {

        owner = msg.sender;
        dso = _dso;
        token = _token;
    }

    // *********************************************************
    // Negotiation functions:

    // Add a markets set
    function add(address _player) onlyOwner public returns(address) {
        require(marketsFlag[_player] == false);

        // a set of markets is defined by the triple (dso, player, token)
        markets[_player] = new Markets(dso, token, _player);
        marketsFlag[_player] = true;

        return address(markets[_player]);
    }
}
