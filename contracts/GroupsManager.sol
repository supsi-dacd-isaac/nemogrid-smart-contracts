pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./MarketsManager.sol";

/// Manager of markets groups
contract GroupsManager is Ownable{

    /// Address of the token
    address public token;

    /// Mapping containing the managers of the market groups
    mapping (address => MarketsManager) groups;

    /// Mapping to check the group existence
    mapping (address => bool) groupsFlags;

    // Events

    /// A group has been added
    /// @param dso The DSO wallet
    /// @param token The NemoGrid token address
    event AddedGroup(address dso, address token);

    /// Constructor
    /// @param _token The NemoGrid token address
    constructor(address _token) public {
        token = _token;
    }

    /// Add a markets group, defined by the couple (dso, token)
    /// @param _dso The DSO wallet
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

    /// @param _dso The DSO wallet
    /// @return TRUE if the group exists, FALSE otherwise
    function getFlag(address _dso) view public returns(bool)         { return groupsFlags[_dso]; }

    /// @param _dso The DSO wallet
    /// @return the group address
    function getAddress(address _dso) view public returns(address)   { return address(groups[_dso]); }
}
