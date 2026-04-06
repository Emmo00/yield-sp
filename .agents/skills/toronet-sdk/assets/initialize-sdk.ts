import { initializeSDK } from "torosdk";

// Testnet
initializeSDK({ network: "testnet" });

// Mainnet
// initializeSDK({ network: "mainnet" });

// Custom URLs
// initializeSDK({
//   network: "mainnet",
//   baseURL: "https://custom-toronet.org",
//   connectWURL: "https://custom-connectw.com",
// });
