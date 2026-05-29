import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "@/config.js";
import { initUsageStore } from "@/lib/usage-store.js";
import { sweepExpired } from "@/lib/sandbox-store.js";
import { healthRoutes } from "@/routes/health.js";
import { chatRoutes } from "@/routes/chat.js";
import { usageRoutes } from "@/routes/usage.js";
import { modelsRoutes } from "@/routes/models.js";
import { attestationRoutes } from "@/routes/attestation.js";
import { sandboxRoutes } from "@/routes/sandbox.js";

async function bootstrap(): Promise<void> {
  initUsageStore();

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport: process.stdout.isTTY
        ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
        : undefined,
    },
  });

  const origins =
    config.corsOrigin === "*"
      ? true
      : config.corsOrigin.split(",").map((o) => o.trim());
  await app.register(cors, { origin: origins });

  await app.register(healthRoutes);
  await app.register(chatRoutes);
  await app.register(usageRoutes);
  await app.register(modelsRoutes);
  await app.register(attestationRoutes);
  await app.register(sandboxRoutes);

  // GC expired sandboxes every minute.
  const sweepInterval = setInterval(() => {
    const n = sweepExpired();
    if (n > 0) app.log.info(`Swept ${n} expired sandbox(es)`);
  }, 60_000);
  sweepInterval.unref();

  const close = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down`);
    clearInterval(sweepInterval);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    `Confide backend listening on http://${config.host}:${config.port} (NEAR key: ${
      config.nearApiKey ? "set" : "missing"
    })`
  );
}

bootstrap().catch((err) => {
  console.error("Failed to start backend:", err);
  process.exit(1);
});
