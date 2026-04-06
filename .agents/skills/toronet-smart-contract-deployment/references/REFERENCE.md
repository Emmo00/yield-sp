# ToroNet Smart Contract Deployment Reference

This file contains ToroNet-specific deployment guidance for the `toronet-smart-contract-deployment` skill.

## Deployment tool

Deployments to ToroNet should be done using `toronetdeploy`.

Preferred usage pattern:

```bash
npx toronetdeploy --file contracts/MyToken.sol --contract MyToken \
  --owner 0xYourOwnerAddress --args '["0xabc...", "1000"]' --network testnet
```

Use `npx` so the user does not need a global install.

## Supported command options

`toronetdeploy` uses these options:

* `--file` Path to the Solidity file containing the contract
* `--contract` Name of the contract to deploy, and it must exist in the specified file
* `--owner` Address of the owner deploying the contract
* `--args` Constructor arguments as a JSON array or comma-separated values
* `--network` Network to deploy to, with `testnet` as the default
* `--token` Optional deployment token, but required for mainnet deployment and obtained from the ToroNet team

## Deployment defaults

When the user does not specify otherwise:

* assume the deployment tool is `toronetdeploy`
* assume deployment is to `testnet`
* ask for or preserve placeholders for missing file path, contract name, owner address, and constructor arguments
* keep commands easy to copy and adapt

## Deployment command patterns

### Minimal testnet deployment

Use this shape when the contract has no constructor arguments:

```bash
npx toronetdeploy --file path/to/Contract.sol --contract ContractName --owner 0xOwnerAddress --network testnet
```

### Testnet deployment with constructor arguments

Use this shape when constructor arguments are required:

```bash
npx toronetdeploy --file path/to/Contract.sol --contract ContractName --owner 0xOwnerAddress --args '["arg1","arg2"]' --network testnet
```

### Mainnet deployment

Use this shape when deploying to mainnet:

```bash
npx toronetdeploy --file path/to/Contract.sol --contract ContractName --owner 0xOwnerAddress --args '["arg1","arg2"]' --network mainnet --token YOUR_DEPLOYMENT_TOKEN
```

Only mention `--token` when mainnet is involved or when the user asks about mainnet.

## Foundry projects

If the contract is inside a Foundry project, builders must make sure imports remappings are properly configured in `foundry.toml` before deployment.

This matters because ToroNet builders may use external dependencies such as OpenZeppelin or other libraries, and unresolved imports can block compilation or deployment preparation.

Reference template:
assets/foundry.toml.example

## Foundry remapping guidance

When the user mentions Foundry:

* remind them to verify `foundry.toml`
* remind them that dependency remappings must match the libraries actually installed
* do not guess remappings for libraries the user is not using
* if OpenZeppelin is being used, show a common remapping example
* keep the answer practical and deployment-focused

## Common deployment checks

Before giving a final deployment command, verify:

* the file path is correct
* the contract name is exactly correct
* the owner address is included
* constructor args are present if required
* the args format matches the user’s situation
* the correct network is chosen
* mainnet includes `--token`
* Foundry remappings are configured if the user is deploying from a Foundry project

## Common response pattern

When helping a user deploy, prefer this response structure:

1. Brief summary of what is being deployed
2. Exact `toronetdeploy` command
3. Short explanation of each important argument only if needed
4. ToroNet-specific warning or note, such as:

   * mainnet requires `--token`
   * Foundry requires proper remappings in `foundry.toml`

## What to avoid

Do not:

* switch to a different deployment tool unless the user explicitly asks
* omit the owner address in example commands
* forget `--token` for mainnet deployment
* ignore Foundry remappings when the user is deploying from a Foundry project
* turn a simple deployment answer into a long smart contract tutorial
