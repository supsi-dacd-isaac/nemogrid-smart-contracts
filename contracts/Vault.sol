pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Vault is Ownable {
    using SafeMath for uint;

    uint public stakedAmountDso;
    uint public stakedAmountPlayer;
    address public market;
    address public dso;
    address public player;

    constructor (address _market, address _dso, address _player) onlyOwner public {
        market = _market;
        dso = _dso;
        player = _player;
    }

    function stakeDso(address _dso) public payable {

        require(dso == _dso);

        stakedAmountDso = stakedAmountDso.add(msg.value);
    }

    function stakePlayer(address _player) public payable {

        require(player == _player);

        stakedAmountPlayer = stakedAmountPlayer.add(msg.value);
    }

}
