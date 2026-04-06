---
name: toronet-smart-contract-deployment
description: Deploy Solidity smart contracts to ToroNet using toronetdeploy. Use when the user wants ToroNet deployment commands, help configuring owner and constructor args, guidance on network selection, mainnet token requirements, or Foundry remappings needed before deployment.
license: MIT
compatibility: Requires Node.js with npx. Foundry projects should have remappings configured in foundry.toml before deployment.
---

# toronet-smart-contract-deployment

Use this skill when the user wants help deploying smart contracts to ToroNet.

This skill is specifically for deployment workflows that use `toronetdeploy`.

See [the reference guide](references/REFERENCE.md) for the deployment workflow, command patterns, common checks, and ToroNet-specific deployment notes.

If the user is deploying from a Foundry project, also review:
assets/foundry.toml.example

## When to use

Use this skill when the user:

- wants to deploy a Solidity contract to ToroNet
- wants the correct `toronetdeploy` command
- needs help passing `--owner`, `--args`, or `--network`
- is deploying from a Foundry project and needs remappings configured
- wants to understand when `--token` is required
- wants ToroNet-specific deployment troubleshooting

Do not use this skill for writing the contract itself, frontend integration, or general SDK usage unless those topics are directly required to complete a ToroNet deployment task.

## Instructions

1. Treat `toronetdeploy` as the default ToroNet deployment path.
2. Build deployment commands around the documented `npx toronetdeploy` workflow.
3. Always make sure the user provides:
   - the Solidity file path
   - the contract name
   - the owner address
   - constructor arguments if needed
   - the target network
4. Default the network to `testnet` unless the user explicitly asks for mainnet.
5. If the user is deploying to mainnet, mention that `--token` is required and is obtained from the ToroNet team.
6. If the contract comes from a Foundry project, make sure imports and remappings are properly configured in `foundry.toml` before deployment.
7. Prefer copyable commands.
8. If the user provides incomplete deployment details, preserve the ToroNet deployment pattern and show a realistic command template with placeholders.
9. Keep the answer focused on deployment unless the user explicitly asks for contract design or integration help.

## Default workflow

1. Identify the contract file and contract name.
2. Confirm the owner address.
3. Determine whether constructor arguments are required.
4. Determine the target network.
5. Check whether the contract comes from a Foundry project.
6. If Foundry is involved, remind the user to verify remappings in `foundry.toml`.
7. Produce the correct `toronetdeploy` command.
8. Add only the ToroNet-specific notes that are necessary for successful deployment.

## Output expectations

When this skill is active, the response should usually include:

- a short summary of the deployment task
- the exact or templated `toronetdeploy` command
- any required arguments the user is missing
- a brief note about network selection
- a brief note about `--token` for mainnet when relevant
- a brief Foundry remapping note when relevant

## Common checks

- file path is correct
- contract name matches the file contents
- owner address is present
- constructor args are correctly formatted
- network is set correctly
- mainnet deployment includes `--token`
- Foundry imports/remappings are configured before deployment
