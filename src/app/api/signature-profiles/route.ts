"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Tipe untuk kompatibilitas dengan UI yang sudah ada
type SignatureProfileResponse = {
  id: number;
  name: string;
  title?: string;
  imageUrl: string;
  createdAt: string;
};

export async function GET() {
  try {
    const profiles = await prisma.signatureProfile.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    
    // Format untuk kompatibilitas dengan UI yang sudah ada
    const formattedProfiles: SignatureProfileResponse[] = profiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      title: profile.title || undefined,
      imageUrl: profile.imageUrl,
      createdAt: profile.createdAt.toISOString()
    }));
    
    return NextResponse.json({ success: true, data: formattedProfiles });
  } catch (error) {
    console.error("[signature-profiles] GET error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat signature profiles." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const title = String(body?.title || "").trim();
    const imageUrl = String(body?.imageUrl || "").trim();
    const brandProfileId = body?.brandProfileId ? Number(body.brandProfileId) : null;

    if (!name || !imageUrl) {
      return NextResponse.json(
        { success: false, error: "Nama dan file signature wajib diisi." },
        { status: 400 }
      );
    }

    const newProfile = await prisma.signatureProfile.create({
      data: {
        name,
        title: title || null,
        imageUrl,
        brandProfileId
      }
    });

    // Format untuk kompatibilitas dengan UI yang sudah ada
    const formattedProfile: SignatureProfileResponse = {
      id: newProfile.id,
      name: newProfile.name,
      title: newProfile.title || undefined,
      imageUrl: newProfile.imageUrl,
      createdAt: newProfile.createdAt.toISOString()
    };

    return NextResponse.json({ success: true, data: formattedProfile });
  } catch (error) {
    console.error("[signature-profiles] POST error", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan signature profile." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const id = Number(idParam);
    if (!id) {
      return NextResponse.json({ success: false, error: "ID tidak valid." }, { status: 400 });
    }

    await prisma.signatureProfile.update({
      where: { id },
      data: { deletedAt: new Date(), isDeleted: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[signature-profiles] DELETE error", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus signature profile." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = Number(body?.id);
    const name = String(body?.name || "").trim();
    const title = String(body?.title || "").trim();
    const imageUrl = String(body?.imageUrl || "").trim();
    const brandProfileId = body?.brandProfileId ? Number(body.brandProfileId) : null;

    if (!id || !Number.isFinite(id)) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nama penanda tangan wajib diisi." },
        { status: 400 }
      );
    }

    const updatedProfile = await prisma.signatureProfile.update({
      where: { id },
      data: {
        name,
        title: title || null,
        imageUrl,
        brandProfileId
      }
    });

    // Format untuk kompatibilitas dengan UI yang sudah ada
    const formattedProfile: SignatureProfileResponse = {
      id: updatedProfile.id,
      name: updatedProfile.name,
      title: updatedProfile.title || undefined,
      imageUrl: updatedProfile.imageUrl,
      createdAt: updatedProfile.createdAt.toISOString()
    };

    return NextResponse.json({ success: true, data: formattedProfile });
  } catch (error) {
    console.error("[signature-profiles] PUT error", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate signature profile." },
      { status: 500 }
    );
  }
}
