// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintableERC20 is ERC20, Ownable {
	constructor(
		string memory name_,
		string memory symbol_
	) ERC20(name_, symbol_) {}

	function mint(address to, uint256 amt) external onlyOwner {
		_mint(to, amt);
	}
}
