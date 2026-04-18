import { DomainError, assertPermission } from "../engine/stockpulse-engine.mjs";

export function createRouter(engine) {
  const routes = [];

  function addRoute(method, pattern, options, handler) {
    if (typeof options === "function") {
      handler = options;
      options = {};
    }
    // Convert pattern like "/api/v1/orders/:id/confirm" into regex
    const paramNames = [];
    const regexPattern = pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    const regex = new RegExp(`^${regexPattern}$`);
    routes.push({
      method: method.toUpperCase(),
      pattern,
      regex,
      paramNames,
      options: options || {},
      handler
    });
  }

  function parseCookies(header = "") {
    const list = {};
    header.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      const name = parts.shift()?.trim();
      if (name) {
        list[name] = decodeURIComponent(parts.join("=").trim());
      }
    });
    return list;
  }

  async function handleRequest(req, res) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    res.setHeader("X-Request-Id", requestId);
    // CORS: explicit ALLOWED_ORIGINS wins; otherwise any localhost / 127.0.0.1 origin is allowed
    // (credentials require an exact origin, so the request origin is echoed back).
    const origin = req.headers.origin || "";
    const configured = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
    const allowOrigin = configured.length ? (configured.includes("*") ? "*" : configured.includes(origin) ? origin : configured[0]) : isLocal ? origin : "*";
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Idempotency-Key");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const sendJson = (status, payload, headers = {}) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        ...headers
      });
      res.end(JSON.stringify({ requestId, ...payload }));
    };

    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
      const query = Object.fromEntries(url.searchParams.entries());
      const cookies = parseCookies(req.headers.cookie);

      // Find matching route
      let matchedRoute = null;
      let params = {};

      for (const route of routes) {
        if (route.method !== req.method) continue;
        const match = path.match(route.regex);
        if (match) {
          matchedRoute = route;
          route.paramNames.forEach((name, idx) => {
            params[name] = decodeURIComponent(match[idx + 1]);
          });
          break;
        }
      }

      if (!matchedRoute) {
        throw new DomainError("ROUTE_NOT_FOUND", `Route ${req.method} ${path} not found.`, 404);
      }

      // Check Authentication if route requires auth (default is true unless auth: false)
      let session = null;
      if (matchedRoute.options.auth !== false) {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        session = engine.state.sessions.get(token);
        if (!session) {
          throw new DomainError("UNAUTHORIZED", "Valid Bearer access token required.", 401);
        }
        if (session.expiresAt && session.expiresAt < Date.now()) {
          throw new DomainError("TOKEN_EXPIRED", "Session expired. Please refresh your access token.", 401);
        }

        // Check RBAC permission if route specifies a required permission
        if (matchedRoute.options.permission) {
          assertPermission(session, matchedRoute.options.permission);
        }
      }

      // Parse JSON body for methods that transmit data
      let body = {};
      if (["POST", "PATCH", "PUT"].includes(req.method)) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (raw && raw.trim().length > 0) {
          try {
            body = JSON.parse(raw);
          } catch (jsonErr) {
            throw new DomainError("INVALID_JSON", "Malformed JSON payload.", 400);
          }
        }
      }

      // Execute route handler
      const result = await matchedRoute.handler({
        req,
        res,
        session,
        params,
        query,
        body,
        cookies,
        engine,
        requestId,
        sendJson
      });

      // If handler hasn't already sent response (e.g. streaming or custom sendJson)
      if (!res.writableEnded && result !== undefined) {
        const status = matchedRoute.options.statusCode || (req.method === "POST" ? 201 : 200);
        sendJson(status, { data: result });
      }
    } catch (err) {
      if (!res.writableEnded) {
        if (err instanceof DomainError) {
          sendJson(err.statusCode, {
            error: { code: err.code, message: err.message, details: err.details }
          });
        } else {
          console.error(`[StockPulse Server Error ${requestId}]`, err);
          sendJson(500, {
            error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected server error occurred." }
          });
        }
      }
    }
  }

  return {
    get(pattern, options, handler) { addRoute("GET", pattern, options, handler); },
    post(pattern, options, handler) { addRoute("POST", pattern, options, handler); },
    patch(pattern, options, handler) { addRoute("PATCH", pattern, options, handler); },
    put(pattern, options, handler) { addRoute("PUT", pattern, options, handler); },
    delete(pattern, options, handler) { addRoute("DELETE", pattern, options, handler); },
    handleRequest
  };
}
