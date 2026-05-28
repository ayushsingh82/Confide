import Link from "next/link";
import { Navbar } from "./components/Navbar";
import { Reveal } from "./components/ui/reveal";
import { AnimatedWave } from "./components/ui/animated-wave";
import { MetricsSection } from "./components/ui/metrics-section";
import { PoweredBy } from "./components/ui/powered-by";

const steps = [
  {
    kicker: "First",
    title: "Open the IDE",
    body: "Code in a desktop IDE that looks like the one you already use. Everything you type stays inside your boundary.",
  },
  {
    kicker: "Then",
    title: "AI runs in a TEE",
    body: "Every prompt routes to an attested enclave on NEAR AI Cloud. Models, prompts, and outputs are encrypted end-to-end.",
  },
  {
    kicker: "Finally",
    title: "Verify the receipt",
    body: "Each response comes with an attestation receipt — proof of where it ran, on what model, that nothing was altered.",
  },
];

const features = [
  {
    title: "Hardware-isolated execution",
    body: "Intel TDX and Nvidia H100 confidential compute. Hosts, operators, and providers cannot read your code or prompts.",
  },
  {
    title: "Cryptographic verification",
    body: "Every inference signs an attestation receipt. Verify in under 30 seconds and keep it as audit evidence.",
  },
  {
    title: "One API, four frontier models",
    body: "GLM-4.6, DeepSeek V3.1, GPT-OSS 120B, Qwen3 30B — all routable through one OpenAI-compatible private endpoint.",
  },
  {
    title: "Zero data retention",
    body: "Prompts and outputs are never persisted and never used for training. The signed receipt is the only record.",
  },
];

const useCases = [
  {
    title: "Defense",
    body: "Run classified workflows through frontier models without exposing prompts, code, or context to the provider.",
  },
  {
    title: "Finance",
    body: "Move trades, models, and customer data through reasoning LLMs while staying inside SOC 2 and FINRA boundaries.",
  },
  {
    title: "Healthcare",
    body: "Pipe PHI through frontier models with HIPAA-grade isolation and a verifiable audit trail for every call.",
  },
];

const plans = [
  {
    name: "Starter",
    description: "Bring your own key",
    price: "Free",
    per: "",
    cta: "Start with my key",
    popular: false,
    features: [
      "Plug in your own NEAR AI Cloud API key",
      "All five confidential models",
      "Per-message attestation receipts",
      "NEAR sees only ciphertext — TLS terminates inside the TEE",
    ],
  },
  {
    name: "Pro",
    description: "For individual builders",
    price: "$29",
    per: "/mo",
    cta: "Start free trial",
    popular: true,
    features: [
      "3M attested tokens included monthly",
      "Then NEAR cost + 25% — see usage live",
      "Audit dashboard & receipt history",
      "Email support, 24h response",
    ],
  },
  {
    name: "Enterprise",
    description: "For defense & regulated",
    price: "$1,500",
    per: "/seat / mo",
    cta: "Book a demo",
    popular: false,
    features: [
      "25M tokens / seat / mo included",
      "Admin controls, SSO, policy enforcement",
      "Air-gap & private deployment options",
      "Priority enclaves, dedicated support",
    ],
  },
];

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="h-4 w-4 transition-transform group-hover:translate-x-1"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-sans antialiased">
      <Navbar />

      {/* Hero — black */}
      <section className="relative overflow-hidden bg-black px-4 pt-32 pb-20 text-center text-white sm:px-6 sm:pt-56 sm:pb-40">
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25">
          <AnimatedWave />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_0%,rgba(255,255,255,0.06),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-5xl">
          <Reveal>
            <span className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl border border-neutral-800 bg-black/50 px-3 py-1.5 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-neutral-400 backdrop-blur sm:rounded-full sm:px-4 sm:py-1.5 sm:pl-4 sm:pr-3 sm:text-[0.7rem] sm:tracking-[0.25em]">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Confidential AI IDE
              </span>
              <span className="hidden h-3 w-px bg-neutral-700 sm:block" />
              <span className="flex items-center gap-1.5">
                Powered by
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://s3.coinmarketcap.com/static-gravity/image/ef3ad80e423a4449ab8e961b0d1edea4.png"
                  alt="NEAR"
                  className="h-3.5 w-3.5 rounded-full sm:h-4 sm:w-4"
                />
                <span className="text-white">
                  NEAR<span className="hidden sm:inline"> AI Cloud</span>
                </span>
              </span>
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-7 text-balance text-[2.25rem] font-semibold leading-[1.05] tracking-tight sm:mt-9 sm:text-7xl sm:leading-[0.95] md:text-8xl">
              Code with AI.
              <br />
              <span className="font-serif font-normal italic">Prove</span> nothing leaked.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-400 sm:mt-8 sm:text-xl">
              Confide is the IDE that runs every AI completion inside a hardware-isolated
              enclave on NEAR AI Cloud. Your code, prompts, and context stay inside your
              boundary — and every reply comes with a cryptographic receipt.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:mt-11 sm:flex-row sm:gap-4">
              <Link
                href="/chat"
                className="min-h-[48px] w-full rounded-full bg-white px-8 py-4 text-sm font-medium text-black transition hover:bg-neutral-200 sm:w-auto"
              >
                Open the IDE
              </Link>
              <a
                href="#how"
                className="min-h-[48px] w-full rounded-full border border-neutral-800 bg-black/40 px-8 py-4 text-sm font-medium text-white backdrop-blur transition hover:bg-neutral-900 sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works — black, square boxes, word headers */}
      <section id="how" className="bg-black px-4 pb-28 text-white sm:px-6 sm:pb-40">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
                How it works
              </p>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl sm:leading-[1.0] md:text-6xl">
                Three steps, <span className="font-serif font-normal italic">zero</span> exposure.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-16 grid gap-px border border-neutral-900 bg-neutral-900 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.title} className="bg-black p-10 sm:p-12">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
                    {step.kicker}
                  </p>
                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-neutral-400">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features — the single inverted (WHITE) section, square boxes */}
      <section
        id="features"
        className="relative overflow-hidden bg-white px-4 py-28 text-neutral-950 sm:px-6 sm:py-40"
      >
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <AnimatedWave tone="dark" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(0,0,0,0.04),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
                Features
              </p>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl sm:leading-[1.0] md:text-6xl">
                Everything an IDE does,{" "}
                <span className="font-serif font-normal italic">attested</span>.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-16 grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title} className="bg-white p-10 sm:p-12">
                  <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-neutral-500">{f.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <MetricsSection />

      <PoweredBy />

      {/* Use cases — black, square boxes */}
      <section className="bg-neutral-950 px-4 py-28 text-white sm:px-6 sm:py-40">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
                Who it’s for
              </p>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl sm:leading-[1.0] md:text-6xl">
                Built for teams that{" "}
                <span className="font-serif font-normal italic">cannot</span> leak.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-16 grid gap-px border border-neutral-900 bg-neutral-900 sm:grid-cols-3">
              {useCases.map((u) => (
                <div key={u.title} className="bg-black p-10 sm:p-12">
                  <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">{u.title}</h3>
                  <p className="mt-5 text-[0.95rem] leading-relaxed text-neutral-400">{u.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing — Warden-style square boxes */}
      <section id="pricing" className="bg-black px-4 py-28 text-white sm:px-6 sm:py-40">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
                Pricing
              </p>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl sm:leading-[1.0] md:text-6xl">
                Start small, scale by{" "}
                <span className="font-serif font-normal italic">verified</span> call.
              </h2>
              <p className="mt-6 max-w-xl text-lg text-neutral-400">
                No hidden fees, no lock-in. Pay only for inference that ran inside an
                attested enclave.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-16 grid gap-px border border-neutral-900 bg-neutral-900 md:grid-cols-3">
              {plans.map((plan, idx) => (
                <div
                  key={plan.name}
                  className={`relative bg-black p-8 lg:p-12 ${
                    plan.popular ? "border-2 border-white md:-my-4 md:py-12 lg:py-16" : ""
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-8 bg-white px-3 py-1 font-mono text-xs uppercase tracking-widest text-black">
                      Most popular
                    </span>
                  )}

                  <div className="mb-8">
                    <span className="font-mono text-xs text-neutral-500">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-2 text-3xl font-semibold tracking-tight">{plan.name}</h3>
                    <p className="mt-2 text-sm text-neutral-400">{plan.description}</p>
                  </div>

                  <div className="mb-8 border-b border-neutral-900 pb-8">
                    <span className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                      {plan.price}
                    </span>
                    {plan.per && (
                      <span className="ml-1 text-xl font-medium text-neutral-500">
                        {plan.per}
                      </span>
                    )}
                  </div>

                  <ul className="mb-10 space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-neutral-400">
                        <CheckIcon />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/chat"
                    className={`group flex w-full items-center justify-center gap-2 py-4 text-sm font-medium transition-all ${
                      plan.popular
                        ? "bg-white text-black hover:bg-neutral-200"
                        : "border border-neutral-800 text-white hover:border-white hover:bg-neutral-900"
                    }`}
                  >
                    {plan.cta}
                    <ArrowIcon />
                  </Link>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA — black, square */}
      <section className="bg-black px-4 pb-28 text-white sm:px-6 sm:pb-40">
        <Reveal className="mx-auto max-w-5xl">
          <div className="border border-neutral-900 bg-neutral-950 px-6 py-20 text-center sm:px-12 sm:py-28">
            <h2 className="text-balance text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl sm:leading-[1.0] md:text-6xl lg:text-7xl">
              Stop trusting. <span className="font-serif font-normal italic">Start</span>{" "}
              verifying.
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-lg text-neutral-400">
              Open the IDE, write a prompt, and watch the attestation receipt land beside it.
            </p>
            <Link
              href="/chat"
              className="mt-10 inline-block rounded-full bg-white px-9 py-4 text-sm font-semibold text-black transition hover:bg-neutral-200"
            >
              Open the IDE
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer — black, animated wave background */}
      <footer className="relative overflow-hidden border-t border-neutral-900 bg-black text-white">
        <div className="pointer-events-none absolute inset-0 h-64 overflow-hidden opacity-15">
          <AnimatedWave />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-10">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
            <div className="max-w-xs">
              <Link href="/" className="text-xl font-semibold tracking-tight">
                Confide
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                The confidential AI IDE. Prompts in, verified inference out — your code
                never leaves the boundary.
              </p>
            </div>
            <nav
              className="flex flex-wrap gap-x-12 gap-y-8 sm:gap-x-14"
              aria-label="Footer"
            >
              <div>
                <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Product
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-neutral-400">
                  <li>
                    <a href="#how" className="transition hover:text-white">
                      How it works
                    </a>
                  </li>
                  <li>
                    <a href="#features" className="transition hover:text-white">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="transition hover:text-white">
                      Pricing
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Company
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-neutral-400">
                  <li>
                    <a href="#" className="transition hover:text-white">
                      About
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition hover:text-white">
                      Blog
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition hover:text-white">
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Legal
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-neutral-400">
                  <li>
                    <a href="#" className="transition hover:text-white">
                      Privacy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition hover:text-white">
                      Terms
                    </a>
                  </li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="mt-14 border-t border-neutral-900 pt-7 text-center text-xs text-neutral-500">
            © {new Date().getFullYear()} Confide. Prompts in, verified inference out.
          </div>
        </div>
      </footer>
    </div>
  );
}
