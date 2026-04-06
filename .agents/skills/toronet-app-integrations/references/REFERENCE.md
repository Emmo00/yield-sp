# ToroNet App Integrations Reference

This file contains the working conventions and reference material for the `toronet-app-integrations` skill.

## Integration model

ToroNet app integrations should be split into:

- read
- write

This helps the agent choose the right architecture and the right implementation path.

## Network configuration

### Confirmed testnet EVM configuration

Use this configuration when integrating ToroNet testnet with app libraries such as wagmi or ethers.js.

- Chain ID: `54321`
- Name: `Toronet Testnet`
- Network label: `Toronet testnet`
- Native currency:
  - name: `Toronet`
  - symbol: `TORO`
  - decimals: `18`
- RPC URL:
  - `https://testnet.toronet.org/rpc/`
- Block explorer:
  - `https://testnet.toronet.org/`

Reference asset:
`assets/toronet-testnet.ts`

### Keystore API URLs

Use these URLs for ToroNet keystore API-based interactions:

- Testnet:
  - `https://testnet.toronet.org/api/keystore/`
- Mainnet:
  - `https://www.toronet.org/api/keystore/`

These are for the ToroNet keystore API flow, not for standard EVM JSON-RPC reads with ethers.js or wagmi.

## Read integrations

Read operations should be implemented with standard EVM tooling.

Recommended options:

- ethers.js
- wagmi

Requirements for read operations:

- correct chain configuration
- correct RPC URL
- contract address
- contract ABI

### Ethers.js read pattern

Use ethers.js when the user wants a direct provider-and-contract flow.

Typical pattern:

1. create a provider using the ToroNet RPC URL
2. create a contract instance with ABI and address
3. call view or pure functions

### Wagmi read pattern

Use wagmi when the user is building a React app and wants hooks-based reads.

Typical pattern:

1. add ToroNet testnet to the wagmi chain configuration
2. configure transport with the ToroNet testnet RPC URL
3. use a read hook or a direct config-based read call

## Write integrations

ToroNet writes can be implemented in two ways.

### Option 1: Wallet-based writes

Use this when:

- the app is user-driven
- the user should approve each transaction
- the product wants a standard EVM wallet UX

Recommended flow:

1. prompt the user to connect an EVM wallet such as MetaMask
2. ensure the app is connected to the ToroNet network
3. prepare the transaction
4. prompt the wallet for approval
5. wait for confirmation and update UI state

Use this pattern for normal frontend transaction flows.

### Option 2: API-based writes through the ToroNet keystore API

Use this when:

- the product wants a smoother UX without repeated wallet prompts
- transaction execution is handled by the application backend
- the app can securely manage ToroNet API credentials

Recommended flow:

1. collect the user intent in the frontend
2. send the request to a trusted backend
3. let the backend call the ToroNet keystore API
4. return the result to the frontend
5. update the UI

Do not expose the ToroNet keystore credentials in frontend code.

The credentials needed for these API calls can be created and verified using the ToroNet SDK.

## ToroNet keystore API operations

The provided API documentation includes these operations:

- `signMessage`
- `getMessageSigner`
- `callContractFunction`

For app integrations, the most relevant write operation is:

- `callContractFunction`

### `callContractFunction` request shape

The request body uses:

- `op`: `callContractFunction`
- `params`:
  - `addr`
  - `pwd`
  - `contractaddress`
  - `functionname`
  - `functionarguments`
  - `abi`

Important notes:

- `functionarguments` is a pipe-delimited list of arguments and should be URI encoded when required by the integration
- `abi` is passed as a JSON-stringified ABI and URI encoded
- this call should be made from a trusted backend, not directly from an untrusted browser client

Reference asset:
`assets/toronet-keystore-api.examples.json`

## Security guidance

Always preserve these rules in responses:

- never recommend putting ToroNet keystore passwords in browser code
- never recommend exposing admin or signing credentials in a public client
- prefer wallet-based writes for public frontend transaction flows
- prefer API-based writes only when the app has a trusted backend
- clearly label whether an example is client-side or server-side

## How to choose the right write path

Use wallet-based writes when:

- user approval is expected
- the app is a normal dapp-style frontend
- standard EVM wallet UX is acceptable

Use API-based writes when:

- the product wants fewer wallet interruptions
- the application backend can securely execute transactions
- the app is designed around managed transaction execution

## Response pattern

When answering app integration questions, prefer this structure:

1. identify whether the task is read or write
2. show the relevant ToroNet network configuration
3. show the recommended integration pattern
4. provide code or architecture notes
5. add a short security note for write flows

## What to avoid

Do not:

- mix read and write concerns without labeling them
- use the keystore API as a default browser-side pattern
- expose `pwd` or other sensitive values in frontend examples
- invent a mainnet public EVM RPC URL that was not provided
- turn a simple integration answer into a deployment guide