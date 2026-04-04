---
description: To be used when asked to interact with smart contracts on toronet
# applyTo: 'To be used when asked to interact with smart contract on toronet with an api' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

# When to use these instructions

Use these instructions when asked to interact with smart contracts on toronet with an api. The instructions include examples of how to read and write transactions on toronet using the provided API endpoints.

# Read Transactions on Toronet

Use this guide when you want to read data from smart contracts on Toronet.

Smart contract queries from a frontend generally fall into two styles:

1. **React hook-based reads**, where your UI stays in sync with blockchain state automatically.
2. **Direct function calls**, where you fetch data imperatively inside your own functions, effects, or services.

With **wagmi**, you can use both styles. With **ethers.js**, the usual pattern is direct function calls through a provider and contract instance. Wagmi’s React docs describe `useReadContract` as a hook for calling read-only `view` or `pure` functions, while wagmi core also exposes imperative actions like `readContract` and `readContracts`. Ethers documents the `Provider` as the read-only blockchain access layer and `Contract` as the abstraction that maps contract methods into JavaScript calls. ([wagmi.sh][1])

### Wagmi

Wagmi is best when your frontend is a **React app** and you want contract reads to fit naturally into component state and lifecycle. Its React API includes hooks like `useReadContract`, `useReadContracts`, and `useWatchContractEvent`, and wagmi describes itself as a type-safe, modular toolkit for Ethereum apps. ([wagmi.sh][2])

### Ethers.js

Ethers.js is a general-purpose Ethereum library with a strong separation between **Provider** and **Signer**. A provider is used for reads, while a signer is used for actions that require account authority, such as writes or signatures. For frontend queries, you usually create a `JsonRpcProvider` or `BrowserProvider`, then create a `Contract` instance and call its read methods. ([Ethers Documentation][3])

Use ethers when:

* you want a straightforward library outside React hooks,
* you prefer manual control over when reads happen,
* you are building utility modules, SDKs, or service layers,
* your project already uses ethers. ([Ethers Documentation][4])

---

Querying with wagmi:

Wagmi supports both **hook-based querying** and **direct action-based querying**.

## A. Hook-based querying with wagmi

This is the best option when the value belongs directly in your React UI. The `useReadContract` hook is designed for read-only contract functions and returns the response along with useful request state. Wagmi also provides `useReadContracts` for multiple reads in one hook. ([wagmi.sh][1])

### Example: read one value with `useReadContract`

```tsx
import { useReadContract } from 'wagmi'
import { abi } from './abi'

const contractAddress = '0xYourContractAddress'

export function TokenName() {
  const { data, error, isLoading } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'name',
  })

  if (isLoading) return <p>Loading token name...</p>
  if (error) return <p>Could not load token name.</p>

  return <p>Token name: {data}</p>
}
```

### Example: read multiple values with `useReadContracts`

```tsx
import { useReadContracts } from 'wagmi'
import { abi } from './abi'

const contractAddress = '0xYourContractAddress'

export function TokenOverview() {
  const { data, error, isLoading } = useReadContracts({
    contracts: [
      {
        address: contractAddress,
        abi,
        functionName: 'name',
      },
      {
        address: contractAddress,
        abi,
        functionName: 'symbol',
      },
      {
        address: contractAddress,
        abi,
        functionName: 'totalSupply',
      },
    ],
  })

  if (isLoading) return <p>Loading token overview...</p>
  if (error) return <p>Failed to load token overview.</p>

  return (
    <div>
      <p>Name: {data?.[0]?.result}</p>
      <p>Symbol: {data?.[1]?.result}</p>
      <p>Total Supply: {data?.[2]?.result?.toString()}</p>
    </div>
  )
}
```

### Benefits of wagmi hooks

The main benefits are:

* they fit directly into React components,
* they make loading and error states easier to manage,
* they are cleaner for dashboards and live UI state,
* they reduce boilerplate compared with manual `useEffect` + `useState` patterns. Wagmi’s hook docs are specifically built around this React usage model. ([wagmi.sh][1])

This approach is best for:

* token detail pages,
* balance displays,
* protocol dashboards,
* claimable reward widgets,
* any read that should appear immediately in the UI.

## B. Direct function calls with wagmi

Wagmi also provides imperative actions through `@wagmi/core`, such as `readContract` and `readContracts`. This is useful when you do not want to tie the call directly to render output, or when you want to call the contract from a helper function, async service, event handler, or custom data loader. Wagmi documents both `readContract` and `readContracts` as core actions for read-only queries. ([wagmi.sh][5])

### Example: direct single read with wagmi `readContract`

```ts
import { readContract } from '@wagmi/core'
import { config } from './wagmiConfig'
import { abi } from './abi'

const contractAddress = '0xYourContractAddress'

export async function fetchTokenName() {
  const name = await readContract(config, {
    address: contractAddress,
    abi,
    functionName: 'name',
  })

  return name
}
```

### Example: direct multiple reads with wagmi `readContracts`

```ts
import { readContracts } from '@wagmi/core'
import { config } from './wagmiConfig'
import { abi } from './abi'

const contractAddress = '0xYourContractAddress'

export async function fetchTokenOverview() {
  const results = await readContracts(config, {
    contracts: [
      {
        address: contractAddress,
        abi,
        functionName: 'name',
      },
      {
        address: contractAddress,
        abi,
        functionName: 'symbol',
      },
      {
        address: contractAddress,
        abi,
        functionName: 'totalSupply',
      },
    ],
  })

  return {
    name: results[0].result,
    symbol: results[1].result,
    totalSupply: results[2].result,
  }
}
```

### Benefits of wagmi direct calls

This style is better when:

* you want contract reads inside utility functions,
* you are building custom abstractions,
* you want to fetch data in response to a button click,
* you want to keep blockchain logic outside your React components,
* you need batch reads but do not want a hook. Wagmi’s core actions are intended for this imperative style. ([wagmi.sh][5])

A practical rule is:

* use **hooks** when the result is part of component rendering,
* use **direct calls** when the result belongs in application logic, helper modules, or event-driven flows.

## C. Watching contract events with wagmi

Wagmi also supports event-driven frontend updates with `useWatchContractEvent`. This is useful when you want your UI to respond to newly emitted events such as `Transfer`, `Deposit`, `Claim`, or `Withdraw`. Wagmi documents this hook for watching contract events and handling new logs in React. ([wagmi.sh][6])

```tsx
import { useWatchContractEvent } from 'wagmi'
import { abi } from './abi'

const contractAddress = '0xYourContractAddress'

export function WatchTransfers() {
  useWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: 'Transfer',
    onLogs(logs) {
      console.log('New Transfer logs:', logs)
    },
  })

  return <p>Watching for transfers...</p>
}
```

This is especially useful for:

* live transaction feeds,
* refreshing balances after a transfer,
* updating claim history or payout activity,
* dashboards that should react to contract events without manual refresh.

---

Querying with ethers.js:

With ethers.js, the standard pattern is direct function calls. You create a **provider**, then create a **contract**, then call read methods on that contract. Ethers describes the provider as the read-only blockchain access layer and the contract as the abstraction that exposes onchain methods in JavaScript. ([Ethers Documentation][4])

## A. Direct reads with a JSON-RPC provider

This is the most common frontend read pattern when you have an RPC URL.

```ts
import { ethers } from 'ethers'
import { abi } from './abi'

const contractAddress = '0xYourContractAddress'
const provider = new ethers.JsonRpcProvider('https://your-rpc-url')

const contract = new ethers.Contract(contractAddress, abi, provider)

export async function fetchTokenData() {
  const name = await contract.name()
  const symbol = await contract.symbol()
  const totalSupply = await contract.totalSupply()

  return {
    name,
    symbol,
    totalSupply,
  }
}
```

### Benefits of this approach

This is good because:

* it is simple and explicit,
* it works well in any JavaScript or TypeScript environment,
* it is not tied to React,
* it fits service-layer code very well,
* it is easy to understand for most Ethereum developers. Ethers’ getting-started docs describe using `JsonRpcProvider` for custom RPC backends and using `Contract` as the normal abstraction for deployed contracts. ([Ethers Documentation][3])

## B. Reads through the browser wallet provider

If you want to use the injected wallet provider from the user’s browser, ethers v6 supports `BrowserProvider`. This is useful when your app already depends on the connected wallet context. Ethers’ provider docs reference `BrowserProvider` among the available provider types. ([Ethers Documentation][7])

```ts
import { ethers } from 'ethers'
import { abi } from './abi'

const contractAddress = '0xYourContractAddress'

export async function fetchWithWalletProvider() {
  if (!window.ethereum) {
    throw new Error('No wallet found')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const contract = new ethers.Contract(contractAddress, abi, provider)

  const owner = await contract.owner()
  return owner
}
```

### Benefits of browser-provider reads

This is useful when:

* the user is already connected with MetaMask or another wallet,
* you want queries to be tied to the user’s current selected chain,
* your app uses one provider source for both reads and writes.

The main downside is that wallet availability becomes part of your app’s read path. For general public reads, a normal RPC provider is often more reliable.

---

Wagmi vs ethers.js: when to use each:

## Choose wagmi when:

* your frontend is React,
* you want hooks,
* you want cleaner component state handling,
* you want multiple reads, event watchers, and React-oriented blockchain UX in one package. Wagmi’s React docs and homepage position it exactly this way. ([wagmi.sh][2])

## Choose ethers.js when:

* you want direct, manual control,
* you are writing helpers, services, or SDK-like modules,
* your app is not centered around React hooks,
* your codebase already uses ethers. Ethers documents provider/contract separation clearly for this style of usage. ([Ethers Documentation][4])

---

Best use cases for each style:

## Wagmi hooks are best for:

* balances on a profile page,
* token metadata in a component,
* protocol dashboard cards,
* reward widgets,
* live event-driven UI updates. ([wagmi.sh][1])

## Wagmi direct calls are best for:

* helper functions,
* button-triggered fetches,
* app services,
* pre-processing data before passing it into components,
* orchestrating several reads in one async function. ([wagmi.sh][5])

## Ethers direct calls are best for:

* generic frontend service layers,
* scripts,
* shared query modules,
* apps where React hooks are not the main abstraction,
* teams that prefer manual control over the query lifecycle. ([Ethers Documentation][3])


# Write Transactions on Toronet

use the api documentation in this postman collection to perform write transactions on toronet. The collection includes endpoints for signing messages, calling contract functions, and sending transactions. You can use the provided request bodies as templates for your API calls. Make sure to replace the placeholder values with actual data when making requests.

When building on testnet use the following URL: https://testnet.toronet.org/api/keystore/

When building on mainnet use the following URL: https://www.toronet.org/api/keystore/

{
  "info": {
    "_postman_id": "a72a2575-571c-4770-9b4e-b3f36dcbb7df",
    "name": "Toronet_smart_contract",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "_exporter_id": "18075091",
    "_collection_link": "https://go.postman.co/collection/18075091-a72a2575-571c-4770-9b4e-b3f36dcbb7df?source=collection_link"
  },
  "item": [
    {
      "name": "signMessage",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\r\n    \"op\": \"signMessage\",\r\n    \"params\": [\r\n        {\r\n            \"name\": \"addr\",\r\n            \"value\": \"\"\r\n        },\r\n        {\r\n            \"name\": \"pwd\",\r\n            \"value\": \"\"\r\n        },\r\n        {\r\n            \"name\": \"message\",\r\n            \"value\": \"Today is Monday\"\r\n        }\r\n\r\n    ]\r\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "https://www.toronet.org/api/keystore/",
          "protocol": "https",
          "host": [
            "www",
            "toronet",
            "org"
          ],
          "path": [
            "api",
            "keystore",
            ""
          ]
        }
      },
      "response": []
    },
    {
      "name": "getMessageSigner",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\r\n    \"op\": \"getMessageSigner\",\r\n    \"params\": [\r\n        {\r\n            \"name\": \"message\",\r\n            \"value\": \"Today is Monday\"\r\n        },\r\n        {\r\n            \"name\": \"signedmessage\",\r\n            \"value\": \"0x0b2ec732c1e328259f0f2e5c0cee064637212141102fca8f32ac7e92eceb251d199d60310dab75e8202e5e06a91408fc0d8a43aaaec057b8bed831de13e424c51c\"\r\n        }\r\n    ]\r\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "https://www.toronet.org/api/keystore/",
          "protocol": "https",
          "host": [
            "www",
            "toronet",
            "org"
          ],
          "path": [
            "api",
            "keystore",
            ""
          ]
        }
      },
      "response": []
    },
    {
      "name": "callContractFunction",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\r\n    \"op\": \"callContractFunction\",\r\n    \"params\": [\r\n        {\r\n            \"name\": \"addr\",\r\n            \"value\": \"\" //caller address\r\n        },\r\n        {\r\n            \"name\": \"pwd\",\r\n            \"value\": \"\" //caller password used to retrieve the private key onchain\r\n        },\r\n        {\r\n            \"name\": \"contractaddress\",\r\n            \"value\": \"0xead876c546d7569B86FA2eb7e3D8B15c5c63f0D1\" //contract address\r\n        },\r\n        {\r\n            \"name\": \"functionname\",\r\n            \"value\": \"approve\" //function name in the contract\r\n        },\r\n        {\r\n            \"name\": \"functionarguments\", //pipe delimited list of arguments - URIencoded\r\n            \"value\": \"0x314A59666559F9cF650ffE046B5479308B94aB12|1000000000000000000\"\r\n        },\r\n        {\r\n            \"name\": \"abi\", //JSON-Stringy contract ABI  - URIencoded\r\n            \"value\": \"%5B%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22spender%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%2C%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22uint256%22%2C%0A%09%09%09%09%22name%22%3A%20%22amount%22%2C%0A%09%09%09%09%22type%22%3A%20%22uint256%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22name%22%3A%20%22approve%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22bool%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22bool%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22nonpayable%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%2C%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22sender%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%2C%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22uint256%22%2C%0A%09%09%09%09%22name%22%3A%20%22val%22%2C%0A%09%09%09%09%22type%22%3A%20%22uint256%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22name%22%3A%20%22calculateTxFee%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22uint256%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22uint256%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22nonpayable%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%2C%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22to%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%2C%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22uint256%22%2C%0A%09%09%09%09%22name%22%3A%20%22value%22%2C%0A%09%09%09%09%22type%22%3A%20%22uint256%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22name%22%3A%20%22transfer%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22bool%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22bool%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22nonpayable%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%2C%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22sender%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%2C%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22recipient%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%2C%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22uint256%22%2C%0A%09%09%09%09%22name%22%3A%20%22amount%22%2C%0A%09%09%09%09%22type%22%3A%20%22uint256%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22name%22%3A%20%22transferFrom%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22bool%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22bool%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22nonpayable%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%2C%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22owner%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%2C%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22spender%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22name%22%3A%20%22allowance%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22uint256%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22uint256%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22view%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%2C%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22address%22%2C%0A%09%09%09%09%22name%22%3A%20%22addr%22%2C%0A%09%09%09%09%22type%22%3A%20%22address%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22name%22%3A%20%22balanceOf%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22uint256%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22uint256%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22view%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%2C%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%5D%2C%0A%09%09%22name%22%3A%20%22name%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22string%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22string%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22view%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%2C%0A%09%7B%0A%09%09%22inputs%22%3A%20%5B%5D%2C%0A%09%09%22name%22%3A%20%22symbol%22%2C%0A%09%09%22outputs%22%3A%20%5B%0A%09%09%09%7B%0A%09%09%09%09%22internalType%22%3A%20%22string%22%2C%0A%09%09%09%09%22name%22%3A%20%22%22%2C%0A%09%09%09%09%22type%22%3A%20%22string%22%0A%09%09%09%7D%0A%09%09%5D%2C%0A%09%09%22stateMutability%22%3A%20%22view%22%2C%0A%09%09%22type%22%3A%20%22function%22%0A%09%7D%0A%5D\"\r\n        }\r\n    ]\r\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "https://www.toronet.org/api/keystore/",
          "protocol": "https",
          "host": [
            "www",
            "toronet",
            "org"
          ],
          "path": [
            "api",
            "keystore",
            ""
          ]
        }
      },
      "response": []
    }
  ]
}
