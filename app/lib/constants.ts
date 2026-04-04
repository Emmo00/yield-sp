export type NetworkEnv = "mainnet" | "testnet";
export type ContractKey = "loan-vault" | "stablecoin";

export const CONTRACT_ADDRESSES = {
    mainnet: {
        "loan-vault": "0x1234567890abcdef1234567890abcdef12345678",
        stablecoin: "0xabcdef1234567890abcdef1234567890abcdef12",
    },
    testnet: {
        "loan-vault": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        stablecoin: "0xa07925A08bF15335a373bf2DdB1b2a26F1B13a20",
    },
} as const;

const TORONET_BASE_URLS: Record<NetworkEnv, string> = {
    mainnet: "https://www.toronet.org",
    testnet: "http://testnet.toronet.org",
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

