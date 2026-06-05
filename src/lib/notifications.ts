import { prisma } from "@/lib/prisma";
import type { NotificationType, Role } from "@prisma/client";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { publishToUser, publishToUsers } from "@/lib/realtime";

interface NotifyInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

export async function notify(input: NotifyInput) {
  const notification = await prisma.notification.create({ data: input });

  // Real-time push to any open SSE connection for this user.
  publishToUser(input.userId);

  // Best-effort email mirror of the in-app notification.
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, isActive: true } });
  if (user?.isActive && user.email) {
    await sendEmail({
      to: user.email,
      subject: input.title,
      html: notificationEmailHtml(input.title, input.body, input.link),
    });
  }
  return notification;
}

/** Notify every user in the tenant whose role is in `roles` (e.g. approvers). */
export async function notifyRoles(
  tenantId: string,
  roles: Role[],
  payload: { type: NotificationType; title: string; body?: string; link?: string }
) {
  const users = await prisma.user.findMany({
    where: { tenantId, role: { in: roles }, isActive: true },
    select: { id: true, email: true },
  });
  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({ tenantId, userId: u.id, ...payload })),
  });

  // Real-time push to all recipients with an open connection.
  publishToUsers(users.map((u) => u.id));

  await Promise.all(
    users
      .filter((u) => u.email)
      .map((u) =>
        sendEmail({
          to: u.email,
          subject: payload.title,
          html: notificationEmailHtml(payload.title, payload.body, payload.link),
        })
      )
  );
}
