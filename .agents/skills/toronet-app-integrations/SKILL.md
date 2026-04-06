---
name: toronet-app-integrations
description: Integrate ToroNet into frontend or backend apps. Use when the user wants ToroNet network configuration, contract reads with ethers.js or wagmi, wallet-based writes, or server-side writes through the ToroNet keystore API.
license: MIT
compatibility: Suitable for JavaScript or TypeScript apps using ethers.js, wagmi, or backend HTTP clients. Wallet-based writes require an EVM wallet. API-based writes should be done from a trusted backend.
---

# toronet-app-integrations

Use this skill when the user wants help integrating an application with ToroNet.

This skill covers ToroNet network configuration, contract reads, and the two main write patterns used in apps:

- wallet-based writes through an EVM wallet such as MetaMask
- server-side writes through the ToroNet keystore API

See [the reference guide](references/REFERENCE.md) for network details, integration patterns, security guidance, and example request structures.

Relevant assets:

- `assets/toronet-testnet.ts`
- `assets/toronet-keystore-api.examples.json`

## When to use

Use this skill when the user:

- wants to configure ToroNet in a frontend or backend app
- wants the correct ToroNet testnet network configuration
- wants to read from ToroNet using ethers.js or wagmi
- wants to write to ToroNet through a connected EVM wallet
- wants to perform contract writes through the ToroNet keystore API
- wants help deciding between wallet-based and API-based transaction flows

Do not use this skill for smart contract authoring, contract deployment with `toronetdeploy`, or general SDK-only workflows unless those are directly needed to complete an app integration task.

## Instructions

1. Split ToroNet integrations into two categories:
   - read
   - write

2. For read operations:
   - prefer ethers.js or wagmi
   - make sure the ToroNet network configuration is correct
   - make sure the RPC URL is configured correctly
   - use the contract ABI and address provided by the user

3. For write operations, offer the correct integration path based on product needs:
   - wallet-based write flow when the user wants the end user to approve transactions in their wallet
   - API-based write flow when the product wants a more seamless transaction experience without repeated wallet prompts

4. Treat wallet-based writes as the default client-side write pattern.
   - ask the user to connect an EVM wallet such as MetaMask
   - prompt the wallet when the user wants to perform a transaction
   - keep signing and transaction approval inside the wallet flow

5. Treat ToroNet keystore API writes as a backend or trusted-server pattern.
   - do not recommend exposing ToroNet keystore credentials in the browser
   - keep `addr`, `pwd`, ABI payloads, and transaction execution on the server
   - mention that the credentials used for these API calls can be created and verified using the ToroNet SDK

6. When working on testnet, use the provided testnet configuration and testnet keystore API URL.

7. When working on mainnet:
   - use the mainnet keystore API URL that was provided
   - do not invent an EVM mainnet RPC configuration unless the user provides it

8. If the user asks for code examples:
   - keep them practical
   - separate read and write examples
   - clearly label whether a write example is wallet-based or API-based

9. Keep answers focused on integration.
   - do not turn the response into a smart contract development guide
   - do not turn the response into a deployment guide

## Default workflow

1. Determine whether the task is a read or a write integration.
2. Determine whether the app is frontend-only or has a backend.
3. Configure ToroNet network access first.
4. For reads, use ethers.js or wagmi with the correct RPC URL.
5. For writes, choose between wallet-based or API-based execution.
6. If the user wants API-based writes, move the transaction logic to a trusted backend.
7. Return code or architecture guidance that matches the chosen integration pattern.

## Output expectations

When this skill is active, the response should usually include:

- a short summary of the integration task
- the relevant ToroNet network configuration
- the recommended read or write pattern
- code or architecture guidance
- a short security note when API-based writes are involved

## Common checks

- correct RPC URL is used
- correct chain ID is used
- ABI and contract address are present
- wallet-based writes are done through an EVM wallet
- API-based writes are done from a trusted backend
- ToroNet keystore credentials are not exposed in client-side code
