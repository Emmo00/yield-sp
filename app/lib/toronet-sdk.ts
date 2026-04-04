import { initializeSDK } from "torosdk";

import {
  getConfiguredNetwork,
  getToronetBaseUrl,
  type NetworkEnv,
} from "@/app/lib/constants";

let activeNetwork: NetworkEnv | null = null;

export function ensureToronetSDK(network: NetworkEnv = getConfiguredNetwork()): NetworkEnv {
  if (activeNetwork === network) {
    return network;
  }

  initializeSDK({
    network,
    baseURL: getToronetBaseUrl(network),
  });

  activeNetwork = network;
  return network;
}
