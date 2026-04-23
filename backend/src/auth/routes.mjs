import { DomainError, ROLE_PERMISSIONS } from "../engine/stockpulse-engine.mjs";
import crypto from "node:crypto";

export function registerAuthRoutes(router, engine) {
  // POST /api/v1/auth/register
  router.post("/api/v1/auth/register", { auth: false, statusCode: 201 }, async ({ body, res }) => {
    const result = engine.registerTenantAndOwner(body);
    const refreshToken = result.session.refreshToken;
    res.setHeader(
      "Set-Cookie",
      `refreshToken=${encodeURIComponent(refreshToken)}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 3600}`
    );
    return result;
  });

  // POST /api/v1/auth/login
  router.post("/api/v1/auth/login", { auth: false, statusCode: 200 }, async ({ body, res }) => {
    const session = engine.login(body);
    const refreshToken = session.refreshToken;
    res.setHeader(
      "Set-Cookie",
      `refreshToken=${encodeURIComponent(refreshToken)}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 3600}`
    );
    return session;
  });

  // POST /api/v1/auth/refresh
  router.post("/api/v1/auth/refresh", { auth: false, statusCode: 200 }, async ({ body, cookies, res }) => {
    const rawToken = cookies.refreshToken || body.refreshToken;
    if (!rawToken) {
      throw new DomainError("REFRESH_TOKEN_REQUIRED", "Refresh token is required in cookie or body.", 401);
    }
    const tokenRecord = engine.state.refreshTokens.get(rawToken);
    if (!tokenRecord || tokenRecord.revoked) {
      throw new DomainError("INVALID_REFRESH_TOKEN", "Refresh token is invalid or has been revoked.", 401);
    }

    const user = engine.state.users.find((u) => u.id === tokenRecord.userId);
    const tenant = engine.state.tenants.find((t) => t.id === tokenRecord.tenantId);
    if (!user || !tenant || !user.isActive) {
      throw new DomainError("ACCOUNT_INACTIVE", "User account is no longer active.", 401);
    }

    // Revoke old refresh token (token rotation!)
    tokenRecord.revoked = true;

    // Issue new session
    const accessToken = `sp_at_${crypto.randomUUID().replace(/-/g, "")}`;
    const newRefreshToken = `sp_rt_${crypto.randomUUID().replace(/-/g, "")}`;
    const newSession = {
      accessToken,
      refreshToken: newRefreshToken,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      taxRegistrationNo: tenant.taxRegistrationNo || null,
      currencyCode: tenant.currencyCode,
      financialYearStart: tenant.financialYearStart,
      planTier: tenant.planTier,
      isDemo: Boolean(tenant.isDemo),
      role: tokenRecord.role,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000 // 15-minute access token
    };

    engine.state.sessions.set(accessToken, newSession);
    engine.state.refreshTokens.set(newRefreshToken, {
      userId: user.id,
      tenantId: tenant.id,
      role: tokenRecord.role,
      revoked: false
    });

    res.setHeader(
      "Set-Cookie",
      `refreshToken=${encodeURIComponent(newRefreshToken)}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 3600}`
    );

    return newSession;
  });

  // POST /api/v1/auth/logout
  router.post("/api/v1/auth/logout", { auth: true, statusCode: 200 }, async ({ req, res, session }) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    engine.logout(token);

    // Clear cookie
    res.setHeader("Set-Cookie", "refreshToken=; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=0");
    return { success: true };
  });

  // GET /api/v1/auth/me
  router.get("/api/v1/auth/me", { auth: true }, async ({ session }) => {
    const user = engine.state.users.find((u) => u.id === session.userId);
    const tenant = engine.state.tenants.find((t) => t.id === session.tenantId);
    const permissions = ROLE_PERMISSIONS[session.role] || [];
    return {
      session,
      user: user ? { id: user.id, email: user.email, fullName: user.fullName } : null,
      tenant,
      role: session.role,
      permissions
    };
  });
}
