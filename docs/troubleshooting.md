---
id: troubleshooting
title: Troubleshooting
sidebar_position: 6
---

# Troubleshooting

Errors and behaviours that are deliberate, or known, and easy to mistake for
something else. Each entry says what you see, why, and what to do. Node
misconfiguration errors (chain-id, `evm-chain-id`, `mempool.type`) are on the
[Run a Validator](/run-a-validator#the-chain-id-invariant) page.

## My EVM transaction has no receipt but I was charged gas

**Symptom.** `eth_sendRawTransaction` returned a hash. `eth_getTransactionReceipt`
and `eth_getTransactionByHash` for it say **not found**, forever. The sender's
balance went down by the gas and the nonce advanced. `eth_call` and
`eth_estimateGas` for the same call succeeded beforehand.

**Why.** Every EVM transaction on Konstellation is also a Cosmos SDK
transaction. When one passes the ante handler (so it gets into a block) but
then fails at the **SDK level** during execution — a non-zero ABCI result
code rather than an EVM revert — `cosmos/evm` does not index it as an
Ethereum transaction at all (`indexer/kv_indexer.go`,
`TxSucessOrExpectedFailure`). An EVM *revert* is indexed normally with
`status: 0x0`; an SDK-level failure simply disappears from the `eth_*`
namespace. Gas is charged because the transaction did execute in a block.
`eth_call` / `eth_estimateGas` never commit state, so they cannot warn about
a failure that happens at commit.

Changing this would mean forking the indexer and RPC backend, which the
project does not do (upstream is consumed as a dependency only).

**Where the reason is.** CometBFT still indexed it. Query `tx_search` on the
node's CometBFT RPC (port 26657) with the Ethereum hash:

```bash
curl -s 'http://localhost:26657/tx_search?query="ethereum_tx.ethereumTxHash='"'"'0x<your eth tx hash>'"'"'"' \
  | jq '.result.txs[0].tx_result | {code, codespace, log}'
```

or with the CLI:

```bash
konstellationd query txs --query "ethereum_tx.ethereumTxHash='0x<your eth tx hash>'" -o json \
  | jq '.txs[0] | {code, codespace, raw_log}'
```

`code` is non-zero and `log` / `raw_log` carries the reason.

**The one case you could hit by hand is now refused up front.** Sending
**value** straight to a module account (`fee_collector`, `bonded_tokens_pool`,
…) or to any bank-blocked address (module accounts and precompiles) is
rejected by `x/vm`'s balance guard at state commit. Since 2026-09-19 the same
condition is checked in the ante handler and the mempool pre-check, so
`eth_sendRawTransaction` refuses it synchronously, nothing is charged and the
nonce is not consumed:

```
kons1... (0x...) is not allowed to receive funds: it is the "fee_collector" module account
```

```
kons1... (0x...) is not allowed to receive funds: blocked address (module account or precompile)
```

**Residual case: internal calls.** The submission check only sees the
transaction's own `to`. If a *contract* forwards value to a blocked address
(contract → module account) the transfer still fails at commit, invisibly to
`eth_*`, with the symptom above. A contract that forwards user-supplied
addresses should not let them be module accounts or precompiles. If you are
building a router/multisend and hit this, `tx_search` will show
`codespace: sdk`, `code: 4` (unauthorized) and the guard's message.

## "address is frozen"

**Symptom.** A transaction is refused at submission — `eth_sendRawTransaction`,
`konstellationd tx …`, or the REST/gRPC broadcast — with:

```
kons1...: address is frozen
```

(`codespace: compliance`, `code: 6`; the address is always shown in bech32
even when the transaction used its `0x` form.) Nothing was charged; the transaction
never entered the mempool.

**What it means.** The chain has a compliance block list (`x/compliance`),
enforced for **every** transaction, EVM and Cosmos alike, native KASH
included. A transaction is rejected if *any* address it involves is frozen:
the sender, the recipient, an EVM `to`, a delegation authority in an
EIP-7702 authorization list, and so on. The check runs in the mempool
pre-check as well as the ante handler, so the refusal is immediate and
explained rather than discovered at block time.

Freezes come from the compliance authority (a foundation multisig on
mainnet) through a 24-hour on-chain timelock, or as an **emergency freeze**
that takes effect immediately and auto-expires after the timelock unless
ratified; governance can override any entry. Every change is an on-chain
event.

**Check an address's standing:**

```bash
konstellationd query compliance status kons1...       # or the 0x form
konstellationd query compliance entries               # page through a list
konstellationd query compliance pending               # scheduled updates
```

From Solidity, the same lists are readable through the
[`ICompliance` precompile](/contracts#icompliance-at-0x0900) at `0x…0900`
(`isFrozen`, `isVerified`, `status`).

**Two consequences that surprise people.**

- Incoming **IBC transfers** to a frozen address are refused too: the packet
  is error-acknowledged and the sending chain refunds.
- Freezing an EOA that carried an **EIP-7702 delegation** clears the
  delegation (only the `0xef0100‖addr` code; storage stays). Once the freeze
  is lifted, one new authorization restores the smart-account wallet with
  its state intact. This exists because a relayer could otherwise drive the
  frozen account's wallet code by internal call.

Being *verified* (on the allow list) is never required to transact; only the
block list stops a transaction.

## "circuit breaker disables …" / "tx type not allowed"

**Symptom.** A transaction is refused at submission with one of:

```
circuit breaker disables /ibc.applications.transfer.v1.MsgTransfer
```

```
tx type not allowed
```

or, if it somehow reached a block, fails at execution with:

```
circuit breaker disallows execution of message /ibc.applications.transfer.v1.MsgTransfer
```

**What it means.** The chain runs the SDK circuit breaker (`x/circuit`). Its
admin — governance, and a 3-of-5 operations multisig granted in genesis —
can disable specific message types without halting the chain, as an
emergency control while a fix ships. It is checked at the router, in the
ante handler and in the mempool pre-check, walks into authz-nested `MsgExec`
messages, and also covers the EVM-side precompiles that execute the same
messages (so tripping `MsgTransfer` stops IBC sends from Solidity too).

Two message families are worth knowing by name:

| Disabled type | Effect |
|---|---|
| `/ibc.applications.transfer.v1.MsgTransfer` | all IBC sends stop, Cosmos and EVM (the ICS20 precompile included) |
| `/cosmos.evm.vm.v1.MsgEthereumTx` | the **entire EVM is paused** — every `eth_sendRawTransaction` is refused until reset |

The breaker cannot disable its own messages or governance's, so a trip is
always reversible.

**Check what is currently disabled:**

```bash
konstellationd query circuit disabled-list
```

If something is on the list, it is there on purpose: watch the project's
announcement channel rather than retrying.

## `panic: module account  does not exist: unknown address` on the first EVM tx after a restart

**Symptom.** A node that was restarted on existing state panics on the first
`eth_sendRawTransaction` it receives:

```
panic: module account  does not exist: unknown address
```

from `x/vm` `DeductTxCostsFromUserBalance`, during the EVM mempool recheck.
A freshly initialised chain does not do this; only restarts do.

**You are on an old binary.** This was root-caused and fixed in
`konstellation` PR #8 (merged 2026-09-16): `x/vm` charges EVM fees through
the SDK's `DeductFees`, whose fee-recipient module name is a package global
that upstream only populates lazily, on the first *Cosmos* transaction of
the process. A fresh chain gets that from the gentxs at InitChain; a restart
never does. The fix pins the value at startup. (Upstream issue:
[cosmos/evm#1288](https://github.com/cosmos/evm/issues/1288).)

Every binary listed in `networks/RELEASES.md` contains the fix — no release
was ever cut without it. If you see this panic you built from source at a
commit before `642e7b3`, which you should not be doing on a validator in the
first place (see [Run a Validator](/run-a-validator#two-rules-that-are-never-relaxed)).
The startup log line `failed to initialize rechecker context … invalid
height` is a separate, self-healing race and is not the cause.

## Node refuses to start: chain-id, `evm-chain-id` or `mempool.type`

These are the chain-id invariant and the app-side mempool requirement, with
the exact messages and fixes, on the
[Run a Validator](/run-a-validator#the-chain-id-invariant) page.
