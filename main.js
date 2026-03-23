"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TdmObsidianPlugin
});
module.exports = __toCommonJS(main_exports);
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var import_obsidian = require("obsidian");
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
var DEFAULT_GATEWAY_URL = "https://tdm.todealmarket.com";
var DEFAULT_SETTINGS = {
  cliPath: "tdm",
  gatewayUrl: DEFAULT_GATEWAY_URL,
  vaultName: "",
  unlockMode: "preview",
  publicBaseUrl: "",
  publicPathPrefix: "",
  publicExtension: ".html",
  defaultPriceUsd: "4.99",
  defaultWithdrawChain: "solana"
};
var CLI_INSTALL_HINT = "TDM CLI not found. Run: npm install -g tdm-sdk";
function extractJsonPayload(stdout) {
  const trimmed = stdout.trim();
  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const starts = [objectStart, arrayStart].filter((value) => value >= 0);
  const jsonStart = starts.length > 0 ? Math.min(...starts) : -1;
  if (jsonStart < 0) {
    throw new Error("No JSON payload found in CLI output.");
  }
  return JSON.parse(trimmed.slice(jsonStart));
}
function isCliNotFoundError(message) {
  return /\bENOENT\b/i.test(message) || /\bnot found\b/i.test(message) || /\bnot recognized\b/i.test(message) || /\bcannot find\b/i.test(message);
}
function buildCliErrorMessage(message, stdout, stderr) {
  const output = [stderr, stdout].filter(Boolean).join("\n\n").trim();
  if (isCliNotFoundError(message)) {
    return [CLI_INSTALL_HINT, output].filter(Boolean).join("\n\n");
  }
  return [message, output].filter(Boolean).join("\n\n");
}
var SingleInputModal = class extends import_obsidian.Modal {
  value;
  titleText;
  fieldName;
  placeholder;
  resolvePromise;
  constructor(app, options) {
    super(app);
    this.titleText = options.title;
    this.fieldName = options.fieldName;
    this.placeholder = options.placeholder;
    this.value = options.initialValue;
    this.resolvePromise = options.resolve;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tdm-obsidian-modal");
    contentEl.createEl("h2", { text: this.titleText });
    let submitted = false;
    new import_obsidian.Setting(contentEl).setName(this.fieldName).addText((text) => {
      text.setPlaceholder(this.placeholder).setValue(this.value).onChange((value) => {
        this.value = value;
      });
      setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian.Setting(contentEl).addButton((button) => {
      button.setButtonText("Cancel").onClick(() => {
        submitted = true;
        this.close();
        this.resolvePromise(null);
      });
    }).addButton((button) => {
      button.setButtonText("Continue").setCta().onClick(() => {
        submitted = true;
        this.close();
        this.resolvePromise(this.value.trim() || null);
      });
    });
    this.onClose = () => {
      contentEl.empty();
      if (!submitted) {
        this.resolvePromise(null);
      }
    };
  }
};
var WithdrawModal = class extends import_obsidian.Modal {
  amountUsd;
  destinationAddress;
  chain;
  resolvePromise;
  constructor(app, initial, resolve) {
    super(app);
    this.amountUsd = initial.amountUsd;
    this.destinationAddress = initial.destinationAddress;
    this.chain = initial.chain;
    this.resolvePromise = resolve;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tdm-obsidian-modal");
    contentEl.createEl("h2", { text: "Withdraw publisher credits" });
    let submitted = false;
    new import_obsidian.Setting(contentEl).setName("Amount in USD").addText((text) => {
      text.setPlaceholder("12.50").setValue(this.amountUsd).onChange((value) => {
        this.amountUsd = value;
      });
    });
    new import_obsidian.Setting(contentEl).setName("Destination wallet").addText((text) => {
      text.setPlaceholder("Destination address").setValue(this.destinationAddress).onChange((value) => {
        this.destinationAddress = value;
      });
    });
    new import_obsidian.Setting(contentEl).setName("Chain").addDropdown((dropdown) => {
      dropdown.addOption("solana", "Solana").addOption("base", "Base").setValue(this.chain).onChange((value) => {
        this.chain = value === "base" ? "base" : "solana";
      });
    });
    new import_obsidian.Setting(contentEl).addButton((button) => {
      button.setButtonText("Cancel").onClick(() => {
        submitted = true;
        this.close();
        this.resolvePromise(null);
      });
    }).addButton((button) => {
      button.setButtonText("Request payout").setCta().onClick(() => {
        submitted = true;
        this.close();
        this.resolvePromise({
          amountUsd: this.amountUsd.trim(),
          destinationAddress: this.destinationAddress.trim(),
          chain: this.chain
        });
      });
    });
    this.onClose = () => {
      contentEl.empty();
      if (!submitted) {
        this.resolvePromise(null);
      }
    };
  }
};
var OutputModal = class extends import_obsidian.Modal {
  titleText;
  bodyText;
  constructor(app, title, body) {
    super(app);
    this.titleText = title;
    this.bodyText = body;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tdm-obsidian-modal");
    contentEl.createEl("h2", { text: this.titleText });
    contentEl.createDiv({ cls: "tdm-obsidian-result", text: this.bodyText });
  }
};
var TdmObsidianPlugin = class extends import_obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TdmObsidianSettingTab(this.app, this));
    this.addCommand({
      id: "tdm-connect",
      name: "TDM: Connect",
      callback: async () => {
        await this.runConnect();
      }
    });
    this.addCommand({
      id: "tdm-make-current-note-payable",
      name: "TDM: Make current note payable",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.runMakeCurrentNotePayable(file);
        }
        return true;
      }
    });
    this.addCommand({
      id: "tdm-check-creator-balance",
      name: "TDM: Check creator balance",
      callback: async () => {
        await this.runCheckCreatorBalance();
      }
    });
    this.addCommand({
      id: "tdm-unlock-current-note",
      name: "TDM: Unlock current note",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.runUnlockCurrentNote(file);
        }
        return true;
      }
    });
    this.addCommand({
      id: "tdm-withdraw-publisher-credits",
      name: "TDM: Withdraw publisher credits",
      callback: async () => {
        await this.runWithdrawPublisherCredits();
      }
    });
  }
  async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...await this.loadData()
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  getActiveMarkdownFile() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    return view?.file ?? null;
  }
  requireDesktopFilesystemPath(file) {
    if (!(this.app.vault.adapter instanceof import_obsidian.FileSystemAdapter)) {
      throw new Error("TDM for Obsidian currently supports desktop vaults only.");
    }
    return this.app.vault.adapter.getFullPath(file.path);
  }
  buildCliArgs(baseArgs) {
    const args = [...baseArgs];
    const vaultName = this.settings.vaultName.trim();
    if (vaultName) {
      args.push("--vault", vaultName);
    }
    return args;
  }
  async runCliCommand(args, options = {}) {
    try {
      const result = await execFileAsync(this.settings.cliPath, args, {
        timeout: options.timeoutMs ?? 6e4,
        shell: process.platform === "win32",
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
      });
      return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? ""
      };
    } catch (error) {
      const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout ?? "") : "";
      const stderr = typeof error === "object" && error && "stderr" in error ? String(error.stderr ?? "") : "";
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(buildCliErrorMessage(message, stdout, stderr));
    }
  }
  async promptForPrice(initialValue) {
    return await new Promise((resolve) => {
      new SingleInputModal(this.app, {
        title: "Make current note payable",
        fieldName: "Price in USD",
        placeholder: "4.99",
        initialValue,
        resolve
      }).open();
    });
  }
  async promptForWithdraw(initialDestinationAddress = "") {
    return await new Promise((resolve) => {
      new WithdrawModal(
        this.app,
        {
          amountUsd: "",
          destinationAddress: initialDestinationAddress,
          chain: this.settings.defaultWithdrawChain
        },
        resolve
      ).open();
    });
  }
  buildPublicUrl(file) {
    const baseUrl = this.settings.publicBaseUrl.trim();
    if (!baseUrl) {
      throw new Error("Set Public notes base URL in plugin settings first.");
    }
    const prefix = this.settings.publicPathPrefix.trim().replace(/^\/+|\/+$/g, "");
    const extension = this.settings.publicExtension.trim();
    let relativePath = (0, import_obsidian.normalizePath)(file.path);
    if (extension) {
      relativePath = relativePath.replace(/\.md$/i, extension);
    }
    const pathParts = [prefix, relativePath].filter(Boolean).join("/").split("/").filter(Boolean).map((part) => encodeURIComponent(part));
    return `${baseUrl.replace(/\/+$/g, "")}/${pathParts.join("/")}`;
  }
  async updateFrontmatter(file, data) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter["tdm_price_usd"] = data.priceUsd;
      frontmatter["tdm_public_url"] = data.publicUrl;
      frontmatter["tdm_resource_key"] = data.resourceKey ?? frontmatter["tdm_resource_key"] ?? "";
      frontmatter["tdm_service_id"] = data.serviceId ?? frontmatter["tdm_service_id"] ?? "";
      frontmatter["tdm_endpoint_path"] = data.endpointPath ?? frontmatter["tdm_endpoint_path"] ?? "";
      frontmatter["tdm_delivery_type"] = data.deliveryType ?? frontmatter["tdm_delivery_type"] ?? "";
      frontmatter["tdm_last_synced_at"] = (/* @__PURE__ */ new Date()).toISOString();
    });
  }
  async allocateUnlockedNotePath(file) {
    const basePath = file.path.replace(/\.md$/i, "");
    const initial = `${basePath}.unlocked.md`;
    const existing = this.app.vault.getAbstractFileByPath(initial);
    if (!existing) {
      return initial;
    }
    for (let index = 2; index <= 1e3; index += 1) {
      const candidate = `${basePath}.unlocked-${index}.md`;
      if (!this.app.vault.getAbstractFileByPath(candidate)) {
        return candidate;
      }
    }
    throw new Error("Could not allocate an unlocked note path.");
  }
  async getUnlockMetadata(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const resourceId = String(frontmatter["tdm_resource_key"] ?? "").trim() || String(frontmatter["tdm_public_url"] ?? "").trim();
    const priceUsd = String(frontmatter["tdm_price_usd"] ?? "").trim();
    if (!resourceId || !priceUsd) {
      throw new Error(
        "This note is missing TDM unlock metadata. Expected tdm_resource_key or tdm_public_url plus tdm_price_usd in frontmatter."
      );
    }
    return { resourceId, priceUsd };
  }
  async runConnect() {
    new import_obsidian.Notice("TDM connect is starting. Complete the wallet flow in your browser.", 5e3);
    const args = this.buildCliArgs(["connect", "--gateway", this.settings.gatewayUrl.trim() || DEFAULT_GATEWAY_URL]);
    try {
      const result = await this.runCliCommand(args, { timeoutMs: 5 * 6e4 });
      new import_obsidian.Notice("TDM connect completed.", 4e3);
      if (result.stdout.trim()) {
        new OutputModal(this.app, "TDM connect", result.stdout.trim()).open();
      }
    } catch (error) {
      new OutputModal(
        this.app,
        "TDM connect failed",
        error instanceof Error ? error.message : String(error)
      ).open();
    }
  }
  async runMakeCurrentNotePayable(file) {
    const activePrice = String(this.app.metadataCache.getFileCache(file)?.frontmatter?.["tdm_price_usd"] ?? "").trim() || this.settings.defaultPriceUsd;
    const priceUsd = await this.promptForPrice(activePrice);
    if (!priceUsd) {
      return;
    }
    let publicUrl;
    try {
      publicUrl = this.buildPublicUrl(file);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : String(error), 6e3);
      return;
    }
    const fullPath = this.requireDesktopFilesystemPath(file);
    const args = this.buildCliArgs([
      "make",
      "payable",
      fullPath,
      "--price",
      priceUsd,
      "--mode",
      "url",
      "--public-url",
      publicUrl,
      "--inline-file",
      fullPath,
      "--delivery-content-type",
      "text/markdown",
      "--name",
      file.basename,
      "--json"
    ]);
    new import_obsidian.Notice("Registering payable note with TDM...", 4e3);
    try {
      const result = await this.runCliCommand(args, { timeoutMs: 9e4 });
      const payload = extractJsonPayload(result.stdout);
      const registration = payload.registration ?? {};
      await this.updateFrontmatter(file, {
        priceUsd: registration.requested_price_usd ?? priceUsd,
        publicUrl,
        resourceKey: registration.resource_key,
        serviceId: registration.tdm_service_id,
        endpointPath: registration.endpoint_path,
        deliveryType: registration.delivery_type ?? "INLINE"
      });
      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch {
      }
      new import_obsidian.Notice("Note is now payable. Shareable URL copied when available.", 5e3);
    } catch (error) {
      new OutputModal(
        this.app,
        "Make payable failed",
        error instanceof Error ? error.message : String(error)
      ).open();
    }
  }
  async runUnlockCurrentNote(file) {
    let metadata;
    try {
      metadata = await this.getUnlockMetadata(file);
    } catch (error) {
      new OutputModal(
        this.app,
        "Unlock unavailable",
        error instanceof Error ? error.message : String(error)
      ).open();
      return;
    }
    new import_obsidian.Notice("Unlocking note with TDM...", 4e3);
    try {
      const result = await this.runCliCommand(
        this.buildCliArgs([
          "unlock",
          metadata.resourceId,
          "--price",
          metadata.priceUsd,
          "--json"
        ]),
        { timeoutMs: 9e4 }
      );
      const payload = extractJsonPayload(result.stdout);
      if (!payload.ok) {
        throw new Error(payload.error ?? payload.reason ?? "Unlock failed.");
      }
      if (payload.delivery_type === "INLINE" && typeof payload.content === "string") {
        if (this.settings.unlockMode === "preview") {
          new OutputModal(
            this.app,
            "Unlocked note preview",
            payload.content
          ).open();
          new import_obsidian.Notice(
            "Unlocked content opened in read-only preview. It was not written to your vault.",
            5e3
          );
          return;
        }
        const unlockedPath = await this.allocateUnlockedNotePath(file);
        const unlockedFile = await this.app.vault.create(unlockedPath, payload.content);
        await this.app.workspace.getLeaf(true).openFile(unlockedFile);
        new import_obsidian.Notice("Unlocked note created in your vault.", 5e3);
        return;
      }
      if (payload.delivery_type === "REDIRECT" && payload.redirect_url) {
        try {
          await navigator.clipboard.writeText(payload.redirect_url);
        } catch {
        }
        new OutputModal(
          this.app,
          "External delivery unlocked",
          `Open this delivery URL:

${payload.redirect_url}

The URL was copied when possible.`
        ).open();
        return;
      }
      throw new Error("Unlock succeeded but delivery payload was not recognized.");
    } catch (error) {
      new OutputModal(
        this.app,
        "Unlock failed",
        error instanceof Error ? error.message : String(error)
      ).open();
    }
  }
  async runCheckCreatorBalance() {
    try {
      const result = await this.runCliCommand(
        this.buildCliArgs(["balance", "--json"]),
        { timeoutMs: 2e4 }
      );
      const payload = extractJsonPayload(result.stdout);
      new OutputModal(
        this.app,
        "Creator balance",
        [
          `Publisher credits: $${payload.publisher_credits_usd ?? "0"}`,
          `Main balance: $${payload.main_balance_usd ?? "0"}`,
          `Pending balance: $${payload.pending_balance_usd ?? "0"}`,
          payload.wallet_id ? `Wallet: ${payload.wallet_id}` : ""
        ].filter(Boolean).join("\n")
      ).open();
    } catch (error) {
      new OutputModal(
        this.app,
        "Balance check failed",
        error instanceof Error ? error.message : String(error)
      ).open();
    }
  }
  async runWithdrawPublisherCredits() {
    const request = await this.promptForWithdraw();
    if (!request) {
      return;
    }
    if (!request.amountUsd || !request.destinationAddress) {
      new import_obsidian.Notice("Amount and destination wallet are required.", 5e3);
      return;
    }
    try {
      const result = await this.runCliCommand(
        this.buildCliArgs([
          "payout",
          "request",
          "--amount",
          request.amountUsd,
          "--to",
          request.destinationAddress,
          "--chain",
          request.chain,
          "--json"
        ]),
        { timeoutMs: 3e4 }
      );
      const payload = extractJsonPayload(result.stdout);
      new OutputModal(
        this.app,
        "Payout requested",
        [
          `Payout ID: ${payload.payout_id ?? "pending"}`,
          `Chain: ${payload.chain ?? request.chain.toUpperCase()}`,
          `Destination: ${payload.destination_address ?? request.destinationAddress}`,
          `Remaining credits: $${payload.remaining_credits_usd ?? "0"}`,
          `Status: ${payload.status ?? "PENDING_EXECUTION"}`
        ].join("\n")
      ).open();
    } catch (error) {
      new OutputModal(
        this.app,
        "Withdraw failed",
        error instanceof Error ? error.message : String(error)
      ).open();
    }
  }
};
var TdmObsidianSettingTab = class extends import_obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "TDM for Obsidian" });
    new import_obsidian.Setting(containerEl).setName("TDM CLI path").setDesc("Path to the installed `tdm` command. Leave as `tdm` when it is already on PATH.").addText(
      (text) => text.setPlaceholder("tdm").setValue(this.plugin.settings.cliPath).onChange(async (value) => {
        this.plugin.settings.cliPath = value.trim() || "tdm";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Gateway URL").setDesc("One-time connect will use this gateway URL.").addText(
      (text) => text.setPlaceholder(DEFAULT_GATEWAY_URL).setValue(this.plugin.settings.gatewayUrl).onChange(async (value) => {
        this.plugin.settings.gatewayUrl = value.trim() || DEFAULT_GATEWAY_URL;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Named vault").setDesc("Optional named vault such as photos, music, or market-bots.").addText(
      (text) => text.setPlaceholder("photos").setValue(this.plugin.settings.vaultName).onChange(async (value) => {
        this.plugin.settings.vaultName = value.trim().toLowerCase();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Inline unlock mode").setDesc(
      "Preview = human reading. Create unlocked note = reusable knowledge, skills, and agent use."
    ).addDropdown(
      (dropdown) => dropdown.addOption("preview", "Read-only preview").addOption("vault_note", "Create unlocked note").setValue(this.plugin.settings.unlockMode).onChange(async (value) => {
        this.plugin.settings.unlockMode = value === "vault_note" ? "vault_note" : "preview";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Public notes base URL").setDesc("Base URL where your published notes live, for example https://notes.example.com.").addText(
      (text) => text.setPlaceholder("https://notes.example.com").setValue(this.plugin.settings.publicBaseUrl).onChange(async (value) => {
        this.plugin.settings.publicBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Public path prefix").setDesc("Optional prefix inside the public site, for example blog or premium.").addText(
      (text) => text.setPlaceholder("premium").setValue(this.plugin.settings.publicPathPrefix).onChange(async (value) => {
        this.plugin.settings.publicPathPrefix = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Public extension").setDesc("How local .md notes are mapped to public URLs, for example .html.").addText(
      (text) => text.setPlaceholder(".html").setValue(this.plugin.settings.publicExtension).onChange(async (value) => {
        this.plugin.settings.publicExtension = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default price in USD").setDesc("Starting price shown when making a note payable.").addText(
      (text) => text.setPlaceholder("4.99").setValue(this.plugin.settings.defaultPriceUsd).onChange(async (value) => {
        this.plugin.settings.defaultPriceUsd = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default withdraw chain").setDesc("Default chain used for publisher payout requests.").addDropdown(
      (dropdown) => dropdown.addOption("solana", "Solana").addOption("base", "Base").setValue(this.plugin.settings.defaultWithdrawChain).onChange(async (value) => {
        this.plugin.settings.defaultWithdrawChain = value === "base" ? "base" : "solana";
        await this.plugin.saveSettings();
      })
    );
  }
};
