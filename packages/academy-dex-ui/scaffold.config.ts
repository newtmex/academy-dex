import * as chains from "viem/chains";

export type ScaffoldConfig = {
  targetNetworks: readonly chains.Chain[];
  defaultTargetNetwork: number;
  pollingInterval: number;
  alchemyApiKey: string;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
};

const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [
    {
      ...chains.hardhat,
      nativeCurrency: { decimals: 18, name: "EDU Coin", symbol: "dEDU" },
    },
    {
      id: 656476,
      name: "opencampus",
      nativeCurrency: { decimals: 18, name: "EDU Coin", symbol: "EDU" },
      rpcUrls: {
        default: { http: ["https://rpc.open-campus-codex.gelato.digital"] },
        public: { http: ["https://rpc.open-campus-codex.gelato.digital"] },
      },
      testnet: true,
    },
    {
      id: 12227332,
      name: "NeoX T4",
      nativeCurrency: { decimals: 18, name: "NeoX Coin", symbol: "GAS" },
      rpcUrls: {
        default: { http: ["https://neoxt4seed1.ngd.network"], webSocket: ["wss://neoxt4wss1.ngd.network"] },
        public: { http: ["https://neoxt4seed1.ngd.network"], webSocket: ["wss://neoxt4wss1.ngd.network"] },
      },
      blockExplorers: { default: { url: "https://xt4scan.ngd.network/", name: "NEOX Chain explorer" } },
      testnet: true,
    },
  ],

  defaultTargetNetwork: Number(process.env.NEXT_PUBLIC_DEFAULT_TARGET_NETWORK ?? 1),

  // The interval at which your front-end polls the RPC servers for new data
  // it has no effect if you only target the local network (default is 4000)
  pollingInterval: 30000,

  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF",

  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",

  // Only show the Burner Wallet when running on hardhat network
  onlyLocalBurnerWallet: true,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
