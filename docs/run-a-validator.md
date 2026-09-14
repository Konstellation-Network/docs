---
id: run-a-validator
title: Run a Validator
sidebar_position: 4
---

# Run a Validator

:::caution Pre-testnet
There is no validator set to join yet. This page collects the operational
requirements decided so far so external operators have something to review
before testnet-1 opens (`ENGINEERING.md §15`, phase 6). Expect gaps — the
plan explicitly relies on the first external operators finding them.
:::

## Hardware

| Spec | Requirement |
|---|---|
| vCPU | 8–16 |
| RAM | 32–64 GB |
| Storage | 2–4 TB **local NVMe** — network block storage costs block time; IAVL commit latency is disk-bound |
| Network | 1 Gbps |

## Topology

Sentry architecture is **mandatory** — validators do not take public
inbound connections:

- Validator: `pex = false`, `persistent_peers` set only to your own
  sentries, no public IP.
- Sentry: `private_peer_ids` set to the validator's node ID so its address
  is never gossiped.

## Key management

Recommended: **horcrux** threshold signing across 3+ regions, or `tmkms` +
YubiHSM2. Whichever you choose:

:::danger Never run two nodes with the same `priv_validator_key.json`
Double-signing is unrecoverable and slashes 5% of stake. This applies during
migrations, failovers, and testing — not just steady-state operation.
:::

## Pruning

```toml
# app.toml — validator
pruning = "custom"
pruning-keep-recent = "100"
pruning-interval = "10"
```

Run an archive node (`pruning = "nothing"`, tracing enabled) separately if
you need historical queries or explorer support — not on a validator.

## Upgrades

Binaries are staged by hand via Cosmovisor — **auto-download is off**.
Verify the SHA256 checksum published in
[`networks/<net>/upgrades/`](https://github.com/konstellation-network/networks)
before placing a binary in
`$DAEMON_HOME/cosmovisor/upgrades/<name>/bin/`. See
[Upgrades](/upgrades) for the log of what's shipped so far.

## Monitoring

Enable `prometheus = true` in `config.toml` (port `26660`) and alert on:
missed blocks, falling peer count, block-time drift, disk headroom, and
**no new blocks** — the last is the exploit tripwire.

## Joining testnet-1

TODO once testnet-1 opens to external operators (`ENGINEERING.md §15`,
phase 6): seeds, persistent peers, genesis hash, minimum self-delegation,
and the gentx process live here.
