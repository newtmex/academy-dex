// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../common/libs/Fee.sol";
import "../common/libs/Slippage.sol";
import "../common/libs/TokenPayments.sol";

import "./contexts/AddLiquidity.sol";

import "../common/Amm.sol";
import "./Errors.sol";
import "./SafePrice.sol";
import "./Interface.sol";
import "./Knowable.sol";

import { LpToken } from "../modules/LpToken.sol";
import "../common/utils.sol";

uint256 constant RPS_DIVISION_CONSTANT = 1e36;

/**
 * @title Pair
 * @dev This contract manages a trading pair in the DEX, handling liquidity, trading, and fee mechanisms.
 */
contract Pair is IPair, Ownable, KnowablePair {
	using SafePriceUtil for SafePriceData;
	using FeeUtil for FeeUtil.Values;

	// Reserve data
	uint256 public deposits;
	uint256 public sales;
	uint256 private depValuePerShare;

	uint256 public lpSupply;

	ERC20 public immutable tradeToken;
	IBasePair basePair;

	mapping(address => SafePriceData) safePrices;

	uint256 constant MIN_MINT_DEPOSIT = 4_000;

	event LiquidityAdded(
		address indexed from,
		uint256 amount,
		uint256 liqAdded
	);
	event SellExecuted(
		address indexed from,
		address indexed to,
		uint256 amountIn,
		uint256 amountOut,
		uint256 fee
	);

	/**
	 * @dev Constructor for initializing the Pair contract.
	 * @param tradeToken_ Address of the trade token.
	 * @param basePairAddr Address of the base pair.
	 */
	constructor(address tradeToken_, address basePairAddr) {
		require(tradeToken_ != address(0), "Pair: Invalid trade token address");
		require(basePairAddr != address(0), "Pair: Invalid base pair address");

		require(isERC20(tradeToken_), "Pair: Invalid trade token");
		tradeToken = ERC20(tradeToken_);

		_setBasePair(basePairAddr);
	}

	function _setBasePair(address basePairAddr) internal virtual {
		basePair = IBasePair(basePairAddr);
		require(
			isERC20(address(Pair(basePairAddr).tradeToken())),
			"Pair: Invalid base pair contract"
		);
	}

	modifier onlyBasePair() {
		require(msg.sender == address(basePair), "not allowed");
		_;
	}

	/**
	 * @dev Internal function to check and receive a payment.
	 * @param payment Payment details.
	 * @param from Address from which payment is received.
	 */
	function _checkAndReceivePayment(
		ERC20TokenPayment calldata payment,
		address from
	) internal {
		_checkAndReceivePayment(payment, from, MIN_MINT_DEPOSIT);
	}

	function _checkAndReceivePayment(
		ERC20TokenPayment calldata payment,
		address from,
		uint256 min
	) internal {
		if (payment.token != tradeToken || payment.amount < min) {
			revert("Pair: Bad received payment");
		}

		TokenPayments.receiveERC20(payment, from);
	}

	function _getReserves()
		internal
		view
		returns (uint256 paymentTokenReserve, uint256 baseTokenReserve)
	{
		return (reserve(), basePair.reserve());
	}

	function _getLiqAdded(
		ERC20TokenPayment calldata payment
	) internal view returns (uint256) {
		(
			uint256 paymentTokenReserve,
			uint256 baseTokenReserve
		) = _getReserves();

		// In case of initial liquidity
		paymentTokenReserve = paymentTokenReserve <= 0
			? payment.amount
			: paymentTokenReserve;

		return Amm.quote(payment.amount, paymentTokenReserve, baseTokenReserve);
	}

	function _takeFromReserve(uint256 amount) internal returns (uint256 taken) {
		if (sales >= amount) {
			sales -= amount;
			return amount;
		}

		if ((deposits + sales) >= amount) {
			taken = amount;
			_takeFromDeposits(taken - sales);
			sales = 0;
		} else {
			revert("Amount to be taken is too large");
		}
	}

	event BurntFees(address indexed pair, uint256 fee);

	/**
	 * @notice Takes fee and update balances of beneficiaries
	 * @dev This must be called on the out pair side
	 * @param referrer the user address to receive part of fee
	 * @param receiver the address buying this token
	 * @param amount amount to compute and deduct fee from
	 * @param totalFeePercent the fee percentage
	 */
	function takeFeesAndTransferTokens(
		address receiver,
		address referrer,
		uint256 amount,
		uint256 totalFeePercent
	) external isKnownPair returns (uint256 amountOut, uint256 toBurn) {
		_takeFromReserve(amount);

		uint256 fee = (totalFeePercent * amount) / FeeUtil.MAX_PERCENT;
		amountOut = amount - fee;

		require(amountOut != 0, "Pair: Zero out amount");

		FeeUtil.Values memory values = FeeUtil.splitFee(fee);

		toBurn = values.toBurnValue;
		// Distribute values
		{
			if (referrer != address(0) && values.referrerValue > 0) {
				tradeToken.transfer(referrer, values.referrerValue);
			} else {
				toBurn += values.referrerValue;
			}

			// Increasing sales genrally implies the `toBurn`
			// is available for ecosystem wide usage
			require(toBurn > 0, "Pair: Swap amount too low");
			sales += toBurn;

			// Give liqProviders value
			if (lpSupply > 0) {
				_addToDeposits(values.liqProvidersValue);
			} else {
				sales += values.liqProvidersValue;
			}

			// Send bought tokens to receiver
			tradeToken.transfer(receiver, amountOut);
		}
		emit BurntFees(address(this), toBurn);
	}

	function _executeSell(
		uint256 amountIn,
		address from,
		address referrer,
		Pair outPair,
		uint256 slippage,
		uint256 totalFeePercent
	) private returns (uint256 burntFee) {
		uint256 inTokenReserve = reserve();
		uint256 outTokenReserve = outPair.reserve();

		uint256 amountOutMin = Amm.quote(
			Slippage.compute(amountIn, slippage),
			inTokenReserve,
			outTokenReserve
		);
		require(outTokenReserve > amountOutMin, "Pair: not enough reserve");

		{
			safePrices[address(outPair)].updateSafePrice(
				inTokenReserve,
				outTokenReserve
			);
		}

		uint256 initialK = Amm.calculateKConstant(
			inTokenReserve,
			outTokenReserve
		);

		uint256 amountOut = 0;
		{
			uint256 amountOutOptimal = Amm.getAmountOut(
				amountIn,
				inTokenReserve,
				outTokenReserve
			);
			(amountOut, burntFee) = outPair.takeFeesAndTransferTokens(
				from,
				referrer,
				amountOutOptimal,
				totalFeePercent
			);

			require(amountOut >= amountOutMin, "Pair: Slippage Exceeded");

			sales += amountIn;
		}

		uint256 newK = Amm.calculateKConstant(reserve(), outPair.reserve());
		require(initialK <= newK, "ERROR_K_INVARIANT_FAILED");

		emit SellExecuted(
			from,
			address(outPair),
			amountIn,
			amountOut,
			totalFeePercent
		);
	}

	function _insertLiqValues(AddLiquidityContext memory context) internal {
		lpSupply += context.liq;
		_addToDeposits(context.deposit);
	}

	function _addLiq(ERC20TokenPayment calldata wholePayment) internal virtual {
		uint256 liqAdded = _getLiqAdded(wholePayment);

		(
			uint256 paymentTokenReserve,
			uint256 baseTokenReserve
		) = _getReserves();

		SafePriceData storage safePrice = safePrices[address(basePair)];
		safePrice.updateSafePrice(paymentTokenReserve, baseTokenReserve);

		uint256 initialK = Amm.calculateKConstant(
			paymentTokenReserve,
			baseTokenReserve
		);

		_insertLiqValues(
			AddLiquidityContext({ deposit: wholePayment.amount, liq: liqAdded })
		);

		// Check K values
		(
			uint256 newPaymentTokenReserve,
			uint256 newBaseTokenReserve
		) = _getReserves();
		uint256 newK = Amm.calculateKConstant(
			newPaymentTokenReserve,
			newBaseTokenReserve
		);

		require(newK > initialK, "Pair: K Invariant Failed");
	}

	function _takeFromDeposits(uint256 deduction) internal {
		uint256 rpsDecrease = (deduction * RPS_DIVISION_CONSTANT) / lpSupply;
		require(
			rpsDecrease > 0 &&
				rpsDecrease <= depValuePerShare &&
				deduction <= deposits,
			"Pair: Invalid deposits deduction"
		);

		depValuePerShare -= rpsDecrease;
		deposits -= deduction;
	}

	function _addToDeposits(uint256 addition) internal {
		uint256 rpsIncrease = (addition * RPS_DIVISION_CONSTANT) / lpSupply;

		require(rpsIncrease > 0, "Pair: Invalid deposit addition");

		depValuePerShare += rpsIncrease;
		deposits += addition;
	}

	/**
	 * @notice Adds liquidity to the pair.
	 * @param wholePayment Details of the payment for adding liquidity.
	 * @param from Address from which liquidity is added.
	 * @return liqAdded Amount of liquidity added.
	 */
	function addLiquidity(
		ERC20TokenPayment calldata wholePayment,
		address from
	) external onlyOwner returns (uint256 liqAdded, uint256 rps) {
		_checkAndReceivePayment(wholePayment, from);

		uint256 initalLp = lpSupply;

		rps = depValuePerShare;
		_addLiq(wholePayment);

		require(lpSupply > initalLp, "Pair: invalid liquidity addition");
		liqAdded = lpSupply - initalLp;

		emit LiquidityAdded(from, wholePayment.amount, liqAdded);
	}

	/**
	 * @notice Removes liquidity from the pool and claims the corresponding deposit.
	 * @dev This function updates the LP's liquidity balance and claims a proportionate amount of the deposit.
	 *      It ensures that the LP's deposit value per share is up-to-date before calculating the deposit to be claimed.
	 * @param liquidity The current liquidity balance of the LP token, including attributes like `depValuePerShare`.
	 * @param liqToRemove The amount of liquidity to be removed from the pool.
	 * @param from The address from which the liquidity is being removed.
	 * @return liq The updated liquidity balance after removal.
	 * @return depositClaimed The amount of deposit claimed by the LP.
	 */
	function removeLiquidity(
		LpToken.LpBalance memory liquidity,
		uint256 liqToRemove,
		address from
	)
		external
		onlyOwner
		returns (LpToken.LpBalance memory liq, uint256 depositClaimed)
	{
		require(liquidity.amount > 0, "Pair: LP balance is zero");
		require(
			liqToRemove <= liquidity.amount && liqToRemove <= lpSupply,
			"Pair: Invalid liquidity removal amount"
		);

		// Calculate the total deposit that can be claimed based on the updated depValuePerShare
		uint256 totalDepositClaimed = 0;
		if (liquidity.attributes.depValuePerShare < depValuePerShare) {
			totalDepositClaimed =
				((depValuePerShare - liquidity.attributes.depValuePerShare) *
					liquidity.amount) /
				RPS_DIVISION_CONSTANT;
		}

		// Update the global deposits after claiming
		_takeFromDeposits(totalDepositClaimed);

		// Reduce global lpSupply by the LP's total liquidity amount
		lpSupply -= liquidity.amount;

		// Update the LP's deposit value per share to the current depValuePerShare
		liquidity.attributes.depValuePerShare = depValuePerShare;

		// Calculate the deposit to be claimed based on the liquidity being removed
		depositClaimed = (liqToRemove * totalDepositClaimed) / liquidity.amount;
		liquidity.amount -= liqToRemove;

		// If there is remaining liquidity, update the pool with the remaining deposit and liquidity
		if (liquidity.amount > 0) {
			_insertLiqValues(
				AddLiquidityContext({
					deposit: totalDepositClaimed - depositClaimed,
					liq: liquidity.amount
				})
			);
		}

		// Transfer the claimed deposit to the `from` address
		if (depositClaimed > 0) {
			require(
				tradeToken.transfer(from, depositClaimed),
				"Pair: Deposit transfer failed"
			);
		}

		// Return the updated liquidity balance and claimed deposit
		return (liquidity, depositClaimed);
	}

	/**
	 * @notice Executes a sell order.
	 * @param caller Address of the caller.
	 * @param referrerOfCaller Address of the referrer of the caller.
	 * @param inPayment Details of the payment for the sell order.
	 * @param outPair Address of the pair to sell to.
	 * @param slippage Maximum slippage allowed.
	 * @param totalFeePercent Total fee percentage.
	 */
	function sell(
		address caller,
		address referrerOfCaller,
		ERC20TokenPayment calldata inPayment,
		Pair outPair,
		uint256 slippage,
		uint256 totalFeePercent
	) external onlyOwner returns (uint256 burntFee) {
		_checkAndReceivePayment(inPayment, caller, 0);
		burntFee = _executeSell(
			inPayment.amount,
			caller,
			referrerOfCaller,
			outPair,
			slippage,
			totalFeePercent
		);
	}

	/**
	 * @notice Returns the total amount of tradeToken that can be bought from this Pair.
	 * @return The reserve amount.
	 */
	function reserve() public view returns (uint256) {
		return deposits + sales;
	}
}
