pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./MarketsManager.sol";

contract GroupsManager is Ownable{

    // Variables

    // token address
    address public token;

    // Markets mapping
    mapping (address => MarketsManager) groups;
    mapping (address => bool) groupsFlags;

    // Events
    event AddedGroup(address dso, address token);

    // Constructor
    constructor(address _token) public {
        token = _token;
    }

    // Add a markets group, defined by the couple (dso, token)
    function addGroup(address _dso) onlyOwner public {

        // The dso cannot be also the owner
        require(owner() != _dso);

        // Check if this markets set already exists
        require(groupsFlags[_dso] == false);

        // a set of markets is defined by the triple (dso, player, token)
        groups[_dso] = new MarketsManager(_dso, token);
        groupsFlags[_dso] = true;

        emit AddedGroup(_dso, token);
    }

    // View functions
    function getFlag(address _dso) view public returns(bool)         { return groupsFlags[_dso]; }
    function getAddress(address _dso) view public returns(address)   { return address(groups[_dso]); }
}
