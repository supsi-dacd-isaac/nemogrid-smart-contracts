pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./MarketsManager.sol";

contract MarketsManager is Ownable{

    // Variables

    // token address
    address public token;

    // Markets mapping
    mapping (address => Markets) groups;
    mapping (address => bool) groupsFlags;

    // Functions

    // Constructor
    constructor(address _token) public {
        token = _token;
    }

    // Add a markets set: a markets set is defined by the triple (dso, player, token)
    function addMarketsSet(address _dso) onlyOwner public returns(address) {

        // The dso cannot be also the owner
        // todo add the tests
        require(owner() != _dso);

        // Check if this markets set already exists
        require(groupsFlags[_dso] == false);

        // a set of markets is defined by the triple (dso, player, token)
        groups[_dso] = new Markets(_dso, token);
        groupsFlags[_dso] = true;

        // Return the address of the market set just created
        return getAddress(_dso);
    }

    // View functions
    function getFlag(address _dso) view public returns(bool)         { return groupsFlags[_dso]; }
    function getAddress(address _dso) view public returns(address)   { return address(groups[_dso]); }
}
