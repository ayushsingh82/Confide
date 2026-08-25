import type { FastifyInstance } from "fastify";
import { getSandbox } from "@/lib/sandbox-store.js";
import { verifySandboxToken } from "@/lib/jwt.js";
import { createAgentConnection, type ClientFrame } from "@/lib/sandbox-agent-protocol.js";

/**
 * GET /v1/sandbox/:id/agent — the bridge protocol WS endpoint.
 *
 * For CVM_PROVIDER=mock this backend plays the agent's role itself (see
 * sandbox-agent-protocol.ts). A real CVMProvider hands the browser a
 * different wssUrl entirely (the Go confide-agent inside the CVM) — this
 * route only ever serves the mock path.
 */
export async function sandboxAgentRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    "/v1/sandbox/:id/agent",
    { websocket: true },
    (socket, req) => {
      const { id } = req.params;
      const session = getSandbox(id);
      if (!session || session.status !== "ready") {
        socket.close(4404, "Sandbox not ready");
        return;
      }
      const token = req.query.token;
      if (!token || !verifySandboxToken(token, id).ok) {
        socket.close(4401, "Unauthorized");
        return;
      }

      const conn = createAgentConnection(id, (frame) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
      });

      socket.on("message", (raw: Buffer) => {
        let frame: ClientFrame;
        try {
          frame = JSON.parse(raw.toString("utf8")) as ClientFrame;
        } catch {
          socket.send(JSON.stringify({ type: "error", code: "bad_frame", message: "Invalid JSON" }));
          return;
        }
        // Fire-and-forget — never await here, or a slow fs.write/chat.complete
        // would block subsequent pty.input frames on the same connection.
        void conn.handleFrame(frame).catch((err: unknown) => {
          socket.send(
            JSON.stringify({
              type: "error",
              code: "internal",
              message: err instanceof Error ? err.message : "Unknown error",
            })
          );
        });
      });

      socket.on("close", () => conn.cleanup());
    }
  );
}
