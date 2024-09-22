// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { LaunchPair } from "./LaunchPair.sol";
import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

library DeployLaunchPair {
	/// @notice Deploys a new instance of the `LaunchPair` contract using an upgradeable proxy.
	/// @param _lpToken The address of the LP token to be associated with the LaunchPair.
	/// @param proxyAdmin The address of the ProxyAdmin.
	/// @return A new instance of the `LaunchPair` contract.
	function newLaunchPair(
		address _lpToken,
		address proxyAdmin
	) external returns (LaunchPair) {
		// Deploy the implementation contract
		LaunchPair launchPairImpl = new LaunchPair();

		// Deploy the proxy and point it to the implementation
		TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
			address(launchPairImpl), // Implementation address
			proxyAdmin, // Admin for the proxy
			abi.encodeWithSignature("initialize(address)", _lpToken) // Initializer data
		);

		// Cast the proxy to the LaunchPair type and return it
		return LaunchPair(address(proxy));
	}
}
