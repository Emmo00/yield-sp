# ToroSDK Reference

This file contains practical guidance for the `toronet-sdk` skill.

## What ToroSDK is for

ToroSDK is a TypeScript-based toolkit for interacting with the ToroNet blockchain.

Use it when the task involves ToroNet-specific SDK workflows such as:

- wallet creation and import
- wallet password verification
- wallet key retrieval
- blockchain and transaction queries
- token and currency operations
- KYC
- fiat deposit flows
- virtual wallet flows
- TNS and role management
- product and payment operations
- multi-chain bridge operations
- SDK-based ToroForge deployment

## Installation

Install ToroSDK with:

```bash
npm install torosdk
```

## Network configuration

Initialize the SDK before using it.

### Testnet

```typescript
import { initializeSDK } from "torosdk";

initializeSDK({ network: "testnet" });
```

### Mainnet

```typescript
import { initializeSDK } from "torosdk";

initializeSDK({ network: "mainnet" });
```

### Custom URLs

```typescript
import { initializeSDK } from "torosdk";

initializeSDK({
  network: "mainnet",
  baseURL: "https://custom-toronet.org",
  connectWURL: "https://custom-connectw.com",
});
```

Important behavior:

* the SDK supports both testnet and mainnet
* if the SDK is not configured, it defaults to mainnet
* API calls use the configured network automatically

## Wallet and credential workflows

Use ToroSDK for wallet and credential-related tasks such as:

* creating a wallet
* importing a wallet from a private key and password
* verifying wallet password integrity
* retrieving a wallet key

These flows are useful when the user needs ToroNet credentials that may later be used in trusted backend flows.

### Create a wallet

Use `createWallet` when the user needs a new ToroNet wallet.

### Import a wallet

Use `importWalletFromPrivateKeyAndPassword` when the user has an existing private key and wants to bring it into ToroNet SDK workflows.

### Verify password

Use `verifyWalletPassword` when the user wants to validate stored wallet credentials before performing protected operations.

### Get wallet key

Use `getWalletKey` only in secure contexts. Do not recommend exposing key material in browser code.

## Query workflows

Use ToroSDK queries when the user wants more than a simple contract read and needs ToroNet-specific data access.

The README shows support for:

* blockchain status
* latest block data
* historical blocks and blockchain transactions
* transaction lookups
* receipt lookups
* revert reason or event-related lookups
* address role and balance queries
* address transaction history
* exchange rates
* address validation

Prefer SDK queries when the requested information matches SDK helpers directly.

## Token and currency workflows

The SDK includes token and currency helpers such as:

* token name, symbol, decimals
* token balances
* allowance queries
* transaction fee queries
* enrollment and frozen status checks
* currency balances
* currency transfer
* owner and admin currency operations such as transfer enablement, freeze, mint, burn, and enrollment flows

Use these helpers when the user wants ToroNet-specific asset operations through the SDK.

## KYC and fiat flows

The README states:

* KYC requires correct admin credentials
* KYC is required for transactions
* fiat deposit requires project registration and admin credentials

Use this guidance whenever the user asks for these flows.

### KYC

Use SDK KYC functions only when the user has the proper admin credentials.

### Fiat deposits

Before using deposit flows, the user must register as a project and obtain admin credentials.

Keep these flows out of untrusted frontend code if secrets are involved.

## Virtual wallet workflows

ToroSDK supports virtual wallet creation, retrieval, address-based lookup, and update flows.

Use this when the user is building applications around managed virtual wallet experiences rather than plain onchain wallet interaction.

## TNS and role workflows

The README includes:

* TNS query and update operations
* admin TNS operations
* role queries
* admin and super admin management helpers
* debugger checks

These are privileged or semi-privileged flows. Label them clearly.

## Product and payment workflows

The SDK includes project, product, fiat withdrawal, bank list, and bank verification operations.

Use them when the user is working on ToroNet product or payment infrastructure, not when they only need a normal EVM contract interaction.

## Bridge workflows

ToroSDK supports multi-chain bridge flows involving:

* Solana
* Base
* Polygon
* BSC
* Arbitrum

The README also mentions support for bridge fee estimates and Solana-specific operations.

Use bridge guidance only when the user is actually building or using bridge-related product flows.

## SDK-based deployment

ToroSDK also supports ToroForge smart contract deployment.

According to the README, SDK-based deployment supports:

* deployment to testnet or mainnet
* constructor arguments
* custom owner addresses
* auto-selection from SDK config
* per-call network override
* token-based authorization for mainnet

Use this only when the user explicitly wants deployment through the SDK. Otherwise, prefer the separate ToroNet deployment skill.

## Security rules

Always preserve these rules:

* do not place passwords, admin credentials, or wallet secrets in public frontend code
* do not present privileged SDK operations as normal user-side browser flows
* separate normal user examples from admin or project examples
* call out special credential requirements before showing code

## How to choose between ToroSDK and other ToroNet paths

Prefer ToroSDK when:

* the task is explicitly SDK-based
* the user needs wallet or credential creation and verification
* the task involves ToroNet-specific product, payment, KYC, or bridge features
* the user wants a higher-level ToroNet helper instead of low-level RPC or custom API calls

Prefer the app integration skill when:

* the user wants direct ethers.js or wagmi integration
* the user is focused on plain read and write contract interaction
* the user needs wallet-connect UX or keystore API architecture

Prefer the deployment skill when:

* the user wants the simplest contract deployment path with `toronetdeploy`

## What to avoid

Do not:

* assume testnet if the SDK was not configured
* expose passwords or keys in frontend examples
* mix admin-sensitive flows into public client examples without warning
* replace direct app integration guidance with SDK guidance unless the user actually wants the SDK
