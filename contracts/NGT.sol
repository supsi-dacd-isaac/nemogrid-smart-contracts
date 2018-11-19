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

    mapping (bytes32 => uint) stakingsDso;
    mapping (bytes32 => uint) stakingsPlayer;

    function enableAddress(address addressToEnable) onlyOwner public {
        enabledAddresses[addressToEnable] = true;
    }

    function disableAddress(address addressToDisable) onlyOwner public {
        enabledAddresses[addressToDisable] = false;
    }

    function getTokens(address dso, address player, uint stakeDso, uint stakePlayer) public {

        // check if only the sender is enabled and all the addresses different
        require(checkAddresses(dso, player));

        // get the tokens
        _transfer(dso, msg.sender, stakeDso);
        _transfer(player, msg.sender, stakePlayer);
    }

    function returnTokens(address dso, address player, uint tokensForDso, uint tokensForPlayer) public {

        // check if only the sender is enabled and all the addresses different
        require(checkAddresses(dso, player));

        // return the tokens
        _transfer(msg.sender, dso, tokensForDso);
        _transfer(msg.sender, player, tokensForPlayer);
    }

    function checkAddresses(address dso, address player) private returns(bool) {
        bool ch1 = enabledAddresses[msg.sender] == true;
        bool ch2 = enabledAddresses[dso] == false;
        bool ch3 = enabledAddresses[player] == false;
        bool ch4 = msg.sender != dso;
        bool ch5 = msg.sender != player;
        bool ch6 = dso != player;

        return ch1 && ch2 && ch2 && ch3 && ch4 && ch5 && ch6;
    }

    // todo THE STAKED VALUES HAS TO BE SAVED IN THE NGT CONTRACT IN ORDER TO CORRECTLY SETTLE THE MARKETS
}
