pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

contract NGT is ERC20Mintable {
    using SafeMath for uint256;

    string public name = "NemoGrid Token";
    string public symbol = "NGT";
    uint8 public decimals = 18;
}
