pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract NGT is ERC20Mintable, Ownable {
    using SafeMath for uint256;

    string public name = "NemoGrid Token";
    string public symbol = "NGT";
    uint8 public decimals = 18;
    mapping (address => bool) enabledAddresses;

    function enableAddress(address addressToEnable) onlyOwner public {
        enabledAddresses[addressToEnable] = true;
    }

    function disableAddress(address addressToDisable) onlyOwner public {
        enabledAddresses[addressToDisable] = false;
    }

    function getTokens(address dso, address player, uint stakeDso, uint stakePlayer) public {

        // check if the sender is enabled
        require(enabledAddresses[msg.sender] == true);

        // get the tokens
        _transfer(dso, msg.sender, stakeDso);
        _transfer(player, msg.sender, stakePlayer);
    }

    function returnTokens(address dso, address player, uint tokensForDso, uint tokensForPlayer) public {

        // check if the sender is enabled
        require(enabledAddresses[msg.sender] == true);

        // return the tokens
        _transfer(msg.sender, dso, tokensForDso);
        _transfer(msg.sender, player, tokensForPlayer);
    }
}
