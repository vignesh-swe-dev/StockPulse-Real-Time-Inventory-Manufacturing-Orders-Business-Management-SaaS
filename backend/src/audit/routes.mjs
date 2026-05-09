export function registerAuditRoutes(router, engine) {
  // GET /api/v1/audit/logs
  router.get("/api/v1/audit/logs", { auth: true, permission: "audit:read" }, async ({ session, query }) => {
    let logs = engine.state.auditLogs.filter((a) => a.tenantId === session.tenantId);
    if (query.entityType) {
      logs = logs.filter((a) => a.entityType === query.entityType);
    }
    if (query.action) {
      logs = logs.filter((a) => a.action.includes(query.action));
    }
    const limit = Number(query.limit) || 100;
    return logs.slice(-limit).reverse();
  });
}
