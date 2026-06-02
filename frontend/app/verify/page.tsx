"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hashMessage, keccak256, recoverAddress, sha256, toBytes } from "viem";
import type { Hex } from "viem";

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}

type SchemeName = "keccak256(text)" | "sha256(text)" | "personal_sign(text)";

interface AttemptResult {
  scheme: SchemeName;
  recovered: string;
  error?: string;
}

interface FinalResult {
  ok: boolean;
  matchedScheme?: SchemeName;
  recovered?: string;
  attempts: AttemptResult[];
}

function normalizeHex(value: string): Hex {
  const trimmed = value.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

async function verifyAll(opts: {
  text: string;
  signature: string;
  address: string;
}): Promise<FinalResult> {
  const sig = normalizeHex(opts.signature);
  if (sig.length !== 132) {
    return {
      ok: false,
      attempts: [],
    };
  }
  const expected = opts.address.trim().toLowerCase();
  const textBytes = toBytes(opts.text);

  const tries: Array<{ name: SchemeName; hash: Hex }> = [
    { name: "keccak256(text)", hash: keccak256(textBytes) },
    { name: "sha256(text)", hash: sha256(textBytes) },
    { name: "personal_sign(text)", hash: hashMessage(opts.text) },
  ];

  const attempts: AttemptResult[] = [];
  let matched: { name: SchemeName; recovered: string } | undefined;
  for (const t of tries) {
    try {
      const recovered = await recoverAddress({ hash: t.hash, signature: sig });
      attempts.push({ scheme: t.name, recovered });
      if (!matched && recovered.toLowerCase() === expected) {
        matched = { name: t.name, recovered };
      }
    } catch (err) {
      attempts.push({
        scheme: t.name,
        recovered: "",
        error: err instanceof Error ? err.message : "recovery failed",
      });
    }
  }

  if (matched) {
    return {
      ok: true,
      matchedScheme: matched.name,
      recovered: matched.recovered,
      attempts,
    };
  }
  return { ok: false, attempts };
}

function VerifyInner() {
  const params = useSearchParams();
  const [text, setText] = useState(params.get("text") ?? "");
  const [signature, setSignature] = useState(params.get("sig") ?? "");
  const [address, setAddress] = useState(params.get("address") ?? "");

  const [result, setResult] = useState<FinalResult | null>(null);
  const [running, setRunning] = useState(false);

  // Auto-run when all three are pre-filled from URL params on first mount.
  useEffect(() => {
    if (text.trim() && signature.trim() && address.trim() && !result) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const r = await verifyAll({ text, signature, address });
      setResult(r);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-neutral-500">
          Confide verifier · standalone
        </p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Verify a NEAR TEE signature.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-neutral-400">
          Runs <span className="font-mono text-neutral-200">keccak256</span>,{" "}
          <span className="font-mono text-neutral-200">sha256</span>, and{" "}
          <span className="font-mono text-neutral-200">personal_sign</span> +
          secp256k1 ecrecover entirely in your browser. No backend call. The
          math you see is the math.
        </p>

        <section className="mt-8 space-y-4">
          <Field
            label="Message (text)"
            placeholder="Qwen/Qwen3-30B-A3B-Instruct-2507:5ce7…3a:9f02…d1"
            value={text}
            onChange={setText}
          />
          <Field
            label="Signature (0x…)"
            placeholder="0x…"
            value={signature}
            onChange={setSignature}
            mono
          />
          <Field
            label="Expected signing address (0x…)"
            placeholder="0xc03b…ac63"
            value={address}
            onChange={setAddress}
            mono
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void run()}
              disabled={
                running || !text.trim() || !signature.trim() || !address.trim()
              }
              className="rounded-full bg-white px-5 py-2 text-xs font-medium uppercase tracking-widest text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {running ? "Verifying…" : "Verify"}
            </button>
            <p className="text-[0.65rem] text-neutral-500">
              Tip: append <span className="font-mono">?text=…&amp;sig=…&amp;address=…</span> to this URL to make it a shareable verify-link.
            </p>
          </div>
        </section>

        {result && (
          <section className="mt-10 border border-neutral-900 p-5">
            {result.ok ? (
              <div className="space-y-3 text-sm">
                <p className="text-emerald-300">
                  ✓ Signature is valid. Recovered address matches the expected
                  signer via <span className="font-mono">{result.matchedScheme}</span>.
                </p>
                <div className="space-y-1 text-neutral-400">
                  <p>
                    Recovered:{" "}
                    <span className="font-mono text-neutral-200">
                      {result.recovered}
                    </span>
                  </p>
                  <p>
                    Expected:{" "}
                    <span className="font-mono text-neutral-200">{address}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-amber-300">
                  ⚠ Not valid — none of the three hashing schemes recovered the
                  expected address.
                </p>
                <div className="space-y-1 text-xs text-neutral-500">
                  {result.attempts.map((a) => (
                    <p key={a.scheme}>
                      <span className="font-mono text-neutral-400">{a.scheme}</span>
                      {" → "}
                      <span className="font-mono">{a.error ?? a.recovered}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-10 space-y-2 text-xs text-neutral-500">
          <p>
            <span className="text-neutral-400">Independence check:</span> you
            can also paste these exact values into{" "}
            <a
              href="https://app.mycrypto.com/verify-message"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-200 underline-offset-2 hover:underline"
            >
              MyCrypto&apos;s verify-message tool
            </a>
            . Same secp256k1 + personal_sign math, completely separate codebase.
            Both agreeing is the strongest possible proof of authenticity.
          </p>
          <p>
            The signature in the form belongs to whoever holds the private key
            that maps to the address — by NEAR&apos;s design, that&apos;s the
            TEE&apos;s signing key, never extractable from the enclave.
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        rows={2}
        className={`mt-1 w-full resize-y border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none ${
          mono ? "font-mono text-xs" : ""
        }`}
      />
    </div>
  );
}
