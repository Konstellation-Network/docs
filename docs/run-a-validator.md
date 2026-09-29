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
until `networks/testnet-1` publishes them. The genesis set on `testnet-1`
and `konstellation-1` is 4 foundation-run validators (`devnet-1`, the dapp
developers' network, runs a single foundation validator and takes no
outside validators); independent operators are admitted
afterwards through the permissioned procedure described under
[Become a validator](#become-a-validator) — and are admitted onto
`testnet-1` first precisely so they can find the gaps in this page. If
something here does not work as
written, that is a docs bug, please report it.
:::

`konstellationd` is one binary for every network. It does not know which
network it is on beyond the chain-id checks described below: everything that
differs between `devnet-1`, `testnet-1` and `konstellation-1` lives in the network's
`genesis.json` (in the [`networks`](https://github.com/konstellation-network/networks)
repo) and in your own configuration. The EVM runs the **Prague** (Pectra)
fork from genesis, which is what `cosmos/evm` v0.7.3 activates by default;
Osaka is deliberately not enabled (a recorded decision: cosmos/evm never
activates it, and its native P-256 precompile would collide with the one at
`0x…0100`) — nothing
for an operator to configure, but worth knowing when a wallet or tool asks.

## Hardware

Disk is the bottleneck: IAVL commit latency is disk-bound, so network block
storage costs block time.

| Role | Spec |
|---|---|
| Validator / sentry | 8–16 vCPU, 32–64 GB RAM, 2–4 TB **local NVMe**, 1 Gbps |
| Archive node (`pruning = "nothing"`, tracing on) | same; disk grows without bound |

## Two rules that are never relaxed

:::danger Never build the binary on a validator
Every release binary comes from CI in the `konstellation` repo (release
pipeline under review, not yet merged): built twice on independent runners
from a signed tag, published only when both checksums agree, with GitHub
build provenance attached. Download the release asset and verify its
SHA256 against the ledger in
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

Everything below runs as a dedicated system user, which is also the user
the systemd unit runs as. Create it once and do every step as it:

```sh
sudo useradd -r -m -s /bin/bash konstellation
sudo -iu konstellation
```

Cosmovisor with auto-download **off**. Upgrade binaries are staged by hand
after checksum verification (see [Upgrades](#upgrades)). Cosmovisor itself
is a pinned release too: download the tarball, check it against the
`SHA256SUMS` published with that release, and extract only the binary.

```sh
CV=v1.7.0
curl -fsSLO "https://github.com/cosmos/cosmos-sdk/releases/download/cosmovisor%2F${CV}/cosmovisor-${CV}-linux-amd64.tar.gz"
sha256sum -c <<< "07f2824d924bd96029009047bffbbb0645769b90a9423a7872d3240880de88ba  cosmovisor-${CV}-linux-amd64.tar.gz"
tar -xzf "cosmovisor-${CV}-linux-amd64.tar.gz" cosmovisor
sudo install -m 0755 cosmovisor /usr/local/bin/cosmovisor
```

(The checksum is from `SHA256SUMS-cosmovisor-v1.7.0.txt` on that release —
compare it yourself; this page is not the trust root for it either.)

Then the chain binary. The provenance check must name the repository and
the workflow: `--owner` alone would accept a build from any repository in
the organisation.

```sh
VERSION=<from networks/RELEASES.md>
curl -fsSLO "https://github.com/Konstellation-Network/konstellation/releases/download/${VERSION}/konstellationd-${VERSION}-linux-amd64"
sha256sum -c <<< "<sha256 from RELEASES.md>  konstellationd-${VERSION}-linux-amd64"
gh attestation verify "konstellationd-${VERSION}-linux-amd64" \
  --repo Konstellation-Network/konstellation \
  --signer-workflow Konstellation-Network/konstellation/.github/workflows/release.yml

export DAEMON_NAME=konstellationd
export DAEMON_HOME=$HOME/.konstellationd            # /home/konstellation/.konstellationd
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
  (`konstellation-1` → `5667`, `devnet-1` → `56672`, `testnet-1` → `56671`); any other chain-id
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
  app-side EVM mempool ("Krakatoa") is on, and cosmos/evm's server-config
  validation (before CometBFT even starts) refuses the default `"flood"`
  when the application supplies a mempool:

  ```
  Error: EVM mempool enabled, but comet-bft has invalid config.toml:mempool.type (want 'app', got 'flood'): error in app.toml
  ```

- The `genesis profile:` line tells you which governance timings the
  genesis got. Only the exact chain-id `konstellation-1` selects the mainnet
  profile (3-day voting, 1 000 / 5 000 KASH deposits); `devnet-1`, `testnet-1`, local and
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
panic: --chain-id "konstellation-1" disagrees with /home/konstellation/.konstellationd/config/genesis.json ("testnet-1"); the genesis is authoritative
```

```
panic: client.toml chain-id "konstellation-1" disagrees with /home/konstellation/.konstellationd/config/genesis.json ("testnet-1"); fix client.toml (`konstellationd config set client chain-id testnet-1`)
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
panic: genesis chain-id "my-chain" is not testnet-1 but app.toml has evm-chain-id 56671, which belongs to testnet-1: a tx signed here would replay there; use 56670 (local) or another unreserved id
```

If you see any of these, a file in `config/` is stale (usually
`client.toml` left over from another network, or an `app.toml` copied
between machines). Fix the file the message names; do not re-run `init` on
a node that already has keys, and never edit the genesis to match.

## Genesis

Replace the placeholder genesis `init` wrote with the published one and
verify the hash **before** starting. Two things matter about *how*:

- The `.sha256` file next to `genesis.json` in the `networks` repo is a
  consistency check (CI keeps the pair in step), **not** a second trust
  root — a hostile genesis carrying the real EIP-155 id would pass every
  check on this page if both files came from the same place. Fetch by a
  **tag or commit SHA**, never `main`, and compare the hash against the
  value published *separately*: the release announcement and the join
  table at the bottom of this page.
- `genesis validate` checks shape, not identity.

```sh
# testnet-1 — placeholder ref and hash; the files do not exist yet
REF=<tag or commit SHA from the release announcement>
curl -fsSL -o "$DAEMON_HOME/config/genesis.json" \
  "https://raw.githubusercontent.com/Konstellation-Network/networks/${REF}/testnet-1/genesis.json"
sha256sum "$DAEMON_HOME/config/genesis.json"
# must equal the hash in the announcement / the join table below — not merely the .sha256 file
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
option for a chain holding user funds, and what the foundation's own
validators use) or `tmkms` + YubiHSM2. Note that **`init` has already
written a consensus key** to `config/priv_validator_key.json` on the node;
a remote signer does not make that file go away, you do:

1. Copy `config/priv_validator_key.json` to an **offline** machine and
   shard it there (`horcrux create-shares …`, or import it into tmkms).
   Distribute the shards to the cosigners.
2. On the validator host — and on every other host that ever held a copy —
   destroy the file: `shred -u config/priv_validator_key.json`. A validator
   host must never hold the key file once a remote signer exists.
3. Point the node at the signer in `config.toml`:
   `priv_validator_laddr = "tcp://0.0.0.0:1234"` (the address the cosigners
   connect to; firewall it to them). With it set the node signs through the
   socket. It will still create a *new, random* `priv_validator_key.json`
   on the next start if none exists (`LoadOrGenFilePV` runs unconditionally
   in the start command) — that file is a throwaway, not your validator
   key; do not mistake its reappearance for a restore, and do not reuse it.

And two rules about state, both double-sign paths:

- **Never restore `config/` from a backup onto a second host.** A backup
  that contains the key (or the node key plus a state file) is a second
  validator waiting to happen.
- **Never restore or hand-edit `data/priv_validator_state.json`.** It is
  the node's record of the last height it signed; rewinding it is how a
  node signs a second block at the same height. (Remote signers keep their
  own copy of this state; the same rule applies to it.) The
  one-key-one-node rule above applies to the cosigner set as a whole.

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

Run it under systemd. This is the unit the foundation's own validators run,
with the variables filled in:

```ini
[Unit]
Description=Konstellation cosmovisor
After=network-online.target
Wants=network-online.target
# Only if data/ lives on a separate volume (local NVMe, a cloud data disk):
# never let the node start on the bare directory underneath. A host that
# comes back with an empty volume would otherwise start with its key and a
# priv_validator_state.json at height 0 — the double-sign path. With these
# two lines the unit stays inactive (a "node down" page) until the volume
# is mounted.
RequiresMountsFor=/home/konstellation/.konstellationd/data
ConditionPathIsMountPoint=/home/konstellation/.konstellationd/data

[Service]
Type=simple
User=konstellation
Group=konstellation
ExecStart=/usr/local/bin/cosmovisor run start --home /home/konstellation/.konstellationd
Restart=on-failure
RestartSec=3
LimitNOFILE=65535

Environment=DAEMON_NAME=konstellationd
Environment=DAEMON_HOME=/home/konstellation/.konstellationd
# Never true: an upgrade binary reaching a validator without a human
# verifying its checksum is exactly what the release process exists to prevent.
Environment=DAEMON_ALLOW_DOWNLOAD_BINARIES=false
Environment=DAEMON_RESTART_AFTER_UPGRADE=true
# cosmovisor's pre-upgrade backup copies the whole data directory into
# DAEMON_HOME — the boot disk, next to a multi-TB data volume — so the first
# upgrade would fill it. Rollback is your own H−1 snapshot (see Upgrades).
Environment=UNSAFE_SKIP_BACKUP=true

[Install]
WantedBy=multi-user.target
```

## Become a validator

The genesis set is **4 foundation-run validators** created by gentx, on
`testnet-1` and `konstellation-1` alike (`max_validators` is 30, so 26 seats
are empty at genesis). `devnet-1` is not a validator network: it runs one
foundation validator for dapp developers and admits no one. Admission of further validators is **permissioned**
— a recorded decision, opening up in stages by governance — and it is
enforced by the chain, not by policy: `/cosmos.staking.v1beta1.MsgCreateValidator` is
disabled in `x/circuit` genesis state on every network, so a plain
`tx staking create-validator` is refused at submission:

```
circuit breaker disables /cosmos.staking.v1beta1.MsgCreateValidator: unauthorized
```

:::note
This is the decided design. As of 2026-09-21 the genesis tooling does not yet
write the entry (`konstellationd init` produces an empty
`disabled_type_urls`; it is added before the `testnet-1` genesis is cut), so
a local dev chain started with `local_node.sh` does not refuse the message.
:::

Gentx is not a path open to outside operators: it only exists at genesis and
bypasses the message router. "Permissioned" is about who may *validate*;
delegating to any validator is open from genesis.

### The admission procedure

The foundation runs each admission as an announced window (a height
range), from a written runbook. What you do:

1. **Run a synced full node** on the network, behind a sentry, with the
   topology above (`pex = false`, your node id in the sentry's
   `private_peer_ids`), on hosts you control.
2. **Send the foundation** your consensus public key and your operator
   address over the operator channel:

   ```sh
   konstellationd comet show-validator            # or the Horcrux cluster's key
   konstellationd keys show <operator> -a         # kons1…
   konstellationd keys show <operator> --bech val # konsvaloper1…
   ```

3. **Pre-build and pre-sign** the `MsgCreateValidator` and deliver it as a
   file. The lead dry-runs it (`tx validate-signatures`) and checks the
   pubkey, amounts and commission against what was agreed; nothing is
   broadcast yet — broadcasting now is refused by the breaker anyway.

   The transaction is signed *now* but executes *later*, so it has to be
   correct for the window, not for the moment you sign it. Three things
   are easy to get wrong and each one wastes the window:

   - **Fee.** `--generate-only` without gas flags produces a tx with an
     empty fee (`fee.amount: []`), which fails inside the window with
     `insufficient fee` whenever the base fee is above zero — it starts at
     1 gwei at genesis, and the public RPC floors at 1 gwei. Set an explicit
     gas limit and a price with margin: `--gas 300000 --gas-prices
     10000000000esp` (10 gwei).
   - **Expiry.** Set `--timeout-height` to the window's end plus a margin,
     so a signed tx that misses the window cannot be replayed into a later
     one you did not agree to.
   - **Sequence.** The signature covers your account's sequence number.
     **Send nothing from the operator account between signing and the
     window**, or the tx is rejected for a sequence mismatch.

   ```sh
   konstellationd tx staking create-validator validator.json \
     --from <operator> --chain-id <net> --node <rpc> \
     --gas 300000 --gas-prices 10000000000esp --timeout-height <window end + margin> \
     --generate-only > unsigned.json
   konstellationd tx sign unsigned.json --from <operator> --chain-id <net> --node <rpc> \
     --gas 300000 --gas-prices 10000000000esp --timeout-height <window end + margin> \
     > signed-create-validator.json
   ```

4. **During the window** the 3-of-5 operations multisig resets the breaker
   for that message type, your signed `create-validator` is broadcast, and
   the multisig disables the type again — aimed at one block, at most a
   window of seconds. A message that fails inside the window (wrong
   commission, insufficient funds, bad pubkey) means a *new* window, not an
   open gate, so get the parameters right first.

Parameters that bind: `commission_rate` ≥ `min_commission_rate`
**5 %**, `min_self_delegation` ≤ what you actually self-delegate (it can be
raised later, never lowered; amounts are in `esp`, `1000000000000000000` is
1 KASH), unbonding **21 days**, downtime slash **0.01 %** (miss more than
50 % of a 100-block window; 10-minute jail, then `tx slashing unjail`),
double-sign slash **5 %** with permanent tombstone.

A validator admitted this way enters the active set immediately (≥ 1 KASH
self-delegated qualifies for an empty seat) and stays until it unbonds or is
jailed. Going permissionless is a governance proposal that removes the type
from the disabled list for good; the stages are in the whitepaper roadmap.

## Upgrades

Auto-download is off. For each upgrade, `networks/<net>/upgrades/<name>.md`
gives the upgrade name, halt height, binary URL, SHA256, any `config.toml` /
`app.toml` changes and a rollback note. Stage the binary by hand, verifying
it exactly as at install time:

```sh
VERSION=<from the upgrade doc>; NAME=<upgrade name from the upgrade doc>
curl -fsSLO "https://github.com/Konstellation-Network/konstellation/releases/download/${VERSION}/konstellationd-${VERSION}-linux-amd64"
sha256sum -c <<< "<sha256 from the upgrade doc>  konstellationd-${VERSION}-linux-amd64"
gh attestation verify "konstellationd-${VERSION}-linux-amd64" \
  --repo Konstellation-Network/konstellation \
  --signer-workflow Konstellation-Network/konstellation/.github/workflows/release.yml
mkdir -p "$DAEMON_HOME/cosmovisor/upgrades/${NAME}/bin"
install -m 0755 "konstellationd-${VERSION}-linux-amd64" "$DAEMON_HOME/cosmovisor/upgrades/${NAME}/bin/konstellationd"
```

Cosmovisor swaps at the governance-set halt height; you do not need to be
awake. On mainnet the height comes from a `MsgSoftwareUpgrade` proposal; on
`testnet-1` the foundation's fleet is upgraded with Ansible and the same
proposal is submitted so the governance path is rehearsed. Every release
rolls out in the same order: `testnet-1` first, then `devnet-1` one to two
weeks before mainnet, then `konstellation-1`. See
[Upgrades](/upgrades) for the log of what has shipped.

**Rollback.** The unit above runs with `UNSAFE_SKIP_BACKUP=true`, so your
rollback is the snapshot **you** take of `data/` at H−1 with the node
stopped (or a filesystem snapshot of the data volume). Two rules:

- If you ever restore `data/` from that snapshot, **keep the current
  `data/priv_validator_state.json`** — the snapshot's copy is from a lower
  height, and a node that re-signs at a height it already signed is
  tombstoned.
- For a **failed upgrade handler** (the node panics at the upgrade height —
  the common case) do **not** restore data at all: the validators have
  already precommitted block H. Repoint `cosmovisor/current` at the
  previous version, move `data/upgrade-info.json` aside, and start the old
  binary with `--unsafe-skip-upgrades <H>` until the network has agreed
  what happens next. Block H stands; nothing is re-signed.

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

At genesis the validator set is 4 foundation-run validators
(`max_validators` 30); independent operators are admitted afterwards through
the permissioned procedure above — `testnet-1` rehearses
exactly what mainnet runs, admissions included. Governance on `testnet-1` is deliberately
fast (2-hour voting period) so upgrade drills take hours, not days;
everything economic is identical to mainnet. `testnet-1` is where new
releases land first and where upgrade drills, chaos tests and halt/restart
drills happen, so expect planned disruption.

If something breaks, [Troubleshooting](/troubleshooting) has the errors we
know about.
