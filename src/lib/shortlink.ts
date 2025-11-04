import { prisma } from "@/lib/prisma";

const randomId = (len = 5) =>
  Array.from({ length: len }, () => Math.floor(Math.random() * 36).toString(36)).join("");

const slugify = (value: string, max = 32) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || randomId();

export type ShortLinkType = "invoice" | "quotation" | "sales-order" | "receipt" | "delivery" | "document";

export async function ensureUniqueSlug(base: string): Promise<string> {
  let attempt = slugify(base);
  let tries = 0;
  while (tries < 10) {
    const exists = await prisma.shortLink.findUnique({ where: { slug: attempt } }).catch(() => null);
    if (!exists) return attempt;
    attempt = `${attempt}-${randomId(3)}`.slice(0, 48);
    tries++;
  }
  return `${slugify(base, 20)}-${randomId(6)}`;
}

export async function createOrUpdateShortLink(params: {
  type: ShortLinkType;
  entityId?: number | null;
  brandProfileId?: number | null;
  targetUrl: string;
  hint?: string | null;
  origin?: string | null;
}): Promise<{ slug: string; shortUrl: string }> {
  const { type, entityId, brandProfileId, targetUrl, hint, origin } = params;

  let existing: { slug: string } | null = null;
  if (entityId != null && Number.isFinite(Number(entityId))) {
    existing = await prisma.shortLink.findFirst({
      where: { entity: type, entityId: Number(entityId), isActive: true },
      select: { slug: true },
    });
  }

  let slug: string;
  if (existing?.slug) {
    slug = existing.slug;
    // Align target URL if changed
    await prisma.shortLink.update({
      where: { slug },
      data: { targetUrl, brandProfileId: brandProfileId ?? undefined },
    });
  } else {
    const base = [type.replace(/[^a-z0-9-]/g, ""), hint ? slugify(hint) : undefined, entityId ? String(entityId) : undefined]
      .filter(Boolean)
      .join("-")
      .slice(0, 40) || `${type}-${randomId(4)}`;
    slug = await ensureUniqueSlug(base);
    await prisma.shortLink.create({
      data: {
        slug,
        targetUrl,
        brandProfileId: brandProfileId ?? null,
        entity: type,
        entityId: entityId ?? null,
      },
    });
  }

  const baseUrl = origin || process.env.APP_BASE_URL || "http://localhost:3000";
  const shortUrl = `${baseUrl.replace(/\/$/, "")}/s/${slug}`;
  return { slug, shortUrl };
}
