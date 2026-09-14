---
id: quickstart
title: Quickstart
slug: /
sidebar_position: 1
---

# Quickstart

:::caution Pre-testnet
Konstellation has not launched a public network yet. The values on this page
are placeholders until `testnet-1` genesis is finalized in the [`networks`
repo](https://github.com/konstellation-network/networks). Do not use them for
anything other than local development.
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

## Add Konstellation to MetaMask

TODO once `testnet-1` RPC is live — see [RPC Endpoints](/rpc-endpoints).

1. Open MetaMask → **Settings → Networks → Add network manually**.
2. Fill in:
   - **Network name:** Konstellation Testnet
   - **New RPC URL:** _TBD — testnet-1 has not launched_
   - **Chain ID:** `56671`
   - **Currency symbol:** KASH
   - **Block explorer URL:** _TBD — see [`explorer`](https://github.com/konstellation-network/explorer)_

## Run a local dev chain

The `konstellation` repo ships a single-node dev chain for testing against
before any public network exists:

```bash
cd ~/src/konstellation
./local_node.sh -y
```

This starts:

- JSON-RPC at `http://localhost:8545` (EIP-155 chain ID `56670`)
- Prometheus metrics at `:26660`

A funded dev account (`dev0`) is pre-seeded from a public, well-known mnemonic
— never use it for anything beyond local testing:

```
0xC6Fe5D33615a1C52c08018c47E8Bc53646A0E101
```

## Send your first transaction

TODO: walk through a bank send and an EVM transfer against the local dev
chain once the dev-chain tooling stabilizes.
