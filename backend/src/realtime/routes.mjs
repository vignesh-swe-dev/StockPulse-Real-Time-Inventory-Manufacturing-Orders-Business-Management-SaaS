import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerRealtimeRoutes(router, engine) {
  // GET /api/v1/realtime/stream (Server-Sent Events)
  router.get("/api/v1/realtime/stream", { auth: false }, async ({ req, res, query }) => {
    // Authenticate via Bearer header OR ?token= query parameter (EventSource standard)
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim() || query.token;
    const session = engine.state.sessions.get(token);

    if (!session) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Valid access token required for real-time stream." } }));
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
      // CORS headers are set once for every response by the router
    });

    // Send initial connected event
    res.write(`data: ${JSON.stringify({
      eventType: "connection.established",
      tenantId: session.tenantId,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Subscribe to tenant room
    const room = `tenant:${session.tenantId}`;
    const unsubscribe = engine.authorizeSocketSubscription(session, room, (evt) => {
      try {
        res.write(`data: ${JSON.stringify(evt)}\n\n`);
      } catch (err) {
        // Stream closed
      }
    });

    // Heartbeat keep-alive every 15 seconds
    const interval = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch (err) {
        clearInterval(interval);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(interval);
      unsubscribe();
    });
  });
}
