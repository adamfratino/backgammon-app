import { API_BASE, type Credentials } from "./config.ts";
import type { CategoryCounts, CategoryPage } from "./types.ts";

/** Header set copied from the web client; Galaxy rejects requests without them. */
function headers(token: string): Record<string, string> {
  return {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    appenvironment: "PROD",
    appplatform: "WEB",
    appversion: "6.0.108+558",
    authorization: `Bearer ${token}`,
    origin: "https://www.backgammongalaxy.com",
    referer: "https://www.backgammongalaxy.com/play",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  };
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A response we should not retry: bad auth, missing route, malformed request. */
export class PermanentError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PermanentError";
    this.status = status;
  }
}

export interface ClientOptions {
  /** Minimum gap between requests, in ms. */
  delayMs?: number;
  maxRetries?: number;
}

export class GalaxyClient {
  readonly credentials: Credentials;
  private readonly delayMs: number;
  private readonly maxRetries: number;
  private lastRequestAt = 0;

  constructor(credentials: Credentials, options: ClientOptions = {}) {
    this.credentials = credentials;
    this.delayMs = options.delayMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 4;
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  async get<T>(path: string): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.throttle();
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          headers: headers(this.credentials.token),
        });

        if (response.status === 401 || response.status === 403) {
          throw new PermanentError(
            `Auth rejected (${response.status}). The token has likely expired.`,
            response.status,
          );
        }

        // Back off on rate limiting and transient server errors.
        if (response.status === 429 || response.status >= 500) {
          const backoff = Math.min(30_000, 2 ** attempt * 1000);
          lastError = new Error(`HTTP ${response.status} on ${path}`);
          await sleep(backoff);
          continue;
        }

        // Any other 4xx is a permanent answer — retrying just wastes requests.
        if (!response.ok) {
          throw new PermanentError(`HTTP ${response.status} on ${path}`, response.status);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof PermanentError) throw error;
        lastError = error;
        if (attempt < this.maxRetries) await sleep(Math.min(30_000, 2 ** attempt * 1000));
      }
    }

    throw new Error(`Request failed after ${this.maxRetries + 1} attempts: ${path}`, {
      cause: lastError,
    });
  }

  /**
   * The categories endpoint was never captured from DevTools, so try the
   * plausible paths and remember whichever answers.
   */
  async fetchCategories(): Promise<{ counts: CategoryCounts; path: string } | null> {
    const paths = [
      "/blunder/categories",
      "/blunder/category",
      "/blunders/categories",
      "/blunder/category/counts",
    ];

    for (const path of paths) {
      try {
        const counts = await this.get<CategoryCounts>(path);
        const values = Object.values(counts ?? {});
        if (values.length > 0 && values.every((v) => typeof v === "number")) {
          return { counts, path };
        }
      } catch (error) {
        // A rejected token is worth surfacing; a wrong path is not.
        if (error instanceof PermanentError && (error.status === 401 || error.status === 403)) throw error;
      }
    }
    return null;
  }

  fetchCategoryPage(category: string, page: number): Promise<CategoryPage> {
    return this.get<CategoryPage>(`/blunder/category/${category}?page=${page}`);
  }
}
