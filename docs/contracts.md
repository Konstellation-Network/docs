---
id: contracts
title: Preinstalled Contracts
sidebar_position: 3
---

# Preinstalled Contracts

Konstellation ships a set of contracts preinstalled in genesis at their
canonical, deterministic addresses, so existing wallet SDKs and tooling that
hard-code these addresses work unmodified. The source of truth is
[`contracts/preinstalls/`](https://github.com/konstellation-network/contracts/tree/main/preinstalls);
this table must stay in sync with it and with the bytecode actually baked
into `networks/<net>/genesis.json`.

| Contract | Address | Notes |
|---|---|---|
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Canonical cross-chain address |
| Permit2 | _see `contracts/preinstalls/Permit2.json`_ | |
| EntryPoint v0.7 | _see `contracts/preinstalls/EntryPointV07.json`_ | ERC-4337 |
| EntryPoint v0.8 | _see `contracts/preinstalls/EntryPointV08.json`_ | ERC-4337 |
| Create2Deployer | _see `contracts/preinstalls/Create2Deployer.json`_ | |

:::note
Addresses beyond Multicall3 are intentionally not hard-coded here yet —
copy them from `contracts/preinstalls/*.json` when this page is next
updated, rather than retyping them from memory, so a stale doc can't
silently diverge from the genesis blob it describes.
:::

## Account abstraction

- **ERC-4337:** EntryPoint v0.7 and v0.8 are preinstalled (table above). You
  still need to run or use a bundler (Rundler, Alto, Skandha) and, if you
  want gas sponsorship, a paymaster — neither ships with the chain.
- **Passkey / WebAuthn accounts:** supported via the **p256 precompile**
  (EIP-7212), included in `cosmos/evm`.

## Vesting

Vesting uses **Solidity vesting contracts** (`contracts/src/vesting/`), not
`x/auth` vesting accounts — a deliberate decision recorded in
`ENGINEERING.md §11 (D12)`.

## Verification

`contracts/test/GenesisBytecode.t.sol` asserts the genesis-embedded bytecode
for every preinstall matches the compiled artifact. If you're verifying a
contract against a block explorer, that test — not this page — is the
authority on what should be deployed.
