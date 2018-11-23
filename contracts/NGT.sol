pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract NGT is ERC20Mintable, Ownable {
    using SafeMath for uint;

    string public name = "NemoGrid Token";
    string public symbol = "NGT";
    uint8 public decimals = 18;
    mapping (address => bool) enabledAddresses;

    mapping (bytes32 => uint) stakingsDso;
    mapping (bytes32 => uint) stakingsPlayer;
}
