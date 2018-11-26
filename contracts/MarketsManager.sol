pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./Markets.sol";

contract MarketsManager is Ownable{

    // Variables

    // token address
    address public token;

    // Markets mapping
    mapping (address => Markets) markets;
    mapping (address => bool) exists;

    // Functions

    // Constructor
    constructor(address _token) public {
        token = _token;
    }

    // Add a markets set: a markets set is defined by the triple (dso, player, token)
    function addMarketsSet(address _dso) onlyOwner public returns(address) {

        // Check if this markets set already exists
        require(exists[_dso] == false);

        // a set of markets is defined by the triple (dso, player, token)
        markets[_dso] = new Markets(_dso, token);
        exists[_dso] = true;

        // Return the address of the market set just created
        return address(markets[_dso]);
    }
}
