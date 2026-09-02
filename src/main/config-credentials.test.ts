import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// HERMES_HOME is read at module load, so point it at a scratch dir first.
const home = mkdtempSync(join(tmpdir(), "hermes-cred-"));
process.env.HERMES_HOME = home;

let hasOAuthCredentials: (p: string, profile?: string) => boolean;

function writeAuth(store: unknown): void {
  writeFileSync(join(home, "auth.json"), JSON.stringify(store));
}

beforeAll(async () => {
  ({ hasOAuthCredentials } = await import("./config"));
});

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
});

// @lat: [[provider-setup#Provider setup#Active model is picked from configured providers#Authenticated OAuth providers are selectable#Credential shapes in auth.json]]
describe("hasOAuthCredentials credential shapes", () => {
  it("accepts the nested `tokens` shape written by the CLI OAuth flow", () => {
    writeAuth({
      providers: {
        "openai-codex": {
          tokens: { access_token: "tok-abc", refresh_token: "ref-abc" },
          auth_mode: "device",
        },
      },
    });
    expect(hasOAuthCredentials("openai-codex")).toBe(true);
  });

  it("still accepts the flat shape", () => {
    writeAuth({ providers: { anthropic: { access_token: "tok-flat" } } });
    expect(hasOAuthCredentials("anthropic")).toBe(true);
  });

  it("accepts a nested shape inside a credential_pool entry", () => {
    writeAuth({
      credential_pool: { xai: [{ tokens: { api_key: "sk-pool" } }] },
    });
    expect(hasOAuthCredentials("xai")).toBe(true);
  });

  it("still rejects a record with no usable token in either shape", () => {
    writeAuth({
      providers: { anthropic: { tokens: { access_token: "  " } } },
      active_provider: "anthropic",
    });
    expect(hasOAuthCredentials("anthropic")).toBe(false);
  });
});
