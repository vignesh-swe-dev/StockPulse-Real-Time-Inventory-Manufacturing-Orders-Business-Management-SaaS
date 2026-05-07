import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerNotificationsRoutes(router, engine) {
  // GET /api/v1/notifications
  router.get("/api/v1/notifications", { auth: true }, async ({ session, query }) => {
    let notifications = engine.state.notifications.filter((n) => n.tenantId === session.tenantId);
    if (query.unreadOnly === "true") {
      notifications = notifications.filter((n) => !n.isRead);
    }
    return notifications.slice(-50).reverse();
  });

  // POST /api/v1/notifications/:id/read
  router.post("/api/v1/notifications/:id/read", { auth: true, statusCode: 200 }, async ({ session, params }) => {
    const notif = engine.state.notifications.find(
      (n) => n.tenantId === session.tenantId && n.id === params.id
    );
    if (!notif) throw new DomainError("NOT_FOUND", "Notification not found.", 404);
    notif.isRead = true;
    notif.readAt = new Date().toISOString();
    return notif;
  });

  // POST /api/v1/notifications/read-all
  router.post("/api/v1/notifications/read-all", { auth: true, statusCode: 200 }, async ({ session }) => {
    const now = new Date().toISOString();
    for (const notif of engine.state.notifications) {
      if (notif.tenantId === session.tenantId && !notif.isRead) {
        notif.isRead = true;
        notif.readAt = now;
      }
    }
    return { success: true };
  });
}
