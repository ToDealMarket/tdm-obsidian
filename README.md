# TDM for Obsidian

Desktop-first Obsidian plugin for the simplest TDM note flow:

1. connect once
2. make the current note payable
3. unlock a paid note
4. check creator balance
5. request payout of publisher credits

This plugin is intentionally a creator-layer on top of the core TDM product.
The main TDM surface is still paid APIs, tools, routes, and agent/runtime
execution. Obsidian is the fast note-monetization path built on top of that
same payment layer.

## Current scope

This plugin is intentionally narrow:

- works with desktop Obsidian only
- expects the `tdm` CLI from `tdm-sdk` to be installed
- uses your configured public notes base URL to build the shareable note URL
- updates note frontmatter with TDM fields after registration

If the CLI is missing, install it with:

```bash
npm install -g tdm-sdk
```

## Commands

- `TDM: Connect`
- `TDM: Make current note payable`
- `TDM: Unlock current note`
- `TDM: Check creator balance`
- `TDM: Withdraw publisher credits`

## Settings

- `TDM CLI path`
- `Gateway URL`
- `Named vault`
- `Inline unlock mode`
- `Public notes base URL`
- `Public path prefix`
- `Public extension`
- `Default price in USD`
- `Default withdraw chain`

## Important limits

- this plugin does not publish notes for you
- it assumes your note already has a public URL strategy
- `Make payable` uses the current note path plus your public URL settings
- paid note delivery uses the current TDM note unlock flow
- the plugin is a thin UX layer over the public TDM CLI and payment surface
- it relies on structured CLI output such as `tdm make payable --json`, `tdm unlock --json`, `tdm balance --json`, and `tdm payout request --json`
- inline unlock does not auto-copy the paid content to the clipboard
- default mode is `Read-only preview`, which opens paid content without writing a new note into your workspace
- optional mode is `Create unlocked note`, which is better for reusable knowledge, skills, and agent-oriented note workflows
- neither mode can promise perfect anti-copy protection once content is visible to the buyer; the goal is to avoid automatic leaking, not to claim DRM

## Suggested note flow

1. Install `tdm-sdk`
2. Install this plugin
3. Set your public notes base URL
4. Run `TDM: Connect`
5. Open a note
6. Run `TDM: Make current note payable`
7. On another machine or another TDM setup, open the teaser note and run `TDM: Unlock current note`

After that, the plugin stores fields like:

- `tdm_price_usd`
- `tdm_public_url`
- `tdm_resource_key`
- `tdm_service_id`
- `tdm_endpoint_path`
- `tdm_delivery_type`
- `tdm_last_synced_at`
