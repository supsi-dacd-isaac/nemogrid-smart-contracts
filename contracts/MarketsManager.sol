pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./Markets.sol";

contract MarketsManager is Ownable{

    // Variables

    // token address
    address public token;

    // Markets mapping
    struct MarketList {
        mapping (address => Markets) markets;
        mapping (address => bool) exists;
    }
    mapping (address => MarketList) list;

    // Functions

    // Constructor
    constructor(address _token) public {
        token = _token;
    }

    // Add a markets set: a markets set is defined by the triple (dso, player, token)
    function addMarketsSet(address _dso, address _player) onlyOwner public returns(address) {

        // Check if this markets set already exists
        require(list[_dso].exists[_player] == false);

        // a set of markets is defined by the triple (dso, player, token)
        list[_dso].markets[_player] = new Markets(_dso, _player, token);
        list[_dso].exists[_player] = true;

        // Return the address of the market set just created
        return address(list[_dso].markets[_player]);
    }
}
