import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("[templates][GET]", error);
    return NextResponse.json(
      { message: "Failed to load templates." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const {
      name,
      description,
      type,
      category = "custom",
      fileUrl,
      thumbnailUrl,
      placeholders = {},
    } = payload ?? {};

    if (!name || !type || !fileUrl) {
      return NextResponse.json(
        { message: "Name, type, and fileUrl are required." },
        { status: 400 }
      );
    }

    const created = await prisma.template.create({
      data: {
        name,
        description,
        type,
        category,
        fileUrl,
        thumbnailUrl,
        placeholders,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[templates][POST]", error);
    return NextResponse.json(
      { message: "Failed to create template." },
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
      description,
      type,
      category,
      fileUrl,
      thumbnailUrl,
      placeholders,
      isActive,
    } = payload ?? {};

    if (!id || !name || !type) {
      return NextResponse.json(
        { message: "ID, name, and type are required." },
        { status: 400 }
      );
    }

    const updated = await prisma.template.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        type,
        category,
        fileUrl,
        thumbnailUrl,
        placeholders,
        isActive,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[templates][PUT]", error);
    return NextResponse.json(
      { message: "Failed to update template." },
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

    await prisma.template.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Template deleted successfully." });
  } catch (error) {
    console.error("[templates][DELETE]", error);
    return NextResponse.json(
      { message: "Failed to delete template." },
      { status: 500 }
    );
  }
}
