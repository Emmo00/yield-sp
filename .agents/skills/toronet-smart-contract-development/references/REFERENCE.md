# ToroNet Smart Contract Development Reference

This file contains ToroNet-specific conventions and reference material used by the `toronet-smart-contract-development` skill.

## ToroNet conventions

Apply these conventions whenever writing or reviewing smart contracts intended for ToroNet:

- Smart contracts must use Solidity version `0.8.18` or below.
- Smart contracts must inherit an `Ownable` trait.
- Ownership should be treated as a core part of ToroNet contract design.
- Generated examples should be easy to adapt into deployable ToroNet contracts.

## Solidity version rule

For ToroNet-targeted examples:

- do not use Solidity versions above `0.8.18`
- prefer `pragma solidity ^0.8.18;` unless the user explicitly requires a lower compatible version
- if the user provides code using a newer version, downgrade the pragma and adjust syntax only if needed

## Ownership rule

ToroNet contracts should inherit an `Ownable` trait.

If the user already uses OpenZeppelin ownership utilities, that is acceptable if it fits the user’s project and preserves ToroNet ownership expectations.

If the user does not provide an ownership implementation, use or adapt the following default reference implementation.

## Default Ownable implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract Ownable {
    address private _owner;
    address private initialOwner; // The initial owner who deploys the contract

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _transferOwnership(msg.sender);
        initialOwner = msg.sender; // Set the initial owner
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    modifier onlyInitialOwner() {
        require(initialOwner == msg.sender, "Ownable: caller is not the initial owner");
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        require(owner() == msg.sender, "Ownable: caller is not the owner");
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function destroy() public virtual onlyInitialOwner {
        selfdestruct(payable(initialOwner));
    }
}
```

## Guidance for using the default Ownable implementation

When generating a ToroNet contract with this implementation:

* keep the final contract within the Solidity `0.8.18` or lower rule
* inherit `Ownable` explicitly
* explain what `onlyOwner` protects
* call out `onlyInitialOwner` and `destroy()` when relevant
* do not hide or ignore privileged actions in the explanation

## Contract authoring defaults

When writing ToroNet-targeted contracts, prefer this style:

* use `pragma solidity ^0.8.18;` unless a lower version is required
* inherit `Ownable`
* use explicit constructor arguments where appropriate
* keep admin functions clearly separated from user functions
* prefer clarity over abstraction

## Review checklist

When reviewing a ToroNet contract, check:

* Is the Solidity version `0.8.18` or lower?
* Does the contract inherit `Ownable`?
* Are privileged functions properly restricted?
* Is ownership flow understandable?
* Is the code realistic for deployment on ToroNet?
* Is the code appropriately simple for the use case?

## Deployment note

If the user asks how the contract is deployed, mention that ToroNet smart contracts are commonly deployed through:

* a web UI
* the ToroNet SDK
* the `toronetdeploy` npm package

If the user asks for the easiest path, prefer `toronetdeploy`.

Do not turn a contract-authoring answer into a full deployment guide unless the user asks for deployment help directly.
