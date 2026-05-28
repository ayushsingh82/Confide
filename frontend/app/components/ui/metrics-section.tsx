"use client";

import { useEffect, useRef, useState } from "react";

function AnimatedCounter({
  end,
  suffix = "",
  prefix = "",
}: {
  end: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const startTime = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return (
    <div ref={ref} className="text-5xl font-semibold tracking-tight sm:text-6xl lg:text-8xl">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  );
}

const metrics = [
  { value: 95, suffix: "%", prefix: "", label: "Inferences attested under 100 ms" },
  { value: 100, suffix: "%", prefix: "", label: "Code stays inside the TEE" },
  { value: 30, suffix: "s", prefix: "<", label: "Verification time per receipt" },
  { value: 4, suffix: "", prefix: "", label: "Frontier models, one private API" },
];

export function MetricsSection() {
  const [time, setTime] = useState<Date | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => setTime(new Date());
    const first = setTimeout(update, 0);
    const interval = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="metrics"
      ref={sectionRef}
      className="relative border-y border-neutral-900 bg-black px-4 py-24 text-white sm:px-6 lg:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 flex flex-col gap-8 lg:mb-20 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
              [By the numbers]
            </span>
            <h2
              className={`mt-5 text-3xl font-semibold tracking-tight transition-all duration-700 sm:text-4xl lg:text-6xl ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              Less trust.
              <br />
              More proof.
            </h2>
          </div>
          <div className="flex items-center gap-4 font-mono text-sm text-neutral-500">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Attesting live
            </span>
            <span className="text-neutral-700">|</span>
            <span suppressHydrationWarning>
              {time ? time.toLocaleTimeString() : "--:--:--"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px border border-neutral-900 bg-neutral-900 md:grid-cols-2">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`bg-black p-8 transition-all duration-700 lg:p-12 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <AnimatedCounter end={metric.value} suffix={metric.suffix} prefix={metric.prefix} />
              <div className="mt-4 text-lg text-neutral-500">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
