import { prisma } from "@/lib/prisma";

type SendToUsersParams = {
  userIds: number[];
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
};

export async function sendNotificationToUsers({ userIds, title, message, type = "info" }: SendToUsersParams) {
  if (!userIds.length) return;
  const data = userIds.map((uid) => ({ userId: uid, title, message, type }));
  await prisma.notification.createMany({ data });
}

export async function sendNotificationToUser(userId: number, title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") {
  await prisma.notification.create({ data: { userId, title, message, type } });
}

// Send to all users having a given role name. Optionally restrict by brand profile id.
export async function sendNotificationToRole(roleName: string, title: string, message: string, type: "info" | "success" | "warning" | "error" = "info", brandProfileId?: number) {
  const users = await prisma.user.findMany({
    where: {
      roles: { some: { role: { name: roleName } } },
      ...(brandProfileId ? { brandScopes: { some: { brandProfileId } } } : {}),
    },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) return;
  await sendNotificationToUsers({ userIds: ids, title, message, type });
}

export async function getUserUnreadCount(userId: number) {
  return prisma.notification.count({ where: { userId, read: false } });
}

