---
name: toronet-sdk
description: Use the ToroSDK TypeScript package for ToroNet workflows. Use when the user wants SDK-based wallet creation or import, password verification, blockchain queries, KYC or fiat flows, virtual wallet operations, bridge features, or SDK-based ToroNet deployment and transaction support.
license: MIT
compatibility: Suitable for JavaScript or TypeScript environments with npm support. Requires the torosdk package. Some operations require admin, project, or whitelisted credentials.
---

# toronet-sdk

Use this skill when the user wants to work with ToroNet through the ToroSDK package.

This skill covers SDK initialization, network selection, wallet and credential workflows, blockchain queries, admin-sensitive SDK features, and when to prefer the SDK over lower-level alternatives.

See [the reference guide](references/REFERENCE.md) for supported SDK capabilities, workflow guidance, and safety notes.

Relevant assets:

- `assets/initialize-sdk.ts`
- `assets/wallet-and-credentials.examples.ts`

## When to use

Use this skill when the user:

- wants to initialize and configure ToroSDK
- wants to create or import ToroNet wallets with the SDK
- wants to verify wallet passwords or retrieve wallet keys
- wants to use ToroSDK for blockchain queries
- wants to use ToroSDK for KYC, fiat deposit, virtual wallet, token, payment, or bridge flows
- wants to create or verify credentials that will later be used with ToroNet API-based transaction flows
- wants SDK-based ToroNet deployment or network-aware SDK usage

Do not use this skill for plain RPC integrations with ethers.js or wagmi unless the user is explicitly comparing the SDK with those approaches.

## Instructions

1. Treat ToroSDK as the preferred path when the user explicitly wants SDK-based integration or when the task involves ToroNet-specific product flows beyond normal EVM reads.
2. Start by identifying which SDK workflow the user needs:
   - SDK initialization
   - wallet or credential flow
   - blockchain query
   - admin or project flow
   - bridge flow
   - SDK-based deployment
3. Initialize the SDK correctly before describing other SDK operations.
4. Be explicit about network selection.
   - testnet and mainnet are both supported
   - if the user does not configure the SDK, it defaults to mainnet
5. When the user needs credentials for later ToroNet API-based calls, prefer SDK wallet flows such as wallet creation, wallet import, and password verification.
6. When a workflow requires special credentials, call that out clearly.
   - KYC requires the correct admin credentials
   - fiat deposit requires project registration and admin credentials
   - many admin and payment flows require admin or whitelisted credentials
7. Keep normal user-facing examples separate from admin-sensitive examples.
8. Keep backend-sensitive operations out of public frontend examples when secrets or passwords are involved.
9. If the user asks about deployment through the SDK, explain that ToroSDK supports ToroForge deployment to testnet or mainnet, supports constructor arguments and custom owner addresses, uses the configured SDK network by default, allows per-call override, and requires token-based authorization for mainnet.
10. Keep the answer focused on SDK usage rather than generic blockchain theory.

## Default workflow

1. Identify the exact SDK job the user wants to do.
2. Initialize the SDK with the intended network.
3. Choose the appropriate SDK function group.
4. Check whether the workflow needs normal user credentials, admin credentials, or project credentials.
5. Provide a practical example.
6. Add only the necessary warnings about secrets, credentials, and network choice.

## Output expectations

When this skill is active, the response should usually include:

- a short summary of the SDK task
- the correct SDK initialization pattern
- the relevant SDK functions or flow
- example code or implementation guidance
- a short note on required credentials or permissions when relevant

## Common checks

- SDK is installed
- SDK network is set correctly
- user understands that the default network is mainnet if not configured
- secrets are not exposed in frontend code
- admin-only flows are clearly labeled
- project-only flows are clearly labeled
