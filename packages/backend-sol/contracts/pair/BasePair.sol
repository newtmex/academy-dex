// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./Pair.sol";
import { ADEX } from "../ADexToken/ADEX.sol";
import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// @title DeployBasePair
/// @notice Library to deploy new instances of the `BasePair` contract.
library DeployBasePair {
	/// @notice Deploys a new instance of the `BasePair` contract.
	/// @dev Deploys a new `ADEX` token and passes its address to the `BasePair` contract.
	/// @return A new instance of the `BasePair` contract.
	function newBasePair(
		address proxyAdmin,
		address initialOwner
	) external returns (BasePair) {
		address adexImplementation = address(new ADEX());
		address basePairImpl = address(new BasePair());

		TransparentUpgradeableProxy adexProxy = new TransparentUpgradeableProxy(
			adexImplementation,
			proxyAdmin,
			abi.encodeWithSignature("initialize(address)", initialOwner)
		);
		TransparentUpgradeableProxy basePairProxy = new TransparentUpgradeableProxy(
				basePairImpl,
				proxyAdmin,
				abi.encodeWithSignature("initialize(address)", adexProxy)
			);

		return BasePair(address(basePairProxy));
	}
}

/**
 * @title BasePair
 * @dev This contract represents a base pair in the DEX, implementing mintable tokens and fee burning mechanisms.
 * @notice Inherits from the `Pair` contract and provides additional functionality for adding liquidity and setting up the base pair.
 */
contract BasePair is Pair {
	/// @notice Initializes the `BasePair` contract with the address of the `ADEX` token.
	/// @param adexAddress The address of the `ADEX` token contract.
	function initialize(address adexAddress) public {
		initialize(adexAddress, address(this));
	}

	/// @notice Internal function to add liquidity to the base pair.
	/// @dev Overrides the `_addLiq` function from the `Pair` contract.
	/// @param wholePayment The payment details including the amount of tokens to add as liquidity.
	function _addLiq(TokenPayment calldata wholePayment) internal override {
		uint256 value = wholePayment.amount;
		_insertLiqValues(AddLiquidityContext({ deposit: value, liq: value }));
	}

	/// @notice Internal function to set the base pair address.
	/// @dev Overrides the `_setBasePair` function from the `Pair` contract but does nothing as this contract is the base pair.
	/// @param basePairAddr The address of the base pair, which is not used in this override.
	function _setBasePair(address basePairAddr) internal override {
		// This is the base pair, no action needed
	}
}
