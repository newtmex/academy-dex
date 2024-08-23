// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IRouter {
	function claimRewards(
		uint256[] memory nonces
	) external returns (uint256 totalClaimed, uint256[] memory newNonces);

	function getClaimableRewardsByNonces(
		uint256[] memory nonces
	) external view returns (uint256 totalClaimable);

	function tokenIsListed(address tokenAddress) external view returns (bool);
}
