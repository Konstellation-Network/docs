---
id: rpc-endpoints
title: RPC Endpoints
sidebar_position: 2
---

# RPC Endpoints

:::caution Pre-testnet
No public endpoints exist yet. This page is a placeholder for the table that
will ship with `testnet-1` (see `networks/testnet-1/chain.json` once it
exists).
:::

## Local development

| Protocol | Endpoint |
|---|---|
| EVM JSON-RPC | `http://localhost:8545` |
| EVM WebSocket | `ws://localhost:8546` |
| Cosmos REST | `http://localhost:1317` |
| Cosmos gRPC | `localhost:9090` |
| Tendermint RPC | `http://localhost:26657` |

Started via `./local_node.sh -y` in the `konstellation` repo. Chain ID
`56670` (local/unknown networks only — never a real network's ID, per the
chain-id invariant in `ENGINEERING.md`).

## testnet-1

| Protocol | Endpoint |
|---|---|
| EVM JSON-RPC | _TBD_ |
| EVM WebSocket | _TBD_ |
| Cosmos REST | _TBD_ |
| Cosmos gRPC | _TBD_ |
| Tendermint RPC | _TBD_ |
| Explorer | _TBD — see [`explorer`](https://github.com/konstellation-network/explorer)_ |

Chain ID `56671`. Public endpoints will be published in
`networks/testnet-1/chain.json` (cosmos chain-registry format) once
testnet-1 is live — this table should link there rather than duplicate it.

## konstellation-1 (mainnet)

Not launched. Will follow the same shape as testnet-1 once genesis exists.
Chain ID `5667`.

## Running your own RPC node

Point clients at your own node instead of a shared endpoint. See
[Run a Validator](/run-a-validator) for hardware and configuration —
an RPC/archive node uses the same base configuration with pruning tuned for
its role (§9.2 of `ENGINEERING.md`).
