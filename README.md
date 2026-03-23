<div align="center">

# TDM for Obsidian

<img src="https://img.shields.io/badge/TDM-Obsidian-ff69b4?style=for-the-badge&logo=obsidian&logoColor=white" alt="TDM Obsidian" />

**Desktop-First Note Monetization**

[![License: MIT](https://img.shields.io/badge/License-MIT-ff69b4?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-ff69b4?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
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

TDM for Obsidian [V0.0.1-BETA]
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

This plugin is intentionally a **creator-layer** on top of the core TDM product.
The main TDM surface is still paid APIs, tools, routes, and agent/runtime
execution. Obsidian is the fast note-monetization path built on top of that
same payment layer.

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

If the CLI is missing, install it with:

```bash
npm install -g tdm-sdk
```

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
- `Gateway URL`
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
tdm_service_id: srv_xyz789
tdm_endpoint_path: /api/notes/unlock
tdm_delivery_type: content
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
