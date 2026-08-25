/**
 * CVM hosting abstraction.
 *
 * The route layer (routes/sandbox.ts) always talks to a CVMProvider, never
 * to sandbox-store.ts directly — this is the seam plan.md §12.B designed so
 * swapping "who actually hosts the confidential VM" never touches route
 * code. Selected via CVM_PROVIDER=mock|phala|near (config.cvmProvider).
 *
 * - MockProvider: real, working today. Wraps sandbox-store.ts — the sandbox
 *   runs on this backend host, and this same backend serves the agent WS
 *   protocol (routes/sandbox-agent.ts) instead of a real Go confide-agent
 *   inside a CVM. No real TDX hardware, no real attestation — every
 *   attestationReport() call says so explicitly (mocked: true).
 * - PhalaProvider / NearProvider: unconfigured stubs. Neither has an
 *   account/API key in this environment; both throw a clear
 *   "not configured" error rather than silently falling back to mock. See
 *   md/plan.md §13 for the partnership plan that would make these real.
 */

import { config } from "@/config.js";
import { createSandbox, destroySandbox, getSandbox } from "@/lib/sandbox-store.js";
import type { SandboxSession } from "@/types/index.js";

export interface RawAttestation {
  /** True whenever there's no real TDX quote behind this report. */
  mocked: boolean;
  nonce: string;
  quote?: string;
  spki?: string;
  signingAddress?: string;
}

export interface CVMProvider {
  spawn(opts: { repoUrl: string; imageDigest: string; ttlMs?: number }): Promise<SandboxSession>;
  attestationReport(cvmId: string, nonce: string): Promise<RawAttestation>;
  destroy(cvmId: string): Promise<void>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `CVMProvider "${provider}" is not configured in this deployment — see md/plan.md §13 (NEAR partnership plan). Set CVM_PROVIDER=mock to use the local sandbox.`
    );
    this.name = "ProviderNotConfiguredError";
  }
}

class MockProvider implements CVMProvider {
  async spawn(opts: { repoUrl: string; ttlMs?: number }): Promise<SandboxSession> {
    return createSandbox(opts.repoUrl, opts.ttlMs);
  }

  async attestationReport(cvmId: string, nonce: string): Promise<RawAttestation> {
    const session = getSandbox(cvmId);
    if (!session) throw new Error("Sandbox not found");
    return { mocked: true, nonce };
  }

  async destroy(cvmId: string): Promise<void> {
    destroySandbox(cvmId);
  }
}

class PhalaProvider implements CVMProvider {
  async spawn(): Promise<SandboxSession> {
    throw new ProviderNotConfiguredError("phala");
  }
  async attestationReport(): Promise<RawAttestation> {
    throw new ProviderNotConfiguredError("phala");
  }
  async destroy(): Promise<void> {
    throw new ProviderNotConfiguredError("phala");
  }
}

class NearProvider implements CVMProvider {
  async spawn(): Promise<SandboxSession> {
    throw new ProviderNotConfiguredError("near");
  }
  async attestationReport(): Promise<RawAttestation> {
    throw new ProviderNotConfiguredError("near");
  }
  async destroy(): Promise<void> {
    throw new ProviderNotConfiguredError("near");
  }
}

let cached: CVMProvider | null = null;

export function getProvider(): CVMProvider {
  if (cached) return cached;
  switch (config.cvmProvider) {
    case "phala":
      cached = new PhalaProvider();
      break;
    case "near":
      cached = new NearProvider();
      break;
    case "mock":
    default:
      cached = new MockProvider();
  }
  return cached;
}
