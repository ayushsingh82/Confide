"use client";

const tools = [
  { name: "NEAR AI Cloud", category: "Confidential inference" },
  { name: "GLM-4.6 FP8", category: "Model — 200K ctx" },
  { name: "DeepSeek V3.1", category: "Model — 128K ctx" },
  { name: "GPT-OSS 120B", category: "Model — 131K ctx" },
  { name: "Qwen3 30B A3B", category: "Model — 262K ctx" },
  { name: "Intel TDX", category: "Trusted enclave" },
  { name: "Nvidia H100 CC", category: "GPU enclave" },
  { name: "TLS 1.3", category: "Transport" },
  { name: "AES-256", category: "At-rest encryption" },
  { name: "HSM", category: "Key rotation" },
  { name: "Next.js", category: "IDE shell" },
  { name: "Vercel", category: "Edge delivery" },
];

function Card({ name, category }: { name: string; category: string }) {
  return (
    <div className="group shrink-0 border border-neutral-800 bg-black px-8 py-6 transition-all duration-300 hover:border-neutral-600 hover:bg-neutral-950">
      <div className="text-lg font-medium text-white transition-transform group-hover:translate-x-1">
        {name}
      </div>
      <div className="text-sm text-neutral-500">{category}</div>
    </div>
  );
}

export function PoweredBy() {
  return (
    <section id="powered-by" className="relative overflow-hidden bg-black py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center lg:mb-20">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
            [Powered by]
          </span>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white lg:text-6xl">
            Built on the most
            <br />
            <span className="font-serif font-normal italic">trusted</span> compute.
          </h2>
          <p className="mt-6 text-xl text-neutral-500">
            Hardware-enforced enclaves, frontier open-source models, and one private API —
            wired together so your code never leaves the boundary.
          </p>
        </div>
      </div>

      <div className="mb-6 w-full">
        <div className="marquee flex w-max gap-6">
          {[0, 1].map((setIndex) => (
            <div key={setIndex} className="flex shrink-0 gap-6">
              {tools.map((t) => (
                <Card key={`${t.name}-${setIndex}`} name={t.name} category={t.category} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full">
        <div className="marquee-reverse flex w-max gap-6">
          {[0, 1].map((setIndex) => (
            <div key={setIndex} className="flex shrink-0 gap-6">
              {[...tools].reverse().map((t) => (
                <Card key={`${t.name}-r-${setIndex}`} name={t.name} category={t.category} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
