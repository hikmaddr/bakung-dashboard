import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Ensure this route runs on Node.js runtime (required for Prisma)
export const runtime = "nodejs";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  (typeof value === "object" || Array.isArray(value)) ? (value as Prisma.InputJsonValue) : {};

export async function GET() {
  try {
    const profiles = await prisma.brandProfile.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(profiles);
  } catch (error) {
    console.error("[brand-profiles][GET]", error);
    return NextResponse.json(
      { message: "Failed to load brand profiles.", error: (error as Error)?.message ?? String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
  const {
      id,
      name,
      logo,
      primaryColor = "#0EA5E9",
      secondaryColor = "#ECFEFF",
      description = "",
      website = "",
      email = "",
      address = "",
      phone = "",
      footerText = "",
      paymentInfo = "",
      termsConditions = "",
      templateOptionId = "",
      templateDefaults = {},
      numberFormats = {},
      modules = {},
      isActive = false,
      showBrandName = true,
      showBrandDescription = true,
      showBrandEmail = true,
      showBrandWebsite = true,
      showBrandAddress = true,
      signatureProfileId = "",
      signatureName = "",
      signatureTitle = "",
      signatureImageUrl = "",
    } = payload ?? {};

    if (!name) {
      return NextResponse.json(
        { message: "Name is required." },
        { status: 400 }
      );
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const templateDefaultsWithSignature = {
      ...templateDefaults,
      signatureProfileId,
      signatureName,
      signatureTitle,
      signatureImageUrl,
    };

    let created;
    try {
      created = await prisma.brandProfile.create({
        data: {
          slug,
          name,
          overview: description,
          address,
          phone,
          email,
          website,
          footerText,
          paymentInfo,
          termsConditions,
          logoUrl: logo ? logo.substring(0, 255) : null,
          templateOptionId,
          templateDefaults: toJson(templateDefaultsWithSignature),
          numberFormats: toJson(numberFormats),
          modules: toJson(modules),
          primaryColor,
          secondaryColor,
          isActive,
          showBrandName,
          showBrandDescription,
          showBrandEmail,
          showBrandWebsite,
          showBrandAddress,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          return NextResponse.json(
            { message: 'Brand name already in use.' },
            { status: 409 }
          );
        }
      }
      console.error('[brand-profiles][POST][create]', err);
      return NextResponse.json(
        { message: 'Failed to create brand profile.' },
        { status: 500 }
      );
    }

    if (isActive) {
      await prisma.brandProfile.updateMany({
        where: { NOT: { id: created.id } },
        data: { isActive: false },
      });
    }

    // Return in frontend expected format with all fields
    const response = {
      id: created.id,
      name: created.name,
      logo: created.logoUrl,
      primaryColor: created.primaryColor,
      secondaryColor: created.secondaryColor,
      description: created.overview,
      website: created.website,
      email: created.email,
      address: created.address,
      phone: created.phone,
      footerText: created.footerText,
      paymentInfo: created.paymentInfo,
      termsConditions: created.termsConditions,
      modules: created.modules,
      numberFormats: created.numberFormats,
      templateDefaults: created.templateDefaults,
      isActive: created.isActive,
      showBrandName: created.showBrandName,
      showBrandDescription: created.showBrandDescription,
      showBrandEmail: created.showBrandEmail,
      showBrandWebsite: created.showBrandWebsite,
      showBrandAddress: created.showBrandAddress,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[brand-profiles][POST]", error);
    return NextResponse.json(
      { message: "Failed to create brand profile." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
  const {
      id,
      name,
      logo,
      primaryColor,
      secondaryColor,
      description,
      website,
      email,
      address = "",
      phone = "",
      footerText = "",
      paymentInfo = "",
      termsConditions = "",
      templateOptionId = "",
      templateDefaults = {},
      numberFormats = {},
      modules = {},
      isActive = false,
      showBrandName = true,
      showBrandDescription = true,
      showBrandEmail = true,
      showBrandWebsite = true,
      showBrandAddress = true,
      signatureProfileId = "",
      signatureName = "",
      signatureTitle = "",
      signatureImageUrl = "",
    } = payload ?? {};

    if (!id || !name) {
      return NextResponse.json(
        { message: "ID and name are required." },
        { status: 400 }
      );
    }

    const idNum = Number(id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json(
        { message: "Invalid brand profile ID." },
        { status: 400 }
      );
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const templateDefaultsWithSignature = {
      ...templateDefaults,
      signatureProfileId,
      signatureName,
      signatureTitle,
      signatureImageUrl,
    };

    let updated;
    try {
      updated = await prisma.brandProfile.update({
        where: { id: idNum },
        data: {
          slug,
          name,
          overview: description,
          address,
          phone,
          email,
          website,
          footerText,
          paymentInfo,
          termsConditions,
          logoUrl: logo ? logo.substring(0, 255) : null,
          templateOptionId,
          templateDefaults: toJson(templateDefaultsWithSignature),
          numberFormats: toJson(numberFormats),
          modules: toJson(modules),
          primaryColor,
          secondaryColor,
          isActive,
          showBrandName,
          showBrandDescription,
          showBrandEmail,
          showBrandWebsite,
          showBrandAddress,
        },
      });
    } catch (err) {
      // Provide clearer error messages for common Prisma errors
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          return NextResponse.json(
            { message: 'Brand name already in use.' },
            { status: 409 }
          );
        }
        if (err.code === 'P2025') {
          return NextResponse.json(
            { message: 'Brand profile not found.' },
            { status: 404 }
          );
        }
      }
      console.error('[brand-profiles][PUT][update]', err);
      return NextResponse.json(
        { message: 'Failed to update brand profile.', error: (err as Error)?.message ?? String(err) },
        { status: 500 }
      );
    }

    if (isActive) {
      await prisma.brandProfile.updateMany({
        where: { NOT: { id: updated.id } },
        data: { isActive: false },
      });
    }

    // Return in frontend expected format with all fields
    const response = {
      id: updated.id,
      name: updated.name,
      logo: updated.logoUrl,
      primaryColor: updated.primaryColor,
      secondaryColor: updated.secondaryColor,
      description: updated.overview,
      website: updated.website,
      email: updated.email,
      address: updated.address,
      phone: updated.phone,
      footerText: updated.footerText,
      paymentInfo: updated.paymentInfo,
      termsConditions: updated.termsConditions,
      modules: updated.modules,
      numberFormats: updated.numberFormats,
      templateDefaults: updated.templateDefaults,
      isActive: updated.isActive,
      showBrandName: updated.showBrandName,
      showBrandDescription: updated.showBrandDescription,
      showBrandEmail: updated.showBrandEmail,
      showBrandWebsite: updated.showBrandWebsite,
      showBrandAddress: updated.showBrandAddress,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[brand-profiles][PUT]", error);
    return NextResponse.json(
      { message: "Failed to update brand profile.", error: (error as Error)?.message ?? String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "ID is required." },
        { status: 400 }
      );
    }

    await prisma.brandProfile.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Brand profile deleted successfully." });
  } catch (error) {
    console.error("[brand-profiles][DELETE]", error);
    return NextResponse.json(
      { message: "Failed to delete brand profile." },
      { status: 500 }
    );
  }
}
