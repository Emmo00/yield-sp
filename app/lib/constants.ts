export type NetworkEnv = "mainnet" | "testnet";
export type ContractKey = "loan-vault" | "stablecoin";

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

export const CONTRACT_ADDRESSES = {
    mainnet: {
        "loan-vault": "0x1234567890abcdef1234567890abcdef12345678",
        stablecoin: "0xabcdef1234567890abcdef1234567890abcdef12",
    },
    testnet: {
        "loan-vault": "0xD19506397bFC56B0064fd967892ee6C44f8afA7b",
        stablecoin: "0xa07925A08bF15335a373bf2DdB1b2a26F1B13a20",
    },
} as const;

const TORONET_BASE_URLS: Record<NetworkEnv, string> = {
    mainnet: "https://www.toronet.org",
    testnet: "https://testnet.toronet.org",
};

const TORONET_RPC_URLS: Record<NetworkEnv, string> = {
    mainnet: "https://www.toronet.org/rpc/",
    testnet: toronetTestnet.rpcUrls.default.http[0],
};

export function getConfiguredNetwork(): NetworkEnv {
    const networkValue =
        process.env.NEXT_PUBLIC_NETWORK_ENV ?? process.env.NETWORK_ENV ?? "mainnet";

    return networkValue.toLowerCase() === "testnet" ? "testnet" : "mainnet";
}

export function getContractAddress(
    contract: ContractKey,
    network: NetworkEnv = getConfiguredNetwork(),
): string {
    return CONTRACT_ADDRESSES[network][contract];
}

export function getToronetBaseUrl(
    network: NetworkEnv = getConfiguredNetwork(),
): string {
    const envMainnet =
        process.env.NEXT_PUBLIC_TORONET_MAINNET_BASE_URL ??
        process.env.TORONET_MAINNET_BASE_URL;
    const envTestnet =
        process.env.NEXT_PUBLIC_TORONET_TESTNET_BASE_URL ??
        process.env.TORONET_TESTNET_BASE_URL;

    if (network === "testnet") {
        return envTestnet || TORONET_BASE_URLS.testnet;
    }

    return envMainnet || TORONET_BASE_URLS.mainnet;
}

export function getToronetRpcUrl(
    network: NetworkEnv = getConfiguredNetwork(),
): string {
    const envMainnet =
        process.env.NEXT_PUBLIC_TORONET_MAINNET_RPC_URL ??
        process.env.TORONET_MAINNET_RPC_URL;
    const envTestnet =
        process.env.NEXT_PUBLIC_TORONET_TESTNET_RPC_URL ??
        process.env.TORONET_TESTNET_RPC_URL;

    if (network === "testnet") {
        return envTestnet || TORONET_RPC_URLS.testnet;
    }

    return envMainnet || TORONET_RPC_URLS.mainnet;
}

