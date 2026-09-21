---
id: contracts
title: Preinstalled Contracts
sidebar_position: 3
---

# Preinstalled Contracts

Konstellation ships a set of contracts preinstalled in genesis at their
canonical, deterministic addresses, so existing wallet SDKs and tooling that
hard-code these addresses work unmodified. Every address on this page is
identical on `testnet-1`, `konstellation-1` and a local dev chain.

Two sources of truth, in order:

1. [`contracts/preinstalls/*.json`](https://github.com/konstellation-network/contracts/tree/main/preinstalls)
   — the pinned deployed bytecode for Konstellation's own preinstalls, each
   with a `codeHash` guard. `konstellation/app/preinstalls/` carries verbatim
   copies (Go cannot import a Foundry repo) and re-verifies every `codeHash`
   at `konstellationd init`, so an out-of-step copy fails before a genesis
   is written.
2. `cosmos/evm`'s `x/vm/types/preinstall.go` (`DefaultPreinstalls`) for the
   five upstream defaults, which the chain installs unchanged.

If this table and those files ever disagree, the files win — file a docs bug.

## Genesis preinstalls

A preinstall is bytecode placed at an address in `genesis.json`. **Its
constructor never runs.** Anything a constructor would have deployed or
initialised has to be a preinstall too — which is why the ERC-4337
`SenderCreator`s are in the list (see below).

### From `cosmos/evm` `DefaultPreinstalls`

| Contract | Address | Notes |
|---|---|---|
| Create2 (deterministic-deployment proxy) | `0x4e59b44847b379578588920ca78fbf26c0b4956c` | The minimal deterministic-deployment proxy (Arachnid's) that Foundry uses by default for CREATE2 deployments. Not the same contract as `Create2Deployer` below. |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Canonical cross-chain address. Also pinned in `contracts/preinstalls/Multicall3.json`, byte-identical. |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Uniswap Permit2. Also pinned in `contracts/preinstalls/Permit2.json`, byte-identical. |
| Safe singleton factory | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` | What Safe's deployment tooling uses to place its singletons at the same address on every chain. |
| EIP-2935 history storage | `0x0000F90827F1C53a10cb7A02335B175320002935` | Serves historical block hashes from state (Prague system contract). |

### Konstellation additions (`contracts/preinstalls/`)

| Contract | Address | Notes |
|---|---|---|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337. Requires `SenderCreatorV07` below. |
| SenderCreator v0.7 | `0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C` | Companion of EntryPoint v0.7; see [Why the SenderCreators](#why-the-sendercreators-are-preinstalled). |
| EntryPoint v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` | ERC-4337. Requires `SenderCreatorV08` below. Shipped alongside v0.7 because wallets differ on which version they target. |
| SenderCreator v0.8 | `0x449ED7C3e6Fee6a97311d4b55475DF59C44AdD33` | Companion of EntryPoint v0.8. Its own `entryPoint` immutable is EntryPoint v0.8's address, so the two must ship together. |
| Create2Deployer | `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2` | The hardhat-deploy / OpenZeppelin Defender CREATE2 deployer (`deploy(uint256,bytes32,bytes)`, `computeAddress(bytes32,bytes32)`, `computeAddressWithDeployer(bytes32,bytes32,address)`). Distinct from the minimal Create2 factory above; both are installed so tooling expecting either one works. |

That is 10 preinstalls in total. The genesis loader refuses address
collisions between the two sets and checks that each EntryPoint's bytecode
literally contains its SenderCreator's address, so a half re-pin fails at
`konstellationd init`, not at block 1.

### Why the SenderCreators are preinstalled

On Ethereum each `EntryPoint`'s constructor does `new SenderCreator()` — a
`CREATE` from the EntryPoint at nonce 1 — and stores the resulting address as
an immutable in its runtime bytecode. On Konstellation the EntryPoint is
placed by genesis, so that constructor never runs and nothing exists at the
address the bytecode points to. Without the companion, every UserOperation
carrying `initCode` and every `getSenderAddress()` call reverts with empty
data, and the address (`CREATE(entryPoint, 1)`) cannot be recreated
post-genesis because the EntryPoint's nonce is never consumed that way
again. So both SenderCreators are pinned from mainnet and preinstalled next
to their EntryPoints. This was found in review before the first genesis; the
pairing is now enforced in code and covered by tests.

## Precompiles

Precompiles are not deployed bytecode: they are Go code in the node, exposed
at fixed addresses. `eth_getCode` on the static ones below returns empty
(the werc20 precompile is the exception — `x/erc20` registers placeholder
ERC-20 bytecode at its address so `extcodesize`-style "is this a contract"
checks pass). `cosmos/evm`'s own precompiles occupy `0x…0100`–`0x…0807`;
Konstellation's range starts at `0x…0900`.

| Precompile | Address | Notes |
|---|---|---|
| p256 (EIP-7212 / RIP-7212) | `0x0000000000000000000000000000000000000100` | secp256r1 signature verification, from `cosmos/evm`. What passkey / WebAuthn smart accounts need. |
| bech32 | `0x…0400` | `cosmos/evm` |
| staking, distribution, ICS20, vesting, bank, gov, slashing, ICS02 | `0x…0800`–`0x…0807` | `cosmos/evm` |
| WKASH (werc20 native precompile) | `0xD4949664cD82660AaE99bEdc034a0deA8A0bd517` | The native token as an ERC-20 interface, registered with `x/erc20` at genesis. Upstream default address, kept so tooling assumptions carry over. This is a precompile, not deployed bytecode — distinct from the `WKASH.sol` contract below. |
| **ICompliance** | `0x0000000000000000000000000000000000000900` | Konstellation. Read-only view of the chain's compliance lists (below). |

### `ICompliance` at `0x…0900`

The chain itself refuses every transaction that *involves* a frozen address
— EVM and Cosmos, native KASH included — before execution (see
[Troubleshooting](/troubleshooting#address-is-frozen)). That check cannot
see internal calls, so a contract that forwards user-supplied addresses, or
that wants to serve only verified addresses, calls this precompile. All
functions are `view` and cost only the precompile's base read gas.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Konstellation compliance precompile
/// @notice Read-only view of the chain's compliance lists, at a fixed address
///         (COMPLIANCE_PRECOMPILE_ADDRESS). The chain itself refuses every
///         transaction that involves a frozen address; contracts that need to
///         refuse *internal* transfers to frozen addresses, or that want to
///         serve only verified addresses, call this.
/// @dev All functions are `view` and cost the precompile's base read gas.
interface ICompliance {
    /// @notice True if `account` is on the allow ("verified") list.
    function isVerified(address account) external view returns (bool);

    /// @notice True if `account` is on the block ("frozen") list and, for an
    ///         emergency freeze, the freeze has not yet expired.
    function isFrozen(address account) external view returns (bool);

    /// @notice Both flags, plus the emergency-freeze expiry as a unix time.
    ///         `frozenUntil` is 0 when not frozen or when the freeze is
    ///         permanent.
    function status(address account)
        external
        view
        returns (bool verified, bool frozen, uint64 frozenUntil);
}
```

Source: `konstellation/x/compliance/precompile/ICompliance.sol` (the ABI is
`abi.json` next to it). Semantics worth knowing:

- Two lists. The **blocklist** (`isFrozen`) is what the chain enforces; the
  **allowlist** (`isVerified`) is opt-in — the chain never requires an
  address to be verified to transact, only being frozen stops a tx.
- List changes come from the compliance authority through an on-chain
  timelock — **24 h on mainnet**; it is a per-network genesis parameter,
  short on `testnet-1` and 60 s on a `local_node.sh` dev chain — or as an
  emergency freeze that takes effect immediately and auto-expires after the
  timelock unless ratified; governance can override any entry. Every action
  is an on-chain event.
- Freezing an EOA also clears any EIP-7702 delegation it carried, so a
  smart-account wallet installed before the freeze cannot be driven by a
  relayer afterwards.

```solidity
ICompliance constant COMPLIANCE =
    ICompliance(0x0000000000000000000000000000000000000900);

function transfer(address to, uint256 amount) external {
    require(!COMPLIANCE.isFrozen(to), "recipient is frozen");
    // ...
}
```

## Account abstraction

- **ERC-4337:** EntryPoint v0.7 and v0.8 are preinstalled with their
  SenderCreators (table above). You still need a bundler (Rundler, Alto,
  Skandha) and, for gas sponsorship, a paymaster — neither ships with the
  chain.
- **Passkey / WebAuthn accounts:** the p256 precompile at `0x…0100` is
  active from genesis.
- **EIP-7702:** delegations are honoured by the EVM. Note the compliance
  interaction above: an emergency or scheduled freeze resets the delegation
  on the frozen EOA (only the 23-byte `0xef0100‖addr` code, never real
  contract bytecode, and storage stays, so one new authorization restores
  the wallet once lifted).

## WKASH (post-genesis)

`contracts/src/WKASH.sol` is the wrapped native token as ordinary deployed
bytecode (KASH / `esp`, 18 decimals). It is deliberately **not** a genesis
preinstall: it is deployed after genesis through the preinstalled
`Create2Deployer`, which gives a fixed, predictable address without baking
not-yet-audited bytecode into `genesis.json` forever.

| Contract | Address | Notes |
|---|---|---|
| WKASH | `0x34Ab8285C63b876717C2c56151700D02623559bE` | Same on every network. CREATE2 via `Create2Deployer` `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2`, salt `keccak256("konstellation-network/contracts:WKASH:v1")`. Pinned by `contracts/test/DeployWKASH.t.sol`, which fails if a code, solc, optimizer or `evm_version` change moves it. |

The bytecode is compiled metadata-free (`bytecode_hash = "none"`,
`cbor_metadata = false`) so a comment edit cannot move the address; the
trade-off is that Blockscout source verification shows a **partial match**
(metadata stripped), which is expected. Contracts are compiled for the
**Prague** EVM (`evm_version = "prague"`, D17) — the fork the chain runs from
genesis; Osaka is not enabled, so never compile for it (`CLZ` would be an
invalid opcode here). Cancun-targeted bytecode runs unchanged.

Solidity that only needs the native token as an ERC-20 can also use the
werc20 precompile at `0xD4949664cD82660AaE99bEdc034a0deA8A0bd517`.

## Vesting

Vesting uses **Solidity vesting contracts** (`contracts/src/vesting/`), not
`x/auth` vesting accounts — decision D12 in `ENGINEERING.md §11`, taken
because a peer chain attributed its exploit to a flaw touching vesting
accounts and balance handling. Keeping vesting in audited application code
keeps consensus-critical account logic stock.

Built 2026-09-20 on an OpenZeppelin v5.7.0 base:

| File | Role |
|---|---|
| `KonstellationVestingWallet.sol` | non-revocable wallet: treasury and community tranches |
| `RevocableVestingWallet.sol` | team wallet: one-shot `revoke()` by the foundation multisig; unvested returns to the treasury, vested stays with the beneficiary |
| `VestingSchedules.sol` | the one place `TOKENOMICS.md §7`'s numbers live (a vesting year is 365 days) |
| `script/DeployVesting.s.sol` | JSON config → CREATE2 wallets; `predict()` gives the addresses genesis funds |

Every wallet is a CREATE2 deploy through `Create2Deployer`, so its address
is known before genesis and **`genesis.json` funds it directly at block 0**
— there is no post-genesis funding step. Vesting is **native KASH only**:
OpenZeppelin's ERC-20 `release(token)` path is disabled on purpose, because
the werc20 precompile presents the native balance as an ERC-20 and would let
a beneficiary withdraw the same KASH twice.

The schedules (`TOKENOMICS.md §7`, on a 1 B KASH supply):

| Bucket | Liquid at genesis | Locked part | Revocable |
|---|---|---|---|
| Founding team & early contributors (220 M) | **10 % of each grant** — a plain genesis balance, never in a wallet | 90 % in a `RevocableVestingWallet` per person: start = TGE + 1 year, cliff 0, duration 3 years (i.e. nothing until month 12, then linear over 36 months) | **yes** — foundation multisig |
| Community & developers (330 M) | **50 M** community-pool seed, written into genesis `distribution` state (a module account: no contract, no key, spendable only by governance proposal) | 280 M — grants 180 M and incentives 100 M — in non-revocable `KonstellationVestingWallet`s, five yearly tranches of 30 / 25 / 20 / 15 / 10 %, each linear within its year | no |
| Treasury (250 M) | 50 M (20 %) | 200 M linear over 48 months in a non-revocable wallet | no |

Per-wallet addresses are a function of the beneficiary config
(`script/config/vesting.json`, from `vesting.example.json`; real team beneficiaries and TGE are not yet
filled in). `testnet-1` mirrors the same shape with test addresses. This
page will list the deployed instances once `networks/<net>/genesis.json`
funds them.

## Verification

`contracts/test/GenesisBytecode.t.sol` asserts that every
`preinstalls/*.json` is internally consistent (`keccak256(code) ==
codeHash`); `contracts/script/VerifyPreinstalls.s.sol` checks the same pins
against a live Ethereum mainnet RPC. On a running Konstellation node,
`eth_getCode` at each preinstall address must byte-match the pin:

```bash
# keccak256 of the live code must equal "codeHash" in the matching preinstalls/*.json
cast keccak "$(cast code 0x0000000071727De22E5E9d8BAf0edAc6f37da032 --rpc-url http://localhost:8545)"
jq -r .codeHash contracts/preinstalls/EntryPointV07.json
```

If you are verifying a contract against a block explorer, those tests — not
this page — are the authority on what should be deployed.
