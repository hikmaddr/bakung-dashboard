import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Ensure Node runtime for Prisma usage
export const runtime = "nodejs";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  (typeof value === "object" || Array.isArray(value)) ? (value as Prisma.InputJsonValue) : {};

type ParamsPromise = Promise<{ id: string }>;

async function resolveParams(params: ParamsPromise) {
  return params;
}

export async function GET(
  request: Request,
  context: { params: ParamsPromise }
) {
  try {
    const { id } = await resolveParams(context.params);
    const profile = await prisma.brandProfile.findUnique({
      where: { slug: id },
    });

    if (!profile) {
      return NextResponse.json({ message: "Brand profile not found." }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[brand-profiles/:id][GET]", error);
    return NextResponse.json(
      { message: "Failed to load brand profile.", error: (error as Error)?.message ?? String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: ParamsPromise }
) {
  try {
    const { id } = await resolveParams(context.params);
    const payload = await request.json();

    const existing = await prisma.brandProfile.findUnique({
      where: { slug: id },
    });

    if (!existing) {
      return NextResponse.json({ message: "Brand profile not found." }, { status: 404 });
    }

    const {
      name,
      overview,
      address,
      phone,
      email,
      website,
      footerText,
      logoUrl,
      templateOptionId,
      templateDefaults,
      numberFormats,
      modules,
      primaryColor,
      secondaryColor,
      isActive,
      paymentInfo,
      termsConditions,
      showBrandName,
      showBrandDescription,
      showBrandEmail,
      showBrandWebsite,
      showBrandAddress,
    } = payload ?? {};

    const updated = await prisma.brandProfile.update({
      where: { slug: id },
      data: {
        name,
        overview,
        address,
        phone,
        email,
        website,
        footerText,
        logoUrl,
        templateOptionId,
        templateDefaults: templateDefaults
          ? toJson(templateDefaults)
          : undefined,
        numberFormats: numberFormats
          ? toJson(numberFormats)
          : undefined,
        modules: modules ? toJson(modules) : undefined,
        primaryColor,
        secondaryColor,
        isActive,
        paymentInfo,
        termsConditions,
        showBrandName,
        showBrandDescription,
        showBrandEmail,
        showBrandWebsite,
        showBrandAddress,
      },
    });

    if (isActive === true) {
      await prisma.brandProfile.updateMany({
        where: { slug: { not: id } },
        data: { isActive: false },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[brand-profiles/:id][PATCH]", error);
    return NextResponse.json(
      { message: "Failed to update brand profile.", error: (error as Error)?.message ?? String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: ParamsPromise }
) {
  try {
    const { id } = await resolveParams(context.params);
    await prisma.brandProfile.delete({
      where: { slug: id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[brand-profiles/:id][DELETE]", error);
    return NextResponse.json(
      { message: "Failed to delete brand profile." },
      { status: 500 }
    );
  }
}
