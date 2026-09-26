import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { text } from "node:stream/consumers";
import { fileURLToPath } from "node:url";
import { BROWSER_USER_AGENT, KEYCLOAK_CLIENT_ID, KEYCLOAK_TOKEN_URL } from "./config.ts";
import {
  AUTH_FILE,
  daysUntil,
  describeCredentials,
  isExpired,
  parsePastedCredentials,
  readStoredCredentials,
  saveCredentials,
  type Credentials,
} from "./credentials.ts";

const SNIPPET_PATH = join(dirname(fileURLToPath(import.meta.url)), "console-snippet.js");

/**
 * Trades a Keycloak refresh token for a new access/refresh pair, exactly as the web client
 * does. `account` is Galaxy's public web client, so no secret is involved. Returns null when
 * the refresh token itself is dead, in which case a fresh login is the only way forward.
 */
export async function refreshCredentials(
  credentials: Credentials,
  log: (message: string) => void = console.log,
): Promise<Credentials | null> {
  if (!credentials.refreshToken) return null;

  const response = await fetch(KEYCLOAK_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://www.backgammongalaxy.com",
      referer: "https://www.backgammongalaxy.com/play",
      "user-agent": BROWSER_USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: KEYCLOAK_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
  });

  if (!response.ok) {
    let reason = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error_description?: string; error?: string };
      reason = body.error_description ?? body.error ?? reason;
    } catch {
      // Non-JSON error body; the status is all we have.
    }
    log(`Could not refresh the Galaxy token (${reason}).`);
    return null;
  }

  const body = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!body.access_token) return null;
  return describeCredentials(body.access_token, body.refresh_token ?? credentials.refreshToken);
}

function copyToClipboard(content: string): boolean {
  const command =
    process.platform === "darwin"
      ? ["pbcopy"]
      : process.platform === "win32"
        ? ["clip"]
        : ["xclip", "-selection", "clipboard"];
  // The web app bundles this module; tell Turbopack the command isn't a file to trace.
  const result = spawnSync(/*turbopackIgnore: true*/ command[0]!, command.slice(1), {
    input: content,
    stdio: "pipe",
  });
  return result.status === 0;
}

/** Reads one line without echoing it, so the token never lands in terminal scrollback. */
async function readSecret(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const stdin = process.stdin;
  if (!stdin.isTTY) return (await text(stdin)).trim();

  return new Promise((resolve) => {
    let buffer = "";
    const finish = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish();
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolve(buffer);
          return;
        }
        if (char === "\u007f" || char === "\b") buffer = buffer.slice(0, -1);
        else buffer += char;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}

function describe(credentials: Credentials): string {
  const access = credentials.expiresAt
    ? `access token valid ${daysUntil(credentials.expiresAt).toFixed(1)} more days`
    : "access token";
  const refresh = credentials.refreshExpiresAt
    ? `refresh token valid ${daysUntil(credentials.refreshExpiresAt).toFixed(1)} more days`
    : credentials.refreshToken
      ? "refresh token present"
      : "no refresh token, so you will be asked again when the access token runs out";
  return `${access}; ${refresh}`;
}

/**
 * Walks the user through capturing tokens from the Galaxy web client: copies the console
 * snippet to the clipboard, waits for the paste back, validates and saves it.
 */
export async function login(): Promise<Credentials> {
  if (!process.stdin.isTTY) {
    throw new Error(
      `No usable Galaxy credentials and no terminal to ask for them. Run "pnpm blunders" interactively once, or pipe the snippet output in: pbpaste | pnpm --filter @repo/galaxy-scraper login`,
    );
  }

  const snippet = readFileSync(SNIPPET_PATH, "utf8");
  const copied = copyToClipboard(snippet);

  console.log(`
Let's grab your Galaxy session tokens (about 20 seconds):

  1. Open https://www.backgammongalaxy.com/play and make sure you're logged in.
  2. Open the DevTools console: ⌥⌘J in Chrome, ⌥⌘C in Safari.
     If Chrome asks, type "allow pasting" first.
  3. ${copied ? "Paste (the snippet is already on your clipboard)" : "Paste the snippet below"} and press Enter.
     It copies your tokens to the clipboard. Nothing leaves the browser.
  4. Come back here, paste, and press Enter. The paste is not echoed.
`);
  if (!copied) console.log(`${snippet}\n`);

  for (;;) {
    const pasted = await readSecret("Paste here › ");
    const parsed = parsePastedCredentials(pasted);
    if (!parsed) {
      console.log(
        "That didn't contain a token. Run the snippet in the console and paste its output.",
      );
      continue;
    }
    const credentials = describeCredentials(parsed.token, parsed.refreshToken);
    if (isExpired(credentials.expiresAt)) {
      console.log(
        "That access token has already expired. Reload the Galaxy page while logged in, then run the snippet again.",
      );
      continue;
    }
    saveCredentials(credentials.token, credentials.refreshToken);
    console.log(`Saved to ${relative(process.cwd(), AUTH_FILE)} (${describe(credentials)}).\n`);
    return credentials;
  }
}

/** No usable Galaxy login, and no terminal to paste a new one into. */
export class LoginRequiredError extends Error {
  constructor() {
    super('Galaxy login expired. Run "pnpm blunders" to log in again.');
    this.name = "LoginRequiredError";
  }
}

export interface EnsureCredentialsOptions {
  /** Fall back to the paste-a-token login. The server has no terminal, so it passes false. */
  interactive?: boolean;
  log?: (message: string) => void;
}

/**
 * The credentials every network command starts from. Uses what is stored, silently renews
 * it via the refresh token when it is close to expiry, and falls back to the interactive
 * login only when nothing usable is left.
 */
export async function ensureCredentials({
  interactive = true,
  log = console.log,
}: EnsureCredentialsOptions = {}): Promise<Credentials> {
  let credentials = readStoredCredentials();

  // Renew on every run while the refresh token is still alive. Each refresh rolls the
  // window forward, so running at least once within it means never pasting again.
  if (credentials?.refreshToken && !isExpired(credentials.refreshExpiresAt)) {
    const renewed = await refreshCredentials(credentials, log);
    if (renewed) {
      saveCredentials(renewed.token, renewed.refreshToken);
      log(`Renewed the Galaxy token (${describe(renewed)}).`);
      credentials = renewed;
    }
  }

  if (!credentials || isExpired(credentials.expiresAt)) {
    if (!interactive) throw new LoginRequiredError();
    if (credentials) log("The saved Galaxy token has expired.");
    return login();
  }

  log(`Using saved Galaxy credentials (${describe(credentials)}).`);
  return credentials;
}
