---
id: rpc-endpoints
title: RPC Endpoints
sidebar_position: 2
---

# RPC Endpoints

:::caution Pre-testnet
No public endpoints exist yet. This page is a placeholder for the tables
that will ship with `devnet-1` and `testnet-1` (see
`networks/<network>/chain.json` once they exist). Dapp developers: use
`devnet-1`.
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
`56670` (local/unknown networks only — the node never lets a dev chain run
with a real network's ID; see [Run a Validator](/run-a-validator#the-chain-id-invariant)).

## devnet-1 — for dapp developers

| Protocol | Endpoint |
|---|---|
| EVM JSON-RPC | _TBD_ |
| EVM WebSocket | _TBD_ |
| Cosmos REST | _TBD_ |
| Cosmos gRPC | _TBD_ |
| Tendermint RPC | _TBD_ |
| Explorer | _TBD — see [`explorer`](https://github.com/konstellation-network/explorer)_ |
| Faucet | _TBD — see [`faucet`](https://github.com/konstellation-network/faucet)_ |

Chain ID `56672`. One foundation-run validator, the same release as mainnet,
rarely reset. Public endpoints will be published in
`networks/devnet-1/chain.json` (cosmos chain-registry format) once devnet-1
is live — this table should link there rather than duplicate it.

## testnet-1 — validator and upgrade rehearsals

| Protocol | Endpoint |
|---|---|
| EVM JSON-RPC | _TBD_ |
| EVM WebSocket | _TBD_ |
| Cosmos REST | _TBD_ |
| Cosmos gRPC | _TBD_ |
| Tendermint RPC | _TBD_ |
| Explorer | _TBD — see [`explorer`](https://github.com/konstellation-network/explorer)_ |

Chain ID `56671`. Four foundation-run validators; new releases land here
first and the network may be disrupted by drills. Public endpoints will be published in
`networks/testnet-1/chain.json` (cosmos chain-registry format) once
testnet-1 is live — this table should link there rather than duplicate it.

## konstellation-1 (mainnet)

Not launched. Will follow the same shape as devnet-1 and testnet-1 once genesis exists.
Chain ID `5667`.

## WebSocket from a browser (`eth_subscribe`)

A dapp running **in a browser** that opens the WebSocket endpoint (for
`eth_subscribe`, `newHeads`, log subscriptions — anything the HTTP endpoint
cannot push) is subject to the node's Origin allow-list, `app.toml`
`[json-rpc] ws-origins`. The list holds browser Origin **hosts** — no
scheme, no port: the node compares the `Origin` header's hostname only, so
`["localhost", "app.example.com"]` admits `http://localhost:5173` and
`https://app.example.com` alike, and `["*"]` admits everything. `init`'s
default is `["127.0.0.1", "localhost"]`.

| `Origin` header | Result |
|---|---|
| host is in `ws-origins` | `101 Switching Protocols` — connected |
| host is not in `ws-origins` | `403 Forbidden` |
| absent (Node, Go, `curl`, `cast`, wallets' own RPC clients) | always admitted |

So: a browser dapp needs its host in `ws-origins` **on the RPC node it talks
to**. If you run the node, add the host and restart; if it is a public
endpoint, ask its operator. Non-browser clients never hit this.

:::note Older binaries reject every browser Origin
On binaries before konstellation PR #14 the `ws-origins` array never
reached the server: the SDK's config interception flattened the TOML array
into one string (`[127.0.0.1 localhost]`), so every browser Origin got
`403` while `curl` worked. Fixed in PR #14 (`cmd/konstellationd/cmd/flags.go`
restores the array after interception; `--json-rpc.ws-origins a,b` on the
command line always worked and still wins). If a node returns `403` for an
Origin that is plainly in its list, it is on an old binary.
:::

## Running your own RPC node

Point clients at your own node instead of a shared endpoint. See
[Run a Validator](/run-a-validator) for hardware and configuration —
an RPC/archive node uses the same base configuration with pruning tuned for
its role.
