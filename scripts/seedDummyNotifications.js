/**
 * Insert dummy notifications for quick UI verification.
 *
 * Usage examples:
 *   npm run seed:dummy-notifications
 *   node scripts/seedDummyNotifications.js 20        # 20 dummy rows, auto user
 *   node scripts/seedDummyNotifications.js 10 5      # 10 dummy rows for userId=5
 *
 * Requires DATABASE_URL to be configured (same as the app).
 */

const { PrismaClient, NotificationType } = require("@prisma/client");

const prisma = new PrismaClient();

async function resolveTargetUser(explicitId) {
  const fallback = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (explicitId) {
    const target = await prisma.user.findUnique({
      where: { id: explicitId },
      select: { id: true },
    });
    if (target) {
      return target.id;
    }
    if (fallback) {
      console.warn(
        `[seedDummyNotifications] User dengan id ${explicitId} tidak ditemukan. Menggunakan user ${fallback.id} sebagai gantinya.`,
      );
      return fallback.id;
    }
    throw new Error(
      `User dengan id ${explicitId} tidak ditemukan dan tidak tersedia user lain sebagai fallback.`,
    );
  }

  if (!fallback) {
    throw new Error(
      "Tidak ada user di database. Mohon buat user terlebih dahulu atau berikan userId manual.",
    );
  }

  return fallback.id;
}

async function main() {
  const countArg = Number(process.argv[2]);
  const userArg = Number(process.argv[3]);

  const count = Number.isFinite(countArg) && countArg > 0 ? Math.min(countArg, 100) : 15;
  const userId = await resolveTargetUser(Number.isFinite(userArg) && userArg > 0 ? userArg : undefined);

  const now = Date.now();
  const payload = Array.from({ length: count }, (_, idx) => {
    const createdAt = new Date(now - idx * 5 * 60 * 1000); // interval 5 menit
    return {
      userId,
      title: `Dummy Notification ${idx + 1}`,
      message: `Contoh konten dummy ke-${idx + 1} untuk pengecekan UI.`,
      type: NotificationType.info,
      isRead: false,
      createdAt,
    };
  });

  await prisma.notification.createMany({
    data: payload,
  });

  console.log(`✅ Berhasil menambahkan ${count} notifikasi dummy untuk user ${userId}.`);
}

main()
  .catch((err) => {
    console.error("❌ Gagal menambahkan notifikasi dummy:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

