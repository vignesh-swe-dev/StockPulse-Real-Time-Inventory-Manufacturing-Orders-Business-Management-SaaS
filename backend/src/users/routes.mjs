import { DomainError, hashPassword } from "../engine/stockpulse-engine.mjs";
import crypto from "node:crypto";

export function registerUsersRoutes(router, engine) {
  // GET /api/v1/users
  router.get("/api/v1/users", { auth: true, permission: "users:read" }, async ({ session }) => {
    const memberships = engine.state.memberships.filter((m) => m.tenantId === session.tenantId);
    const users = memberships.map((m) => {
      const u = engine.state.users.find((user) => user.id === m.userId);
      return {
        id: u?.id || m.userId,
        email: u?.email,
        fullName: u?.fullName,
        role: m.role,
        isActive: u?.isActive ?? true,
        createdAt: m.createdAt
      };
    });
    return users;
  });

  // POST /api/v1/users
  router.post("/api/v1/users", { auth: true, permission: "users:write", statusCode: 201 }, async ({ session, body }) => {
    const { email, fullName, role = "VIEWER", password = "TemporaryPassword#2026" } = body;
    if (!email || !fullName) {
      throw new DomainError("VALIDATION_ERROR", "Email and full name are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = engine.state.users.find((u) => u.email === normalizedEmail);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        fullName: fullName.trim(),
        passwordHash: hashPassword(password),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      engine.state.users.push(user);
    }

    const existingMembership = engine.state.memberships.find(
      (m) => m.tenantId === session.tenantId && m.userId === user.id
    );
    if (existingMembership) {
      throw new DomainError("ALREADY_EXISTS", "User is already a member of this tenant.", 409);
    }

    const membership = {
      id: crypto.randomUUID(),
      tenantId: session.tenantId,
      userId: user.id,
      role: role.trim().toUpperCase(),
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    engine.state.memberships.push(membership);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: membership.role,
      createdAt: membership.createdAt
    };
  });
}
