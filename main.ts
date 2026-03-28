import { execFile, type ChildProcess } from "node:child_process";
import {
  App,
  FileSystemAdapter,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";

const DEFAULT_GATEWAY_URL = "https://tdm.todealmarket.com";
const MAX_MODAL_TEXT_LENGTH = 200_000;
const MAX_INLINE_PREVIEW_CHARS = 50_000;

interface TdmObsidianSettings {
  cliPath: string;
  gatewayUrl: string;
  vaultName: string;
  unlockMode: "preview" | "vault_note";
  publicBaseUrl: string;
  publicPathPrefix: string;
  publicExtension: string;
  defaultPriceUsd: string;
  defaultWithdrawChain: "solana" | "base";
}

const DEFAULT_SETTINGS: TdmObsidianSettings = {
  cliPath: "tdm",
  gatewayUrl: DEFAULT_GATEWAY_URL,
  vaultName: "",
  unlockMode: "preview",
  publicBaseUrl: "",
  publicPathPrefix: "",
  publicExtension: ".html",
  defaultPriceUsd: "4.99",
  defaultWithdrawChain: "solana",
};

interface CliResult {
  stdout: string;
  stderr: string;
}

interface MakePayablePayload {
  status?: string;
  mode?: "serve" | "url";
  target?: string;
  local_path?: string;
  served_url?: string;
  public_url?: string;
  registration?: {
    resource_key?: string;
    endpoint_path?: string;
    tdm_service_id?: string;
    requested_price_usd?: string;
    billing_mode?: string;
    delivery_type?: string;
    delivery_content_type?: string;
    max_downloads?: number;
  };
}

interface UnlockPayload {
  ok?: boolean;
  authorization_id?: string;
  resource_id?: string;
  delivery_type?: "INLINE" | "REDIRECT";
  content_type?: string;
  content?: string;
  redirect_url?: string;
  download_count?: number;
  max_downloads?: number | null;
  expires_at?: string;
  error?: string;
  reason?: string;
}

interface BalancePayload {
  account_id?: string;
  wallet_id?: string;
  main_balance_usd?: string;
  pending_balance_usd?: string;
  publisher_credits_usd?: string;
}

interface PayoutPayload {
  payout_id?: string;
  remaining_credits_usd?: string;
  chain?: string;
  destination_address?: string;
  status?: string;
}

const CLI_INSTALL_HINT = "TDM CLI not found. Run: npm install -g tdm-sdk";

function extractJsonPayload<T>(stdout: string): T {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("No JSON payload found in CLI output.");
  }
  const candidateStarts = new Set<number>();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    candidateStarts.add(0);
  }
  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] === "\n") {
      let nextIndex = index + 1;
      while (nextIndex < trimmed.length && /\s/.test(trimmed[nextIndex] ?? "")) {
        nextIndex += 1;
      }
      const nextChar = trimmed[nextIndex];
      if (nextChar === "{" || nextChar === "[") {
        candidateStarts.add(nextIndex);
      }
    }
  }

  for (const start of candidateStarts) {
    const candidate = trimmed.slice(start);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      continue;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const fallbackStarts = [firstBrace, firstBracket].filter((value) => value >= 0);
  if (fallbackStarts.length === 0) {
    throw new Error("No JSON payload found in CLI output.");
  }

  const fallbackStart = Math.min(...fallbackStarts);
  return JSON.parse(trimmed.slice(fallbackStart)) as T;
}

function isCliNotFoundError(message: string): boolean {
  return (
    /\bENOENT\b/i.test(message) ||
    /\bnot found\b/i.test(message) ||
    /\bnot recognized\b/i.test(message) ||
    /\bcannot find\b/i.test(message)
  );
}

function buildCliErrorMessage(message: string, stdout: string, stderr: string): string {
  const output = [stderr, stdout].filter(Boolean).join("\n\n").trim();
  if (isCliNotFoundError(message)) {
    return [CLI_INSTALL_HINT, output].filter(Boolean).join("\n\n");
  }
  return [message, output].filter(Boolean).join("\n\n");
}

function normalizeUsdAmount(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed) || Number(trimmed) <= 0) {
    throw new Error(`${fieldName} must be a positive USD amount with up to 2 decimals.`);
  }
  return trimmed;
}

function normalizeHttpUrl(value: string, fieldName: string): string {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${fieldName} must be a valid absolute URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${fieldName} must use http or https.`);
  }
  return parsed.toString().replace(/\/+$/g, "");
}

function setFrontmatterString(
  frontmatter: Record<string, unknown>,
  key: string,
  nextValue: string | undefined,
  fallbackValue?: unknown,
): void {
  const normalizedNext = typeof nextValue === "string" ? nextValue.trim() : "";
  if (normalizedNext) {
    frontmatter[key] = normalizedNext;
    return;
  }
  const normalizedFallback = typeof fallbackValue === "string" ? fallbackValue.trim() : "";
  if (normalizedFallback) {
    frontmatter[key] = normalizedFallback;
    return;
  }
  delete frontmatter[key];
}

function sanitizeCliToken(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new Error(`${fieldName} must not contain line breaks.`);
  }
  return trimmed;
}

function quoteWindowsCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/%/g, "%%")}"`;
}

function resolveCliInvocation(
  cliPath: string,
  args: string[],
): { file: string; args: string[]; shell: boolean } {
  const sanitizedCliPath = sanitizeCliToken(cliPath, "TDM CLI path");
  const sanitizedArgs = args.map((arg, index) =>
    sanitizeCliToken(arg, `CLI argument ${index + 1}`),
  );

  if (process.platform !== "win32") {
    return {
      file: sanitizedCliPath,
      args: sanitizedArgs,
      shell: false,
    };
  }

  const commandLine = [sanitizedCliPath, ...sanitizedArgs].map(quoteWindowsCmdArg).join(" ");
  return {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", commandLine],
    shell: false,
  };
}

function buildInlinePreview(content: string): { body: string; truncated: boolean } {
  if (content.length <= MAX_INLINE_PREVIEW_CHARS) {
    return { body: content, truncated: false };
  }
  return {
    body:
      `${content.slice(0, MAX_INLINE_PREVIEW_CHARS)}\n\n` +
      "[preview truncated to keep Obsidian responsive; switch unlock mode to Create unlocked note for the full content]",
    truncated: true,
  };
}

class SingleInputModal extends Modal {
  private value: string;
  private readonly titleText: string;
  private readonly fieldName: string;
  private readonly placeholder: string;
  private resolvePromise: (value: string | null) => void;
  private focusTimeoutId: number | null = null;

  constructor(
    app: App,
    options: {
      title: string;
      fieldName: string;
      placeholder: string;
      initialValue: string;
      resolve: (value: string | null) => void;
    },
  ) {
    super(app);
    this.titleText = options.title;
    this.fieldName = options.fieldName;
    this.placeholder = options.placeholder;
    this.value = options.initialValue;
    this.resolvePromise = options.resolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tdm-obsidian-modal");
    contentEl.createEl("h2", { text: this.titleText });

    let submitted = false;
    new Setting(contentEl)
      .setName(this.fieldName)
      .addText((text) => {
        text
          .setPlaceholder(this.placeholder)
          .setValue(this.value)
          .onChange((value) => {
            this.value = value;
          });
        this.focusTimeoutId = window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Cancel").onClick(() => {
          submitted = true;
          this.close();
          this.resolvePromise(null);
        });
      })
      .addButton((button) => {
        button
          .setButtonText("Continue")
          .setCta()
          .onClick(() => {
            submitted = true;
            this.close();
            this.resolvePromise(this.value.trim() || null);
          });
      });

    this.onClose = () => {
      if (this.focusTimeoutId !== null) {
        window.clearTimeout(this.focusTimeoutId);
        this.focusTimeoutId = null;
      }
      contentEl.empty();
      if (!submitted) {
        this.resolvePromise(null);
      }
    };
  }
}

class WithdrawModal extends Modal {
  private amountUsd: string;
  private destinationAddress: string;
  private chain: "solana" | "base";
  private resolvePromise: (
    value:
      | {
          amountUsd: string;
          destinationAddress: string;
          chain: "solana" | "base";
        }
      | null,
  ) => void;

  constructor(
    app: App,
    initial: {
      amountUsd: string;
      destinationAddress: string;
      chain: "solana" | "base";
    },
    resolve: (
      value:
        | {
            amountUsd: string;
            destinationAddress: string;
            chain: "solana" | "base";
          }
        | null,
    ) => void,
  ) {
    super(app);
    this.amountUsd = initial.amountUsd;
    this.destinationAddress = initial.destinationAddress;
    this.chain = initial.chain;
    this.resolvePromise = resolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tdm-obsidian-modal");
    contentEl.createEl("h2", { text: "Withdraw publisher credits" });

    let submitted = false;

    new Setting(contentEl)
      .setName("Amount in USD")
      .addText((text) => {
        text
          .setPlaceholder("12.50")
          .setValue(this.amountUsd)
          .onChange((value) => {
            this.amountUsd = value;
          });
      });

    new Setting(contentEl)
      .setName("Destination wallet")
      .addText((text) => {
        text
          .setPlaceholder("Destination address")
          .setValue(this.destinationAddress)
          .onChange((value) => {
            this.destinationAddress = value;
          });
      });

    new Setting(contentEl)
      .setName("Chain")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("solana", "Solana")
          .addOption("base", "Base")
          .setValue(this.chain)
          .onChange((value) => {
            this.chain = value === "base" ? "base" : "solana";
          });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Cancel").onClick(() => {
          submitted = true;
          this.close();
          this.resolvePromise(null);
        });
      })
      .addButton((button) => {
        button
          .setButtonText("Request payout")
          .setCta()
          .onClick(() => {
            submitted = true;
            this.close();
            this.resolvePromise({
              amountUsd: this.amountUsd.trim(),
              destinationAddress: this.destinationAddress.trim(),
              chain: this.chain,
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
}

class OutputModal extends Modal {
  private readonly titleText: string;
  private readonly bodyText: string;

  constructor(app: App, title: string, body: string) {
    super(app);
    this.titleText = title;
    this.bodyText =
      body.length > MAX_MODAL_TEXT_LENGTH
        ? `${body.slice(0, MAX_MODAL_TEXT_LENGTH)}\n\n[output truncated to keep Obsidian responsive]`
        : body;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tdm-obsidian-modal");
    contentEl.createEl("h2", { text: this.titleText });
    contentEl.createDiv({ cls: "tdm-obsidian-result", text: this.bodyText });
  }
}

export default class TdmObsidianPlugin extends Plugin {
  settings: TdmObsidianSettings = DEFAULT_SETTINGS;
  private cliCommandInFlight = false;
  private activeCliChild: ChildProcess | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new TdmObsidianSettingTab(this.app, this));

    this.addCommand({
      id: "tdm-connect",
      name: "TDM: Connect",
      callback: async () => {
        await this.runConnect();
      },
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
      },
    });

    this.addCommand({
      id: "tdm-check-creator-balance",
      name: "TDM: Check creator balance",
      callback: async () => {
        await this.runCheckCreatorBalance();
      },
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
      },
    });

    this.addCommand({
      id: "tdm-withdraw-publisher-credits",
      name: "TDM: Withdraw publisher credits",
      callback: async () => {
        await this.runWithdrawPublisherCredits();
      },
    });
  }

  onunload(): void {
    if (this.activeCliChild && !this.activeCliChild.killed) {
      this.activeCliChild.kill();
    }
    this.activeCliChild = null;
    this.cliCommandInFlight = false;
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData()),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
  }

  private requireDesktopFilesystemPath(file: TFile): string {
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      throw new Error("TDM for Obsidian currently supports desktop vaults only.");
    }
    return this.app.vault.adapter.getFullPath(file.path);
  }

  private buildCliArgs(baseArgs: string[]): string[] {
    const args = [...baseArgs];
    const vaultName = this.settings.vaultName.trim();
    if (vaultName) {
      args.push("--vault", vaultName);
    }
    return args;
  }

  private async runCliCommand(
    args: string[],
    options: { timeoutMs?: number } = {},
  ): Promise<CliResult> {
    if (this.cliCommandInFlight) {
      throw new Error("Another TDM command is already running. Wait for it to finish first.");
    }
    this.cliCommandInFlight = true;
    try {
      const invocation = resolveCliInvocation(this.settings.cliPath, args);
      return await new Promise<CliResult>((resolve, reject) => {
        const child = execFile(
          invocation.file,
          invocation.args,
          {
            timeout: options.timeoutMs ?? 60_000,
            shell: invocation.shell,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
          },
          (error, stdout, stderr) => {
            if (this.activeCliChild === child) {
              this.activeCliChild = null;
            }
            if (error) {
              reject(Object.assign(error, { stdout, stderr }));
              return;
            }
            resolve({
              stdout: stdout ?? "",
              stderr: stderr ?? "",
            });
          },
        );
        this.activeCliChild = child;
      });
    } catch (error) {
      const stdout =
        typeof error === "object" && error && "stdout" in error
          ? String((error as { stdout?: unknown }).stdout ?? "")
          : "";
      const stderr =
        typeof error === "object" && error && "stderr" in error
          ? String((error as { stderr?: unknown }).stderr ?? "")
          : "";
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(buildCliErrorMessage(message, stdout, stderr));
    } finally {
      this.cliCommandInFlight = false;
    }
  }

  private async promptForPrice(initialValue: string): Promise<string | null> {
    return await new Promise((resolve) => {
      new SingleInputModal(this.app, {
        title: "Make current note payable",
        fieldName: "Price in USD",
        placeholder: "4.99",
        initialValue,
        resolve,
      }).open();
    });
  }

  private async promptForWithdraw(initialDestinationAddress = ""): Promise<{
    amountUsd: string;
    destinationAddress: string;
    chain: "solana" | "base";
  } | null> {
    return await new Promise((resolve) => {
      new WithdrawModal(
        this.app,
        {
          amountUsd: "",
          destinationAddress: initialDestinationAddress,
          chain: this.settings.defaultWithdrawChain,
        },
        resolve,
      ).open();
    });
  }

  private buildPublicUrl(file: TFile): string {
    const configuredBaseUrl = this.settings.publicBaseUrl.trim();
    if (!configuredBaseUrl) {
      throw new Error("Set Public notes base URL in plugin settings first.");
    }
    const baseUrl = normalizeHttpUrl(configuredBaseUrl, "Public notes base URL");

    const prefix = this.settings.publicPathPrefix.trim().replace(/^\/+|\/+$/g, "");
    const extension = this.settings.publicExtension.trim();
    let relativePath = normalizePath(file.path);
    if (extension) {
      relativePath = relativePath.replace(/\.md$/i, extension);
    }

    const pathParts = [prefix, relativePath]
      .filter(Boolean)
      .join("/")
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part));

    return `${baseUrl}/${pathParts.join("/")}`;
  }

  private async updateFrontmatter(
    file: TFile,
    data: {
      priceUsd: string;
      publicUrl: string;
      resourceKey?: string;
      serviceId?: string;
      endpointPath?: string;
      deliveryType?: string;
    },
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter["tdm_price_usd"] = normalizeUsdAmount(data.priceUsd, "tdm_price_usd");
      frontmatter["tdm_public_url"] = normalizeHttpUrl(data.publicUrl, "tdm_public_url");
      setFrontmatterString(
        frontmatter,
        "tdm_resource_key",
        data.resourceKey,
        frontmatter["tdm_resource_key"],
      );
      setFrontmatterString(
        frontmatter,
        "tdm_service_id",
        data.serviceId,
        frontmatter["tdm_service_id"],
      );
      setFrontmatterString(
        frontmatter,
        "tdm_endpoint_path",
        data.endpointPath,
        frontmatter["tdm_endpoint_path"],
      );
      setFrontmatterString(
        frontmatter,
        "tdm_delivery_type",
        data.deliveryType,
        frontmatter["tdm_delivery_type"],
      );
      frontmatter["tdm_last_synced_at"] = new Date().toISOString();
    });
  }

  private async allocateUnlockedNotePath(file: TFile): Promise<string> {
    const basePath = file.path.replace(/\.md$/i, "");
    const initial = `${basePath}.unlocked.md`;
    const existing = this.app.vault.getAbstractFileByPath(initial);
    if (!existing) {
      return initial;
    }
    for (let index = 2; index <= 1000; index += 1) {
      const candidate = `${basePath}.unlocked-${index}.md`;
      if (!this.app.vault.getAbstractFileByPath(candidate)) {
        return candidate;
      }
    }
    throw new Error("Could not allocate an unlocked note path.");
  }

  private async getUnlockMetadata(file: TFile): Promise<{
    resourceId: string;
    priceUsd: string;
  }> {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const resourceKey = String(frontmatter["tdm_resource_key"] ?? "").trim();
    const publicUrl = String(frontmatter["tdm_public_url"] ?? "").trim();
    const priceUsd = String(frontmatter["tdm_price_usd"] ?? "").trim();
    const resourceId = resourceKey || publicUrl;

    if (!resourceId || !priceUsd) {
      throw new Error(
        "This note is missing TDM unlock metadata. Expected tdm_resource_key or tdm_public_url plus tdm_price_usd in frontmatter.",
      );
    }

    return {
      resourceId: resourceKey || normalizeHttpUrl(publicUrl, "tdm_public_url"),
      priceUsd: normalizeUsdAmount(priceUsd, "tdm_price_usd"),
    };
  }

  private async runConnect(): Promise<void> {
    new Notice("TDM connect is starting. Complete the wallet flow in your browser.", 5000);
    let gatewayUrl: string;
    try {
      gatewayUrl = normalizeHttpUrl(
        this.settings.gatewayUrl.trim() || DEFAULT_GATEWAY_URL,
        "Live TDM URL",
      );
    } catch (error) {
      new OutputModal(
        this.app,
        "TDM connect failed",
        error instanceof Error ? error.message : String(error),
      ).open();
      return;
    }
    const args = this.buildCliArgs(["connect", "--gateway", gatewayUrl]);
    try {
      const result = await this.runCliCommand(args, { timeoutMs: 5 * 60_000 });
      new Notice("TDM connect completed.", 4000);
      if (result.stdout.trim()) {
        new OutputModal(this.app, "TDM connect", result.stdout.trim()).open();
      }
    } catch (error) {
      new OutputModal(
        this.app,
        "TDM connect failed",
        error instanceof Error ? error.message : String(error),
      ).open();
    }
  }

  private async runMakeCurrentNotePayable(file: TFile): Promise<void> {
    const activePrice =
      String(this.app.metadataCache.getFileCache(file)?.frontmatter?.["tdm_price_usd"] ?? "").trim() ||
      this.settings.defaultPriceUsd;
    const requestedPriceUsd = await this.promptForPrice(activePrice);
    if (!requestedPriceUsd) {
      return;
    }
    let priceUsd: string;
    try {
      priceUsd = normalizeUsdAmount(requestedPriceUsd, "Price in USD");
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error), 6000);
      return;
    }

    let publicUrl: string;
    try {
      publicUrl = this.buildPublicUrl(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error), 6000);
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
      "--json",
    ]);

    new Notice("Registering payable note with TDM...", 4000);

    try {
      const result = await this.runCliCommand(args, { timeoutMs: 90_000 });
      const payload = extractJsonPayload<MakePayablePayload>(result.stdout);
      const registration = payload.registration ?? {};
      await this.updateFrontmatter(file, {
        priceUsd: registration.requested_price_usd ?? priceUsd,
        publicUrl,
        resourceKey: registration.resource_key,
        serviceId: registration.tdm_service_id,
        endpointPath: registration.endpoint_path,
        deliveryType: registration.delivery_type ?? "INLINE",
      });

      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch {
        // best-effort only
      }

      new Notice("Note is now payable. Shareable URL copied when available.", 5000);
    } catch (error) {
      new OutputModal(
        this.app,
        "Make payable failed",
        error instanceof Error ? error.message : String(error),
      ).open();
    }
  }

  private async runUnlockCurrentNote(file: TFile): Promise<void> {
    let metadata: { resourceId: string; priceUsd: string };
    try {
      metadata = await this.getUnlockMetadata(file);
    } catch (error) {
      new OutputModal(
        this.app,
        "Unlock unavailable",
        error instanceof Error ? error.message : String(error),
      ).open();
      return;
    }

    new Notice("Unlocking note with TDM...", 4000);

    try {
      const result = await this.runCliCommand(
        this.buildCliArgs([
          "unlock",
          metadata.resourceId,
          "--price",
          metadata.priceUsd,
          "--json",
        ]),
        { timeoutMs: 90_000 },
      );
      const payload = extractJsonPayload<UnlockPayload>(result.stdout);
      if (!payload.ok) {
        throw new Error(payload.error ?? payload.reason ?? "Unlock failed.");
      }

      if (payload.delivery_type === "INLINE" && typeof payload.content === "string") {
        if (this.settings.unlockMode === "preview") {
          const preview = buildInlinePreview(payload.content);
          new OutputModal(
            this.app,
            "Unlocked note preview",
            preview.body,
          ).open();
          new Notice(
            preview.truncated
              ? "Unlocked content preview was truncated to keep Obsidian responsive. Switch unlock mode to Create unlocked note for the full content."
              : "Unlocked content opened in read-only preview. It was not written to your vault.",
            5000,
          );
          return;
        }

        const unlockedPath = await this.allocateUnlockedNotePath(file);
        const unlockedFile = await this.app.vault.create(unlockedPath, payload.content);
        await this.app.workspace.getLeaf(true).openFile(unlockedFile);
        new Notice("Unlocked note created in your vault.", 5000);
        return;
      }

      if (payload.delivery_type === "REDIRECT" && payload.redirect_url) {
        try {
          await navigator.clipboard.writeText(payload.redirect_url);
        } catch {
          // best-effort only
        }
        new OutputModal(
          this.app,
          "External delivery unlocked",
          `Open this delivery URL:\n\n${payload.redirect_url}\n\nThe URL was copied when possible.`,
        ).open();
        return;
      }

      throw new Error("Unlock succeeded but delivery payload was not recognized.");
    } catch (error) {
      new OutputModal(
        this.app,
        "Unlock failed",
        error instanceof Error ? error.message : String(error),
      ).open();
    }
  }

  private async runCheckCreatorBalance(): Promise<void> {
    try {
      const result = await this.runCliCommand(
        this.buildCliArgs(["balance", "--json"]),
        { timeoutMs: 20_000 },
      );
      const payload = extractJsonPayload<BalancePayload>(result.stdout);
      new OutputModal(
        this.app,
        "Creator balance",
        [
          `Publisher credits: $${payload.publisher_credits_usd ?? "0"}`,
          `Main balance: $${payload.main_balance_usd ?? "0"}`,
          `Pending balance: $${payload.pending_balance_usd ?? "0"}`,
          payload.wallet_id ? `Wallet: ${payload.wallet_id}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ).open();
    } catch (error) {
      new OutputModal(
        this.app,
        "Balance check failed",
        error instanceof Error ? error.message : String(error),
      ).open();
    }
  }

  private async runWithdrawPublisherCredits(): Promise<void> {
    const request = await this.promptForWithdraw();
    if (!request) {
      return;
    }
    if (!request.amountUsd || !request.destinationAddress) {
      new Notice("Amount and destination wallet are required.", 5000);
      return;
    }
    let normalizedAmountUsd: string;
    try {
      normalizedAmountUsd = normalizeUsdAmount(request.amountUsd, "Amount in USD");
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error), 5000);
      return;
    }

    try {
      const result = await this.runCliCommand(
        this.buildCliArgs([
          "payout",
          "request",
          "--amount",
          normalizedAmountUsd,
          "--to",
          request.destinationAddress,
          "--chain",
          request.chain,
          "--json",
        ]),
        { timeoutMs: 30_000 },
      );
      const payload = extractJsonPayload<PayoutPayload>(result.stdout);
      new OutputModal(
        this.app,
        "Payout requested",
        [
          `Payout ID: ${payload.payout_id ?? "pending"}`,
          `Chain: ${payload.chain ?? request.chain.toUpperCase()}`,
          `Destination: ${payload.destination_address ?? request.destinationAddress}`,
          `Remaining credits: $${payload.remaining_credits_usd ?? "0"}`,
          `Status: ${payload.status ?? "PENDING_EXECUTION"}`,
        ].join("\n"),
      ).open();
    } catch (error) {
      new OutputModal(
        this.app,
        "Withdraw failed",
        error instanceof Error ? error.message : String(error),
      ).open();
    }
  }
}

class TdmObsidianSettingTab extends PluginSettingTab {
  plugin: TdmObsidianPlugin;

  constructor(app: App, plugin: TdmObsidianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "TDM for Obsidian" });

    new Setting(containerEl)
      .setName("TDM CLI path")
      .setDesc("Path to the installed `tdm` command. Leave as `tdm` when it is already on PATH.")
      .addText((text) =>
        text
          .setPlaceholder("tdm")
          .setValue(this.plugin.settings.cliPath)
          .onChange(async (value) => {
            this.plugin.settings.cliPath = value.trim() || "tdm";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Live TDM URL")
      .setDesc("One-time connect will use this Live TDM URL.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_GATEWAY_URL)
          .setValue(this.plugin.settings.gatewayUrl)
          .onChange(async (value) => {
            this.plugin.settings.gatewayUrl = value.trim() || DEFAULT_GATEWAY_URL;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Named vault")
      .setDesc("Optional named vault such as photos, music, or market-bots.")
      .addText((text) =>
        text
          .setPlaceholder("photos")
          .setValue(this.plugin.settings.vaultName)
          .onChange(async (value) => {
            this.plugin.settings.vaultName = value.trim().toLowerCase();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Inline unlock mode")
      .setDesc(
        "Preview = human reading. Create unlocked note = reusable knowledge, skills, and agent use.",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("preview", "Read-only preview")
          .addOption("vault_note", "Create unlocked note")
          .setValue(this.plugin.settings.unlockMode)
          .onChange(async (value) => {
            this.plugin.settings.unlockMode =
              value === "vault_note" ? "vault_note" : "preview";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Public notes base URL")
      .setDesc("Base URL where your published notes live, for example https://notes.example.com.")
      .addText((text) =>
        text
          .setPlaceholder("https://notes.example.com")
          .setValue(this.plugin.settings.publicBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.publicBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Public path prefix")
      .setDesc("Optional prefix inside the public site, for example blog or premium.")
      .addText((text) =>
        text
          .setPlaceholder("premium")
          .setValue(this.plugin.settings.publicPathPrefix)
          .onChange(async (value) => {
            this.plugin.settings.publicPathPrefix = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Public extension")
      .setDesc("How local .md notes are mapped to public URLs, for example .html.")
      .addText((text) =>
        text
          .setPlaceholder(".html")
          .setValue(this.plugin.settings.publicExtension)
          .onChange(async (value) => {
            this.plugin.settings.publicExtension = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default price in USD")
      .setDesc("Starting price shown when making a note payable.")
      .addText((text) =>
        text
          .setPlaceholder("4.99")
          .setValue(this.plugin.settings.defaultPriceUsd)
          .onChange(async (value) => {
            this.plugin.settings.defaultPriceUsd = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default withdraw chain")
      .setDesc("Default chain used for publisher payout requests.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("solana", "Solana")
          .addOption("base", "Base")
          .setValue(this.plugin.settings.defaultWithdrawChain)
          .onChange(async (value) => {
            this.plugin.settings.defaultWithdrawChain = value === "base" ? "base" : "solana";
            await this.plugin.saveSettings();
          }),
      );
  }
}
