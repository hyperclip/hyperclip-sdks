import { HyperclipError, HyperclipTimeoutError } from "./errors.js";
import type {
  CreateRunParams,
  FlowDetail,
  FlowListItem,
  ListRunsParams,
  Run,
  RunListItem,
  RunRef,
  WaitOptions,
} from "./types.js";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

const DEFAULT_BASE_URL = "https://zjasnfhprfiftozodqsz.supabase.co/functions/v1/api-v1";

export interface HyperclipOptions {
  /** API key (`hck_live_<prefix>.<secret>`). Falls back to `HYPERCLIP_API_KEY`. */
  apiKey?: string;
  /**
   * Override the API base URL. Defaults to Hyperclip production.
   * Falls back to `HYPERCLIP_BASE_URL` for staging/self-hosted setups.
   */
  baseUrl?: string;
  /** Override the global fetch (e.g. for testing). */
  fetch?: typeof fetch;
}

export class Hyperclip {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HyperclipOptions = {}) {
    const apiKey = options.apiKey ?? process.env.HYPERCLIP_API_KEY;
    const baseUrl = options.baseUrl ?? process.env.HYPERCLIP_BASE_URL ?? DEFAULT_BASE_URL;
    if (!apiKey) {
      throw new Error(
        "Hyperclip: missing apiKey. Pass `apiKey` or set HYPERCLIP_API_KEY.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("Hyperclip: no fetch implementation available. Use Node 18+ or pass `fetch`.");
    }
  }

  readonly runs = {
    create: (params: CreateRunParams): Promise<RunRef> => this.createRun(params),
    get: (id: string): Promise<Run> => this.request<Run>("GET", `/runs/${encodeURIComponent(id)}`),
    list: (params: ListRunsParams = {}): Promise<RunListItem[]> => this.listRuns(params),
    cancel: (id: string): Promise<{ id: string; status: "cancelled" }> =>
      this.request("POST", `/runs/${encodeURIComponent(id)}/cancel`),
    wait: (id: string, options?: WaitOptions): Promise<Run> => this.waitForRun(id, options),
  };

  readonly flows = {
    list: async (): Promise<FlowListItem[]> => {
      const res = await this.request<{ flows: FlowListItem[] }>("GET", "/flows");
      return res.flows;
    },
    get: (id: string): Promise<FlowDetail> =>
      this.request<FlowDetail>("GET", `/flows/${encodeURIComponent(id)}`),
  };

  private async createRun(params: CreateRunParams): Promise<RunRef> {
    const headers: Record<string, string> = {};
    if (params.idempotency_key) headers["Idempotency-Key"] = params.idempotency_key;
    return this.request<RunRef>("POST", "/runs", params, headers);
  }

  private async listRuns(params: ListRunsParams): Promise<RunListItem[]> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    const path = qs.toString() ? `/runs?${qs}` : "/runs";
    const res = await this.request<{ runs: RunListItem[] }>("GET", path);
    return res.runs;
  }

  private async waitForRun(id: string, options: WaitOptions = {}): Promise<Run> {
    const { timeoutMs = 10 * 60_000, pollIntervalMs = 4000, onUpdate, signal } = options;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new HyperclipTimeoutError("Wait aborted");
      const run = await this.runs.get(id);
      onUpdate?.(run);
      if (TERMINAL_STATUSES.has(run.status)) return run;
      await sleep(pollIntervalMs, signal);
    }
    throw new HyperclipTimeoutError();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...extraHeaders,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const data = text ? safeJson(text) : undefined;

    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
      throw new HyperclipError(
        res.status,
        err?.code ?? "unknown_error",
        err?.message ?? `HTTP ${res.status}`,
      );
    }
    return data as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new HyperclipTimeoutError("Wait aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new HyperclipTimeoutError("Wait aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
