import { API_BASE, APP_VERSION, BROWSER_USER_AGENT } from "./config.ts";
import type { Credentials } from "./credentials.ts";
import type { GameReviewPage, HistoryPage, MatchResponse, ResultsResponse } from "./types.ts";

/** Header set copied from the web client; Galaxy rejects requests without them. */
function headers(token: string, accept: string): Record<string, string> {
  return {
    accept,
    "accept-language": "en-US,en;q=0.9",
    appenvironment: "PROD",
    appplatform: "WEB",
    appversion: APP_VERSION,
    authorization: `Bearer ${token}`,
    origin: "https://www.backgammongalaxy.com",
    referer: "https://www.backgammongalaxy.com/play",
    "user-agent": BROWSER_USER_AGENT,
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

  get<T>(path: string): Promise<T> {
    return this.request(path, "*/*", (response) => response.json() as Promise<T>);
  }

  private async request<T>(
    path: string,
    accept: string,
    read: (response: Response) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.throttle();
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          headers: headers(this.credentials.token, accept),
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

        return await read(response);
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

  /** The 50 newest matches, newest first. `limit` goes no higher. */
  fetchResults(selfId: string): Promise<ResultsResponse> {
    return this.get(`/stats/api/v3/users/analytics/results/${selfId}?limit=50`);
  }

  fetchMatch(matchId: number): Promise<MatchResponse> {
    return this.get(`/api/matches/${matchId}`);
  }

  /** The match as a `.mat` file, the one place both players' names are sure to be. */
  fetchMatFile(matchId: number): Promise<string> {
    return this.request(`/api/matches/${matchId}`, "application/vnd.galaxy+mat", (response) =>
      response.text(),
    );
  }

  /** One game's events, each with its review. `game` is 1-based. */
  fetchGameReview(matchId: number, game: number): Promise<GameReviewPage> {
    return this.get(`/match-analytics/api/v1/game_reviews/${matchId}/${game}`);
  }

  fetchHistoryPage(page: number): Promise<HistoryPage> {
    return this.get(`/stats/api/v2/analyses/list/${page}`);
  }
}
