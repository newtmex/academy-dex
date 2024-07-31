import { useCallback, useEffect, useMemo, useState } from "react";
import { TokenData } from "./types";
import BigNumber from "bignumber.js";
import { useFormik } from "formik";
import RcSlider from "rc-slider";
import useSWR from "swr";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useSpendERC20 } from "~~/hooks/useSpendERC20";
import { formatAmount } from "~~/utils/formatAmount";

export const SLIPPAGE_DIVISOR = 10_000;

export const useSlippageAdjuster = () => {
  const [slippage, setSlippage] = useState(0.01);
  const applySlippage = useCallback(
    (value: BigNumber.Value) => new BigNumber(value).multipliedBy(1 - slippage).integerValue(BigNumber.ROUND_FLOOR),
    [slippage],
  );

  const slippageSlider = useMemo(
    () => (
      <div className="mb-3 form-group" style={{ width: "100%" }}>
        <label htmlFor="splippage">Slippage: {(slippage * 100).toFixed(2)} %</label>
        <RcSlider
          defaultValue={slippage * SLIPPAGE_DIVISOR}
          step={25}
          min={10}
          max={1000}
          onChange={value => {
            setSlippage((value as number) / SLIPPAGE_DIVISOR);
          }}
        />
      </div>
    ),
    [slippage],
  );

  return {
    applySlippage,
    slippageSlider,
    slippage,
  };
};

export const useSwapableTokens = ({
  address,
  fromToken,
  toToken,
}: {
  address?: string;
  fromToken?: TokenData;
  toToken?: TokenData;
}) => {
  const client = usePublicClient();
  const { data: router } = useDeployedContractInfo("Router");

  // Function to fetch token data
  const fetchTokenData = async (tokenAddress: string): Promise<TokenData> => {
    if (!client) {
      throw new Error("Client not set");
    }
    if (!address) {
      throw new Error("User address not loaded");
    }
    if (!router) {
      throw new Error("Router data not loaded");
    }

    // FIXME improve this call
    const [identifier, balance, decimals, pairAddr] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "symbol",
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
      }),
      client.readContract({
        address: router.address,
        abi: router.abi,
        functionName: "tokensPairAddress",
        args: [tokenAddress],
      }),
    ]);

    // TODO Construct icon source URL based on token identifier
    const iconSrc = ``;

    return {
      pairAddr,
      tradeTokenAddr: tokenAddress,
      identifier,
      balance: balance.toString(),
      iconSrc,
      decimals,
    };
  };

  // Fetch the list of tradeable token addresses from the Router contract
  const { data: tokenAddresses } = useScaffoldReadContract({
    contractName: "Router",
    functionName: "tradeableTokens",
  });

  const {
    data: fetchedTokens,
    mutate,
    isLoading,
  } = useSWR(tokenAddresses || null, tokenAddresses => Promise.all(tokenAddresses.map(fetchTokenData)), {
    fallbackData: [],
    keepPreviousData: true,
  });

  // Filter out `fromToken` and `toToken` from the fetched tokens
  const filteredTokens = fetchedTokens?.filter(
    token => token.identifier !== fromToken?.identifier && token.identifier !== toToken?.identifier,
  );

  return {
    updateSwapableTokens: mutate,
    tokens: filteredTokens,
    isTokensLoaded: !isLoading,
  };
};

export const useSwapTokensForm = ({
  fromToken,
  toToken,
  sendBalance,
  slippage: slippage_,
}: {
  fromToken?: TokenData;
  toToken?: TokenData;
  sendBalance: string;
  slippage: BigNumber.Value;
}) => {
  const { address } = useAccount();
  const { updateSwapableTokens } = useSwapableTokens({ address });

  const slippage = parseUnits(slippage_.toString(), SLIPPAGE_DIVISOR.toString().length - 1);

  const client = usePublicClient();
  const { data: router } = useDeployedContractInfo("Router");
  const { writeContractAsync: writeRouter } = useScaffoldWriteContract("Router");
  const { checkApproval } = useSpendERC20({ token: fromToken });

  const { handleSubmit, handleChange, values, setFieldValue, setFieldError, errors, touched, resetForm } = useFormik({
    initialValues: {
      sendAmt: "",
      receiveAmt: "",
      feePercent: "",
    },
    onSubmit: async ({ sendAmt }, { setFieldError, resetForm }) => {
      try {
        if (!fromToken || !toToken || !router) {
          throw new Error("Missing necessary data for the swap");
        }

        const amtToSpend = parseUnits(BigNumber(sendAmt).toFixed(fromToken.decimals), fromToken.decimals);
        await checkApproval(amtToSpend);

        await writeRouter({
          functionName: "swap",
          gas: 1_000_000n,
          args: [{ token: fromToken.tradeTokenAddr, amount: amtToSpend }, toToken.pairAddr, slippage],
        });

        updateSwapableTokens();
        resetForm();
      } catch (error: any) {
        setFieldError("sendAmt", error.toString());
      }
    },
  });

  const sendAmountHaserror = (errors.sendAmt || errors.receiveAmt) && touched.sendAmt;

  const { isValidating: isCalculatingReceiveAmt, error: receiveAmtCalcErr } = useSWR(
    !!+values.sendAmt && toToken && fromToken && client && router
      ? {
          sendAmt: parseUnits(BigNumber(values.sendAmt).toFixed(fromToken.decimals), fromToken.decimals),
          toToken,
          fromToken,
          slippage,
          client,
          router,
        }
      : null,
    async ({ sendAmt, fromToken, toToken, slippage, client, router }) => {
      const amountOut = await client.readContract({
        abi: router.abi,
        address: router.address,
        functionName: "estimateOutAmount",
        args: [fromToken.pairAddr, toToken.pairAddr, sendAmt, slippage],
      });

      const feePercent = await client.readContract({
        abi: router.abi,
        address: router.address,
        functionName: "computeFee",
        args: [fromToken.pairAddr, sendAmt],
      });

      setFieldValue(
        "receiveAmt",
        formatAmount({
          input: amountOut,
          decimals: toToken.decimals,
        }),
      );
      setFieldValue(
        "feePercent",
        formatAmount({
          input: feePercent,
          decimals: 2,
          digits: 2,
        }),
      );
    },
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      refreshInterval: 6_000,
      loadingTimeout: 1900,
    },
  );

  const onMax = useCallback(() => {
    setFieldValue("sendAmt", sendBalance);
  }, [sendBalance]);

  // Update form with receiveAmt errors if any
  useEffect(() => {
    setFieldError("receiveAmt", receiveAmtCalcErr?.toString());
  }, [receiveAmtCalcErr]);

  return {
    handleSubmit,
    handleChange,
    onMax,
    resetForm,
    sendAmountHaserror,
    isCalculatingReceiveAmt,
    values,
    errors,
  };
};
