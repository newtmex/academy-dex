import { useMemo } from "react";
import { useFormik } from "formik";
import RcSlider from "rc-slider";
import Select from "react-select";
import { useAccount, useWriteContract } from "wagmi";
import { useModalToShow } from "~~/components/Modals";
import { useSwapableTokens } from "~~/components/Swap/hooks";
import TxButton from "~~/components/TxButton";
import { useBasePairAddr } from "~~/hooks/routerHooks";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { LpBalancesWithId } from "~~/hooks/useLpTokens";
import { prettyFormatAmount } from "~~/utils/formatAmount";

export default function StakingModal({
  basePairLPs,
  otherPairsLPs,
}: {
  basePairLPs: LpBalancesWithId;
  otherPairsLPs: LpBalancesWithId;
}) {
  const { closeModal } = useModalToShow();
  const { address: userAddress } = useAccount();

  const { writeContractAsync } = useWriteContract();
  const { data: Governance } = useDeployedContractInfo("Governance");
  const { data: LpToken } = useDeployedContractInfo("LpToken");
  const { data: canSpendLp } = useScaffoldReadContract({
    contractName: "LpToken",
    functionName: "isApprovedForAll",
    args: [userAddress, Governance?.address],
  });

  const { values, setFieldValue, isValid } = useFormik({
    initialValues: {
      lpPayments: undefined as { token: string; amount: bigint; nonce: bigint }[] | undefined,
      epochsLock: 180,
    },
    onSubmit: ({ lpPayments, epochsLock }) => {
      console.log({ epochsLock, lpPayments });
    },
  });

  const onStake = async () => {
    if (!Governance || !LpToken || canSpendLp == undefined) {
      throw new Error("Contracts not loaded");
    }

    if (!values.lpPayments) {
      throw new Error("Must select lpPayments");
    }

    !canSpendLp &&
      (await writeContractAsync({
        abi: LpToken.abi,
        address: LpToken.address,
        functionName: "setApprovalForAll",
        args: [Governance.address, true],
      }));

    return writeContractAsync({
      abi: Governance.abi,
      address: Governance.address,
      functionName: "enterGovernance",
      args: [values.lpPayments, BigInt(values.epochsLock)],
    });
  };

  const { tokenMap } = useSwapableTokens({});
  const { basePairAddr } = useBasePairAddr();
  const basePairIdentifier = tokenMap.get(basePairAddr ?? "")?.identifier;

  const lpTokens = useMemo(
    () =>
      [...basePairLPs, ...otherPairsLPs].map(({ amount, nonce, identifier }) => ({
        value: { amount, nonce, token: LpToken?.address },
        label: `${identifier} ${prettyFormatAmount(amount.toString())}`,
      })),
    [basePairLPs, otherPairsLPs, LpToken?.address],
  );

  return (
    <>
      <button className="close" onClick={() => closeModal()} type="button">
        <span className="close-label">Close</span>
        <span className="os-icon os-icon-close"></span>
      </button>
      <div className="onboarding-side-by-side">
        <div className="onboarding-media">
          <img alt="" src="img/bigicon5.png" width="200px" />
        </div>

        <div className="onboarding-content with-gradient">
          <h4 className="onboarding-title">Stake Your Assets</h4>
          <div className="onboarding-text">
            Stake your LP Tokens with enough {basePairIdentifier} LP assets to earn more rewards and participate in
            platform governance
          </div>
          <form>
            <div className="mb-3 form-group" style={{ width: "100%" }}>
              <label htmlFor="splippage">Number of Epochs to Lock tokens: {values.epochsLock}</label>
              <RcSlider
                defaultValue={values.epochsLock}
                step={25}
                min={30}
                max={1080}
                onChange={value => {
                  setFieldValue("epochsLock", value);
                }}
              />
            </div>
            <div className="row">
              {lpTokens.length > 0 && (
                <div className="col-sm-12">
                  <div className="form-group">
                    <Select
                      name="lpPayments"
                      onChange={tokens => {
                        const payments = [];

                        for (const { value } of tokens) {
                          if (value.amount > 0) {
                            payments.push(value);
                          }
                        }

                        setFieldValue("lpPayments", payments);
                      }}
                      styles={{
                        option: styles => {
                          return { ...styles, color: "black" };
                        },
                      }}
                      isMulti
                      options={lpTokens}
                    />
                  </div>
                </div>
              )}
            </div>

            <TxButton
              disabled={!isValid || !values.lpPayments?.length}
              btnName="Stake"
              onClick={() => onStake()}
              onComplete={async () => {
                await closeModal();
              }}
              className="btn btn-primary"
            />
          </form>
        </div>
      </div>
    </>
  );
}
