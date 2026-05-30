import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config, hasGithubOAuth } from "@/config.js";
import {
  authorizeUrl,
  exchangeCodeForToken,
  fetchUser,
  GithubError,
  verifyState,
} from "@/lib/github.js";
import {
  createSession,
  getSession,
  revokeSession,
} from "@/lib/session-store.js";

const COOKIE_NAME = "confide.sid";

function cookieOptions() {
  const isHttps = config.publicBackendUrl.startsWith("https://");
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    maxAge: 7 * 24 * 60 * 60,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** GET /v1/auth/github/start?returnTo=<frontend_url> */
  app.get("/v1/auth/github/start", async (req, reply) => {
    if (!hasGithubOAuth) {
      return reply.code(503).send({
        error: "GitHub OAuth not configured",
        hint: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env",
      });
    }
    const query = z
      .object({ returnTo: z.string().url().optional() })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid returnTo" });
    }
    const returnTo = query.data.returnTo ?? config.publicFrontendUrl;
    const { url } = authorizeUrl(returnTo);
    return reply.redirect(url, 302);
  });

  /** GET /v1/auth/github/callback?code=&state= */
  app.get("/v1/auth/github/callback", async (req, reply) => {
    const query = z
      .object({
        code: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        error: z.string().optional(),
      })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid callback" });
    }
    if (query.data.error) {
      return reply.redirect(
        `${config.publicFrontendUrl}/playground?auth=denied`,
        302
      );
    }
    if (!query.data.code || !query.data.state) {
      return reply.code(400).send({ error: "Missing code or state" });
    }
    const returnTo = verifyState(query.data.state);
    if (!returnTo) {
      return reply.code(400).send({ error: "Invalid or expired state" });
    }

    try {
      const accessToken = await exchangeCodeForToken(query.data.code);
      const user = await fetchUser(accessToken);
      const session = createSession({
        accessToken,
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          avatarUrl: user.avatar_url,
          htmlUrl: user.html_url,
        },
      });
      reply.setCookie(COOKIE_NAME, session.id, cookieOptions());
      const target = new URL(returnTo);
      target.searchParams.set("auth", "ok");
      return reply.redirect(target.toString(), 302);
    } catch (err) {
      if (err instanceof GithubError) {
        return reply.code(err.status).send({ error: err.message, detail: err.detail });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
  });

  /** GET /v1/auth/me — current session (or 401). */
  app.get("/v1/auth/me", async (req, reply) => {
    const sid = req.cookies[COOKIE_NAME];
    const session = getSession(sid);
    if (!session) return reply.code(401).send({ authenticated: false });
    return {
      authenticated: true,
      provider: "github",
      user: session.user,
      expiresAt: session.expiresAt,
    };
  });

  /** POST /v1/auth/logout */
  app.post("/v1/auth/logout", async (req, reply) => {
    const sid = req.cookies[COOKIE_NAME];
    revokeSession(sid);
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return reply.code(204).send();
  });
}
