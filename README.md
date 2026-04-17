<div align="center">

# TDM for Obsidian

<img src="https://img.shields.io/badge/TDM-Obsidian-ff69b4?style=for-the-badge&logo=obsidian&logoColor=white" alt="TDM Obsidian" />

**Desktop-First Note Monetization**

[![License: MIT](https://img.shields.io/badge/License-MIT-ff69b4?style=flat-square)](./LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-ff69b4?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md/)

*Desktop-first Obsidian plugin for the simplest TDM note flow: connect, monetize, unlock, and withdraw.*

[Documentation](https://todealmarket.com/docs) • [TDM SDK](https://github.com/ToDealMarket/tdm-sdk) • [GitHub](https://github.com/todealmarket) • [X/Twitter](https://x.com/todealmarket)

```
████████╗ ██████╗  ███╗   ███╗
╚══██╔══╝ ██╔══██╗ ████╗ ████║
   ██║    ██║  ██║ ██╔████╔██║
   ██║    ██║  ██║ ██║╚██╔╝██║
   ██║    ██████╔╝ ██║ ╚═╝ ██║
   ╚═╝    ╚═════╝  ╚═╝     ╚═╝

TDM for Obsidian [V0.0.2]
Desktop-First Note Monetization
Mode: local-first | Docs: todealmarket.com/docs
```

</div>

---

## What is TDM for Obsidian?

Desktop-first Obsidian plugin for the simplest TDM note flow:

1. **Connect once** - Set up your TDM wallet and payment credentials
2. **Make notes payable** - Turn any note into a paid resource
3. **Unlock paid notes** - Purchase and access protected content
4. **Check creator balance** - Monitor your earnings
5. **Request payout** - Withdraw your publisher credits

In the normal desktop path, `TDM: Connect` remains the explicit one-time setup.
Under the hood, the broader `tdm` CLI can now auto-start that same Live TDM
setup when a live seller command is launched before setup is ready.

For the current multi-wallet MVP, you can connect one wallet per supported
network. In practice, that means one Solana wallet and one Base/EVM wallet can
be linked for the same local TDM setup, while payout wallets remain
network-specific.

If the creator wants the same connected wallet to also become the saved live
payout wallet during setup, the underlying CLI now attempts that sync
automatically when the inferred chain slot is still empty.

- existing saved payout wallets are not overwritten automatically
- `tdm connect --no-sync-payout-wallet` keeps the flow local-only
- if the account protects new payout destinations with TOTP step-up, run
  `tdm security totp enroll`, then `tdm security totp verify`, and rerun
  `tdm connect` or use `tdm payout wallets set`

`tdm security totp enroll` now opens a local setup page with a QR by default.
Use `--no-browser` if you want terminal-only setup with the secret or
`otpauth://` URL.

This plugin is intentionally a **creator-layer** on top of the core TDM product.
The main TDM surface is still paid APIs, tools, routes, and agent/runtime
execution. Obsidian is the fast note-monetization path built on top of that
same payment layer.

For advanced desktop creators, the same `tdm` CLI can also manage named local
storage roots and runtime catalogs outside individual note URLs:

- `tdm storage add`
- `tdm storage import-dir`
- `tdm storage sync`
- `tdm storage publish`
- `tdm workspace`
- `tdm status`
- `tdm workspace status`

That is the broader runtime catalog path when a creator wants to keep assets on
their own machine or server and still price them through TDM.

If that broader runtime contour also uses agents or guarded routes, TDM now
supports an optional allowlist policy at the project or vault level. This is
not required for the normal note monetization flow, and leaving it unset keeps
the runtime flexible by default.

---

## Current Scope

<table>
<tr>
<td width="50%">

### Platform Support
- Desktop Obsidian only
- Requires `tdm` CLI from `tdm-sdk`
- Uses configured public notes base URL
- Updates note frontmatter with TDM fields
- Depends on the CLI/runtime path from `tdm-sdk`; it does not embed the newer gateway facade clients directly

</td>
<td width="50%">

### Core Commands
- `TDM: Connect`
- `TDM: Make current note payable`
- `TDM: Unlock current note`
- `TDM: Check creator balance`
- `TDM: Withdraw publisher credits`

</td>
</tr>
</table>

### Installation

#### Option 1: Manual Installation from GitHub

1. Download the latest release from [GitHub Releases](https://github.com/todealmarket/tdm-obsidian/releases)
2. Extract the following files from the release:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. Create a folder named `tdm-obsidian` in your Obsidian vault's plugins directory:
   - Windows: `<vault>/.obsidian/plugins/tdm-obsidian/`
   - macOS: `<vault>/.obsidian/plugins/tdm-obsidian/`
   - Linux: `<vault>/.obsidian/plugins/tdm-obsidian/`
4. Copy the three files into that folder
5. Restart Obsidian
6. Go to Settings → Community plugins → Enable "TDM for Obsidian"

#### Option 2: Build from Source

```bash
git clone https://github.com/todealmarket/tdm-obsidian.git
cd tdm-obsidian
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder.

#### CLI Dependency

The plugin requires the TDM CLI. Install it globally:

```bash
npm install -g tdm-sdk
```

## Obsidian Community Release Notes

This repository now matches the expected Community Plugin release shape:

- `manifest.json`
- `versions.json`
- `main.js`
- `styles.css`
- `LICENSE`

For GitHub Releases, upload `main.js`, `manifest.json`, and `styles.css` as
separate assets and tag the release exactly as `0.0.1`.

---

---

## Commands

<table>
<tr>
<td width="50%">

### Setup & Connection
- **`TDM: Connect`** - One-time wallet and payment setup

### Note Management
- **`TDM: Make current note payable`** - Register note as paid resource
- **`TDM: Unlock current note`** - Purchase and access protected content

</td>
<td width="50%">

### Creator Tools
- **`TDM: Check creator balance`** - View your earnings
- **`TDM: Withdraw publisher credits`** - Request payout

</td>
</tr>
</table>

---

---

## Settings

<table>
<tr>
<td width="50%">

### Connection Settings
- `TDM CLI path`
- `Live TDM URL`
- `Named vault`

### Unlock Behavior
- `Inline unlock mode`
- Default: `Read-only preview`
- Optional: `Create unlocked note`

</td>
<td width="50%">

### Publishing Settings
- `Public notes base URL`
- `Public path prefix`
- `Public extension`

### Pricing & Payout
- `Default price in USD`
- `Default withdraw chain`

</td>
</tr>
</table>

---

---

## Important Limits

- This plugin **does not publish notes** for you
- It assumes your note already has a **public URL strategy**
- `Make payable` uses the current note path plus your public URL settings
- Paid note delivery uses the current TDM note unlock flow
- The plugin is a **thin UX layer** over the public TDM CLI and payment surface
- It relies on structured CLI output such as:
  - `tdm make payable --json`
  - `tdm unlock --json`
  - `tdm balance --json`
  - `tdm payout request --json`
- Inline unlock does **not auto-copy** the paid content to the clipboard
- Default mode is `Read-only preview`, which opens paid content without writing a new note into your workspace
- Optional mode is `Create unlocked note`, which is better for reusable knowledge, skills, and agent-oriented note workflows
- Neither mode can promise perfect anti-copy protection once content is visible to the buyer; the goal is to avoid automatic leaking, not to claim DRM

---

## Suggested Note Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    TDM OBSIDIAN WORKFLOW                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

    ┌────────────────┐    ┌────────────────┐    ┌────────────────────┐
    │                │    │                │    │                    │
    │  1. Install    │───▶│ 2. Connect     │───▶│ 3. Configure       │
    │  tdm-sdk       │    │ TDM wallet     │    │ public URL         │
    │                │    │                │    │                    │
    └────────────────┘    └────────────────┘    └────────────────────┘
             │                      │                      │
             │                      │                      │
             ▼                      ▼                      ▼
    ┌────────────────┐    ┌────────────────┐    ┌────────────────────┐
    │ 4. Open note   │    │ 5. Make        │    │ 6. Share &         │
    │ in Obsidian    │    │ payable        │    │ unlock             │
    │                │    │                │    │                    │
    └────────────────┘    └────────────────┘    └────────────────────┘
```

### Step-by-Step

1. **Install `tdm-sdk`**
   ```bash
   npm install -g tdm-sdk
   ```

2. **Install this plugin** in Obsidian

3. **Set your public notes base URL** in plugin settings

4. **Run `TDM: Connect`** to set up your wallet

5. **Open a note** you want to monetize

6. **Run `TDM: Make current note payable`** to register it

7. **On another machine or another TDM setup**, open the teaser note and run `TDM: Unlock current note`

---

## Note Frontmatter

After making a note payable, the plugin stores fields like:

```yaml
---
tdm_price_usd: 5.00
tdm_public_url: https://notes.example.com/my-note
tdm_resource_key: res_abc123
tdm_service_id: svc_note_unlock_a1b2c3d4
tdm_endpoint_path: /api/notes/unlock
tdm_delivery_type: INLINE
tdm_last_synced_at: 2026-03-23T10:30:00Z
---
```

---

## Security Notes

- **No private keys in this plugin** - Keys are stored securely in OS keyring via TDM CLI
- **Desktop only** - Mobile Obsidian is not supported
- **CLI dependency** - Requires `tdm-sdk` to be installed globally
- **Public URL required** - You must configure your own note publishing strategy
- **Review local automations carefully** - Especially when using advanced local signer flows

---

## Documentation

- [TDM Documentation](https://todealmarket.com/docs)
- [TDM SDK Reference](https://todealmarket.com/docs/api/sdk)
- [Session Fuel & Settlement](https://todealmarket.com/docs/settlement)

---

## License

MIT License - see [LICENSE](./LICENSE) for details

---

<div align="center">

**Built by the TDM team**

[Website](https://todealmarket.com) • [Documentation](https://todealmarket.com/docs) • [GitHub](https://github.com/todealmarket) • [X/Twitter](https://x.com/todealmarket)

</div>
