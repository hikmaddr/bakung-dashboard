import { prisma } from "@/lib/prisma";

type SendToUsersParams = {
  userIds: number[];
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  targetUrl?: string | null;
};

export async function sendNotificationToUsers({
  userIds,
  title,
  message,
  type = "info",
  targetUrl = null,
}: SendToUsersParams) {
  if (!userIds.length) return;
  const data = userIds.map((uid) => ({
    userId: uid,
    title,
    message,
    type,
    targetUrl: targetUrl ?? null,
  }));
  await prisma.notification.createMany({ data });
}

export async function sendNotificationToUser(
  userId: number,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  targetUrl?: string | null,
) {
  await prisma.notification.create({
    data: { userId, title, message, type, targetUrl: targetUrl ?? null },
  });
}

// Send to all users having a given role name. Optionally restrict by brand profile id.
export async function sendNotificationToRole(
  roleName: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  brandProfileId?: number,
  targetUrl?: string | null,
) {
  const users = await prisma.user.findMany({
    where: {
      roles: { some: { role: { name: roleName } } },
      ...(brandProfileId ? { brandScopes: { some: { brandProfileId } } } : {}),
    },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) return;
  await sendNotificationToUsers({ userIds: ids, title, message, type, targetUrl });
}

export async function getUserUnreadCount(userId: number) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
