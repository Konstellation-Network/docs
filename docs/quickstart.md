---
id: quickstart
title: Quickstart
slug: /
sidebar_position: 1
---

# Quickstart

:::caution Pre-testnet
Konstellation has not launched a public network yet. The `testnet-1` RPC
and explorer URLs on this page are placeholders until the genesis is
published in the [`networks`
repo](https://github.com/konstellation-network/networks). Chain ids, token
and the local dev chain are settled; contract addresses that are not
genesis preinstalls (WKASH, vesting) are provisional until deployed on
`testnet-1` and listed in `networks/testnet-1/chain.json`.
:::

## Network parameters

| Field | Value |
|---|---|
| Chain name | Konstellation |
| Cosmos chain-id (testnet) | `testnet-1` |
| Cosmos chain-id (mainnet) | `konstellation-1` |
| EIP-155 chain ID (mainnet) | `5667` |
| EIP-155 chain ID (testnet) | `56671` |
| EIP-155 chain ID (local dev) | `56670` |
| Native token | KASH |
| Base denom | `esp` (18 decimals; 1 KASH = 10^18 `esp`) |
| Bech32 prefix | `kons` |

The EIP-155 ids are enforced by the node: a real network's id is used only by
that network, and a local chain can never be given one, so a transaction
signed for a dev chain cannot replay on `testnet-1` or mainnet.

## Add Konstellation to MetaMask

MetaMask → **Settings → Networks → Add a network → Add a network manually**.
Rabby and other EIP-3085 wallets take the same values.

### testnet-1

| Field | Value |
|---|---|
| Network name | Konstellation Testnet |
| New RPC URL | **TBD** — published in `networks/testnet-1/chain.json` when the network launches; see [RPC Endpoints](/rpc-endpoints) |
| Chain ID | `56671` |
| Currency symbol | `KASH` |
| Currency decimals | 18 |
| Block explorer URL | **TBD** — Blockscout, see the [`explorer`](https://github.com/konstellation-network/explorer) repo |

Test KASH comes from the faucet (**TBD** — [`faucet`](https://github.com/konstellation-network/faucet) repo).

### Local dev chain

| Field | Value |
|---|---|
| Network name | Konstellation Local |
| New RPC URL | `http://localhost:8545` |
| Chain ID | `56670` |
| Currency symbol | `KASH` |
| Currency decimals | 18 |
| Block explorer URL | none |

Programmatically (`wallet_addEthereumChain`), for the local chain:

```json
{
  "chainId": "0xdd5e",
  "chainName": "Konstellation Local",
  "nativeCurrency": { "name": "KASH", "symbol": "KASH", "decimals": 18 },
  "rpcUrls": ["http://localhost:8545"]
}
```

`0xdd5e` is 56670; `testnet-1`'s `56671` is `0xdd5f`, mainnet's `5667` is `0x1623`.

## Run a local dev chain

The `konstellation` repo ships a single-node dev chain. It needs Go (see
`go.mod` for the version) and `jq`.

```bash
git clone https://github.com/Konstellation-Network/konstellation.git
cd konstellation
./local_node.sh -y
```

`-y` wipes any previous chain data in `~/.konstellationd` without asking.
The script builds and installs `konstellationd`, runs `konstellationd init`
with chain-id `konstellation-local-1`, funds the dev accounts in genesis, and
starts the node with every API enabled:

| | |
|---|---|
| EVM JSON-RPC | `http://localhost:8545` (namespaces `eth,txpool,personal,net,debug,web3`) |
| EVM WebSocket | `ws://localhost:8546` |
| CometBFT RPC | `http://localhost:26657` |
| Cosmos REST / gRPC | `http://localhost:1317` / `localhost:9090` |
| Prometheus metrics | `:26660` |
| EIP-155 chain id | `56670` |
| Block time | ~1 s (`timeout_commit = "1s"`); node `minimum-gas-prices` and `evm.min-tip` are 0 |

The dev chain is a real `konstellationd`: the same genesis preinstalls,
precompiles, compliance module and circuit breaker as `testnet-1`, with
governance and compliance timelocks shortened to seconds so they can be
exercised in a session (voting period 30 s, compliance timelocks 60 s, the
validator key as the compliance authority).

### Dev accounts

Funded accounts `dev0`–`dev3` are created from **public, well-known
mnemonics** written into `local_node.sh` — never use them for anything
beyond local testing. `dev0`:

```
0xC6Fe5D33615a1C52c08018c47E8Bc53646A0E101
```

Its private key is in `local_node.sh` (search for `dev0`). The accounts are
also in the `konstellationd` test keyring, so the CLI can sign with them:

```bash
konstellationd keys list --keyring-backend test
```

## Send your first transaction

Against the local chain, with [Foundry](https://getfoundry.sh)'s `cast`:

```bash
# balance of dev0, in KASH
cast balance 0xC6Fe5D33615a1C52c08018c47E8Bc53646A0E101 --rpc-url http://localhost:8545 --ether

# send 1 KASH from dev0 to another address (the dev0 key is in local_node.sh)
cast send <recipient> --value 1ether \
  --rpc-url http://localhost:8545 \
  --private-key <dev0 private key from local_node.sh>

# the same asset, seen from the Cosmos side (1 KASH = 1000000000000000000esp)
konstellationd query bank balances $(konstellationd keys show dev0 -a --keyring-backend test)
```

`cast`'s `1ether` is 10^18 base units, which on Konstellation is 1 KASH. A
Cosmos-side bank send works the same way and burns the same EIP-1559 base
fee. The base fee starts at `1000000000esp` per gas (1 gwei-equivalent) in
genesis and adjusts from block 1, decaying toward 0 while the chain is idle;
a transaction priced below the current base fee is rejected, so price at the
genesis value to be safe:

```bash
konstellationd tx bank send dev0 <kons1... address> 1000000000000000000esp \
  --keyring-backend test --gas-prices 1000000000esp -y
```

Next: the [preinstalled contracts](/contracts) every address on the chain
can rely on, or [run a node](/run-a-validator).
