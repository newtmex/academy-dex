import { useScaffoldReadContract } from "./scaffold-eth";
import { useAccount } from "wagmi";

export default function useGTokens() {
  const { address: userAddress } = useAccount();
  const { data: gTokens, refetch } = useScaffoldReadContract({
    contractName: "GTokens",
    functionName: "getGTokenBalance",
    args: [userAddress],
  });

  return { gTokens, refetch };
}
