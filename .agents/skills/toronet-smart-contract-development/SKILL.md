---
name: toronet-smart-contract-development
description: Write, review, explain, and refactor Solidity smart contracts for ToroNet. Use when the user wants ToroNet-compatible contract code, contract architecture guidance, or a ToroNet-specific review of an existing contract.
license: MIT
---

# toronet-smart-contract-development

Use this skill when the user wants help writing smart contracts for ToroNet.

This skill applies ToroNet-specific contract conventions during authoring, review, explanation, and refactoring.

See [the reference guide](references/REFERENCE.md) for ToroNet conventions, the default `Ownable` implementation, and deployment notes.

## When to use

Use this skill when the user:

- wants to write a new smart contract for ToroNet
- wants to adapt an existing Solidity contract for ToroNet
- wants a ToroNet-specific review of a smart contract
- wants help structuring ownership or admin permissions for ToroNet contracts
- wants a ToroNet-compatible Solidity example
- wants a contract refactored to match ToroNet conventions

Do not use this skill for frontend integration, SDK usage, or full deployment walkthroughs unless those topics are directly needed to complete a ToroNet smart contract task.

## Instructions

1. Treat ToroNet smart contract conventions as mandatory.
2. Ensure all ToroNet-targeted contract examples use Solidity `0.8.18` or below.
3. Ensure all ToroNet-targeted contracts inherit an `Ownable` trait.
4. When the user does not provide an ownership implementation, use the default ToroNet-compatible `Ownable` reference in `references/REFERENCE.md`.
5. Keep generated contracts practical, readable, and deployable.
6. Clearly identify privileged functions and owner-only operations.
7. When reviewing a contract, check ToroNet compatibility before suggesting improvements.
8. When deployment is mentioned, briefly note that ToroNet contracts are commonly deployed through a web UI, the ToroNet SDK, or the `toronetdeploy` npm package, but keep the focus on contract development unless the user asks for deployment details.

## Default workflow

1. Identify whether the task is writing, reviewing, explaining, or refactoring a contract.
2. Check the Solidity version and adjust it to a ToroNet-compatible version if needed.
3. Check whether the contract inherits `Ownable`.
4. Add or adapt ownership controls where needed.
5. Produce the contract, review, explanation, or refactor.
6. Briefly note any ToroNet-specific issues, assumptions, or deployment-readiness concerns.

## Output expectations

When this skill is active, the response should usually include:

- a brief summary of the requested contract task
- the ToroNet-specific constraints that apply
- the code, refactor, or review findings
- a short explanation of ownership and privileged functions
- brief deployment-readiness notes when relevant

## Common checks

- Solidity version is `0.8.18` or lower
- contract inherits `Ownable`
- owner-only functions are clearly restricted
- admin flow is understandable
- contract structure is realistic for ToroNet deployment
- code avoids unnecessary complexity for the stated use case
