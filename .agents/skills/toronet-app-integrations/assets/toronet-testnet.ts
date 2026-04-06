export const toronetTestnet = {
  id: 54321,
  name: "Toronet Testnet",
  network: "Toronet testnet",
  iconUrl: "/toronet.svg",
  iconBackground: "#fff",
  nativeCurrency: {
    decimals: 18,
    name: "Toronet",
    symbol: "TORO",
  },
  rpcUrls: {
    public: { http: ["https://testnet.toronet.org/rpc/"] },
    default: { http: ["https://testnet.toronet.org/rpc/"] },
  },
  blockExplorers: {
    default: { name: "ToronetScan", url: "https://testnet.toronet.org/" },
  },
} as const;
