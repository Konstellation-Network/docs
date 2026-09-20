---
id: run-a-validator
title: Run a Validator
sidebar_position: 4
---

# Run a Validator

:::caution Pre-testnet
There is no validator set to join yet. Everything on this page about the
binary's behaviour is real and verified against the current `konstellationd`;
the `testnet-1` specifics (peers, genesis, release version) are placeholders
until `networks/testnet-1` publishes them. External operators are invited
onto `testnet-1` precisely so they can find the gaps in this page
(`ENGINEERING.md §15`, phase 6) — if something here does not work as
written, that is a docs bug, please report it.
:::

`konstellationd` is one binary for every network. It does not know which
network it is on beyond the chain-id checks described below: everything that
differs between `testnet-1` and `konstellation-1` lives in the network's
`genesis.json` (in the [`networks`](https://github.com/konstellation-network/networks)
repo) and in your own configuration.

## Hardware

Disk is the bottleneck: IAVL commit latency is disk-bound, so network block
storage costs block time.

| Role | Spec |
|---|---|
| Validator / sentry | 8–16 vCPU, 32–64 GB RAM, 2–4 TB **local NVMe**, 1 Gbps |
| Archive node (`pruning = "nothing"`, tracing on) | same; disk grows without bound |

## Two rules that are never relaxed

:::danger Never build the binary on a validator
Every release binary comes from CI in the `konstellation` repo, built twice
on independent runners from a signed tag, published only when both checksums
agree, with GitHub build provenance attached. Download the release asset and
verify its SHA256 against the ledger in
[`networks/RELEASES.md`](https://github.com/konstellation-network/networks/blob/main/RELEASES.md)
— never against a chat message. Nothing runs a binary that is not in that
table.
:::

:::danger Never run two nodes with the same `priv_validator_key.json`
Double-signing is unrecoverable: 5 % of stake slashed and a permanent
tombstone. This applies during migrations, failovers and testing — restoring
from a snapshot that includes the key, a warm standby, or "just for a
minute" all count. Testnet has no money at stake; the habit is the point.
:::

## Ports

Defaults `konstellationd init` writes. Only 26656 needs to be reachable from
the internet, and on a validator behind sentries not even that.

| Port | Protocol | File / key | Default bind |
|---|---|---|---|
| 26656 | CometBFT p2p | `config.toml` `[p2p] laddr` | `tcp://0.0.0.0:26656` |
| 26657 | CometBFT RPC | `config.toml` `[rpc] laddr` | `tcp://127.0.0.1:26657` |
| 26660 | Prometheus metrics | `config.toml` `[instrumentation]` | `:26660`, **off** (`prometheus = false`) |
| 9090 | Cosmos gRPC | `app.toml` `[grpc]` | `localhost:9090`, on |
| 1317 | Cosmos REST | `app.toml` `[api]` | `tcp://localhost:1317`, **off** |
| 8545 | EVM JSON-RPC (HTTP) | `app.toml` `[json-rpc] address` | `127.0.0.1:8545`, **off** (`enable = false`) |
| 8546 | EVM JSON-RPC (WebSocket) | `app.toml` `[json-rpc] ws-address` | `127.0.0.1:8546`, off with the above |
| 6060 | pprof | `config.toml` `pprof_laddr` | `localhost:6060` |

A validator leaves JSON-RPC and REST off. An RPC node enables `[json-rpc]`
(`enable = true`; default namespaces `eth,net,web3`) and puts a reverse
proxy in front of it — the JSON-RPC server itself has no auth. Never expose
`personal` or `debug` on a public endpoint.

## Install the binary

Cosmovisor with auto-download **off**. Upgrade binaries are staged by hand
after checksum verification (see [Upgrades](#upgrades)).

```sh
VERSION=<from networks/RELEASES.md>
curl -fsSLO "https://github.com/Konstellation-Network/konstellation/releases/download/${VERSION}/konstellationd-${VERSION}-linux-amd64"
sha256sum -c <<< "<sha256 from RELEASES.md>  konstellationd-${VERSION}-linux-amd64"
# optional but recommended: GitHub build provenance
gh attestation verify "konstellationd-${VERSION}-linux-amd64" --owner Konstellation-Network

export DAEMON_NAME=konstellationd
export DAEMON_HOME=$HOME/.konstellationd
export DAEMON_ALLOW_DOWNLOAD_BINARIES=false
export DAEMON_RESTART_AFTER_UPGRADE=true
mkdir -p "$DAEMON_HOME/cosmovisor/genesis/bin"
install -m 0755 "konstellationd-${VERSION}-linux-amd64" "$DAEMON_HOME/cosmovisor/genesis/bin/konstellationd"
ln -s "$DAEMON_HOME/cosmovisor/genesis" "$DAEMON_HOME/cosmovisor/current"
```

The default home directory is `~/.konstellationd`. Every command below
accepts `--home` if you keep it elsewhere.

## `konstellationd init`

```sh
"$DAEMON_HOME/cosmovisor/genesis/bin/konstellationd" init <moniker> --chain-id testnet-1 --home "$DAEMON_HOME"
```

`init` writes a **complete, correct** `config.toml`, `app.toml`, `client.toml`
and a placeholder `genesis.json` for the chain-id you name. Unlike the
upstream `evmd` reference, there is no `jq`/`sed` patching step afterwards.
If a recipe tells you to patch `stake` → `esp`, set `evm-chain-id`, or set
`mempool.type`, it is wrong for this chain. Specifically:

- **Every denom is `esp`.** The genesis defaults come from the chain's own
  `app.DefaultGenesis()`, not the SDK module defaults, so nothing says
  `stake`. `--default-denom` is accepted only as `esp`; anything else is
  refused:

  ```
  Error: --default-denom must be "esp": the base denom is fixed at genesis
  ```

- **`app.toml` `[evm] evm-chain-id` is derived from the genesis.** After
  writing `genesis.json`, `init` reads the chain-id back out of it and
  reconciles `app.toml`: a known network gets its required EIP-155 id
  (`konstellation-1` → `5667`, `testnet-1` → `56671`); any other chain-id
  gets the local id `56670`, and never a real network's id. A fresh
  `app.toml` is written with the right value directly; one that already
  existed (for example created by `konstellationd config set client
  chain-id …`, the standard join recipe, or left over from another network)
  is patched in place, and the change is printed — nothing is rewritten
  silently:

  ```
  genesis profile: testnet/dev (chain-id "testnet-1")
  app.toml: evm-chain-id 56670 -> 56671 for chain-id "testnet-1"
  ```

- **`config.toml` `[mempool] type = "app"`** is written automatically. The
  app-side EVM mempool ("Krakatoa") is on, and CometBFT v0.39 refuses to
  start with the default `"flood"` when the application supplies a mempool:

  ```
  Error: EVM mempool enabled, but comet-bft has invalid config.toml:mempool.type (want 'app', got 'flood'): error in app.toml
  ```

- The `genesis profile:` line tells you which governance timings the
  genesis got. Only the exact chain-id `konstellation-1` selects the mainnet
  profile (3-day voting, 1 000 / 5 000 KASH deposits); `testnet-1`, local and
  unknown chain-ids get the fast testnet/dev profile (2 h / 30 min, 10 / 50
  KASH). Irrelevant when you replace the placeholder genesis with a
  published one, but it is why a dev chain and mainnet look different.

Other values `init` leaves at their defaults and you will want to change:
`prometheus = false` (set `true`), `pruning = "default"` (see below),
`minimum-gas-prices = "0esp"`.

## The chain-id invariant

**`genesis.json` decides the network. Every per-node value is checked
against it, in both directions.** Nothing you put in a flag or a config
file can steer the node onto a different network than the genesis it holds.

At startup the node reads the chain-id from `genesis.json` first (honouring
`genesis_file` in `config.toml`). If `--chain-id` or `client.toml` disagree,
it refuses to start and names both files:

```
panic: --chain-id "konstellation-1" disagrees with /home/kons/.konstellationd/config/genesis.json ("testnet-1"); the genesis is authoritative
```

```
panic: client.toml chain-id "konstellation-1" disagrees with /home/kons/.konstellationd/config/genesis.json ("testnet-1"); fix client.toml (`konstellationd config set client chain-id testnet-1`)
```

The fix is the one in the message: correct `client.toml` (or drop the flag),
never edit the genesis. The EVM id is checked the same way:

```
panic: genesis chain-id "testnet-1" requires evm-chain-id 56671, app.toml has 5667: set [evm] evm-chain-id = 56671 in app.toml before starting
```

and the check also runs the other way round — a real network's EIP-155 id
belongs only to that network, because a transaction signed under it would
replay there:

```
panic: genesis chain-id "my-devnet" is not testnet-1 but app.toml has evm-chain-id 56671, which belongs to testnet-1: a tx signed here would replay there; use 56670 (local) or another unreserved id
```

If you see any of these, a file in `config/` is stale (usually
`client.toml` left over from another network, or an `app.toml` copied
between machines). Fix the file the message names; do not re-run `init` on
a node that already has keys, and never edit the genesis to match.

## Genesis

Replace the placeholder genesis `init` wrote with the published one and
verify the hash **before** starting. `networks/<net>/genesis.sha256` is
checked by CI on every commit to that repo.

```sh
# testnet-1 — placeholder paths; the files do not exist yet
curl -fsSL -o "$DAEMON_HOME/config/genesis.json" \
  https://raw.githubusercontent.com/Konstellation-Network/networks/main/testnet-1/genesis.json
curl -fsSL https://raw.githubusercontent.com/Konstellation-Network/networks/main/testnet-1/genesis.sha256 \
  | (cd "$DAEMON_HOME/config" && sha256sum -c -)
"$DAEMON_HOME/cosmovisor/genesis/bin/konstellationd" genesis validate --home "$DAEMON_HOME"
```

## Topology and keys

Sentry architecture is **mandatory** — a validator takes no public inbound
connections:

```toml
# config.toml on the validator
pex = false
persistent_peers = "<sentry_node_id>@10.0.1.5:26656,<sentry_node_id>@10.0.2.5:26656"

# config.toml on each sentry
private_peer_ids = "<validator_node_id>"   # never gossiped
```

Sign with [Horcrux](https://github.com/strangelove-ventures/horcrux)
(threshold signing across 3+ cosigners in different regions — the preferred
option for a chain holding user funds, and what the in-house fleet uses) or
`tmkms` + YubiHSM2. Either way the key never sits on the node itself — and the
one-key-one-node rule above still applies to the cosigner set as a whole.

## Pruning

```toml
# app.toml — validator
pruning = "custom"
pruning-keep-recent = "100"
pruning-interval = "10"
```

An archive node (`pruning = "nothing"`, tracing enabled) is a separate
machine; the explorer needs one because Blockscout requires
`debug_traceTransaction`. Do not run one on a validator.

## Start

```sh
cosmovisor run start --home "$DAEMON_HOME"
# elsewhere:
konstellationd status | jq .sync_info
```

Run it under systemd. This is the in-house unit
(`infra/ansible/roles/cosmovisor/templates/cosmovisor.service.j2`) with the
variables filled in:

```ini
[Unit]
Description=Konstellation cosmovisor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=kons
Group=kons
ExecStart=/usr/local/bin/cosmovisor run start --home /home/kons/.konstellationd
Restart=on-failure
RestartSec=3
LimitNOFILE=65535

Environment=DAEMON_NAME=konstellationd
Environment=DAEMON_HOME=/home/kons/.konstellationd
# Never true: an upgrade binary reaching a validator without a human
# verifying its checksum is exactly what the release process exists to prevent.
Environment=DAEMON_ALLOW_DOWNLOAD_BINARIES=false
Environment=DAEMON_RESTART_AFTER_UPGRADE=true
Environment=UNSAFE_SKIP_BACKUP=false

[Install]
WantedBy=multi-user.target
```

## Become a validator

Staking parameters that bind: `min_commission_rate` **5 %**, `max_validators`
**30**, unbonding **21 days**, downtime slash **0.01 %** (miss more than 50 %
of a 100-block window; 10-minute jail, then `tx slashing unjail`), double-sign
slash **5 %** with permanent tombstone.

- **At genesis:** you receive a `genesis.pre-gentx.json` with your bootstrap
  allocation in it. Use it as `config/genesis.json`, create your key and
  produce a gentx; the file goes back to the genesis coordinator.

  ```sh
  konstellationd keys add validator --key-type eth_secp256k1
  konstellationd genesis gentx validator 24000000000000000000000000esp \
    --chain-id testnet-1 --moniker <moniker> \
    --commission-rate 0.05 --commission-max-rate 0.20 --commission-max-change-rate 0.01 \
    --min-self-delegation 1000000000000000000
  ```

  Amounts are in `esp` (18 decimals): `24000000000000000000000000esp` is
  24 M KASH, `1000000000000000000` is 1 KASH. `--min-self-delegation` is a
  per-validator value that can be raised later, never lowered.

- **After genesis:** sync a full node first, then
  `konstellationd tx staking create-validator` with the same parameters.

## Upgrades

Auto-download is off. For each upgrade, `networks/<net>/upgrades/<name>.md`
gives the upgrade name, halt height, binary URL, SHA256, any `config.toml` /
`app.toml` changes and a rollback note. Stage the binary by hand:

```sh
mkdir -p "$DAEMON_HOME/cosmovisor/upgrades/<name>/bin"
sha256sum -c <<< "<sha256 from the upgrade doc>  konstellationd-<version>-linux-amd64"
install -m 0755 konstellationd-<version>-linux-amd64 "$DAEMON_HOME/cosmovisor/upgrades/<name>/bin/konstellationd"
```

Cosmovisor swaps at the governance-set halt height; you do not need to be
awake. On mainnet the height comes from a `MsgSoftwareUpgrade` proposal; on
`testnet-1` the in-house fleet is upgraded with Ansible and external
operators get the same upgrade doc. See [Upgrades](/upgrades) for the log of
what has shipped.

## Monitoring

Set `prometheus = true` in `config.toml` (`init` leaves it off; metrics on
`:26660`). Alert on: missed blocks, falling peer count, block-time drift,
disk headroom, and **no new blocks** — the last is the exploit tripwire.
The in-house fleet pages through tenderduty.

## Joining testnet-1

Everything in this section is a placeholder until `networks/testnet-1`
publishes the genesis. The authoritative join page will be
[`networks/testnet-1/README.md`](https://github.com/konstellation-network/networks/blob/main/testnet-1/README.md).

| | |
|---|---|
| Cosmos chain-id | `testnet-1` |
| EIP-155 chain id | `56671` |
| Binary version | **TBD** — `networks/RELEASES.md` |
| Genesis + sha256 | **TBD** — `networks/testnet-1/genesis.json`, `genesis.sha256` |
| Seeds | **TBD** — `networks/testnet-1/seeds.txt` |
| Persistent peers | **TBD** — `networks/testnet-1/persistent_peers.txt` |
| State sync / snapshots | **TBD** — `networks/testnet-1/snapshots.md` once archive nodes exist |
| Public RPC | **TBD** — see [RPC Endpoints](/rpc-endpoints) |

At genesis the validator set is the in-house five; 3–5 external operators
are invited afterwards (phase 6). Governance on `testnet-1` is deliberately
fast (2-hour voting period) so upgrade drills take hours, not days;
everything economic is identical to mainnet.

If something breaks, [Troubleshooting](/troubleshooting) has the errors we
know about.
