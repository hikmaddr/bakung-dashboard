import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth?.userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        bio: user.bio,
        address: user.address,
        city: user.city,
        country: user.country,
        postalCode: user.postalCode,
        taxId: user.taxId,
        company: user.company,
        website: user.website,
        avatar: user.avatar,
        facebook: user.facebook,
        twitter: user.twitter,
        linkedin: user.linkedin,
        instagram: user.instagram,
        isActive: user.isActive,
        roles: user.roles.map((ur) => ur.role.name),
      },
    });
  } catch (err: any) {
    console.error("[profile][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data: any = {};

    // Update profile fields
    if (body.name != null) data.name = body.name;
    if (body.firstName != null) data.firstName = body.firstName;
    if (body.lastName != null) data.lastName = body.lastName;
    if (body.phone != null) data.phone = body.phone;
    if (body.bio != null) data.bio = body.bio;
    if (body.address != null) data.address = body.address;
    if (body.city != null) data.city = body.city;
    if (body.country != null) data.country = body.country;
    if (body.postalCode != null) data.postalCode = body.postalCode;
    if (body.taxId != null) data.taxId = body.taxId;
    if (body.company != null) data.company = body.company;
    if (body.website != null) data.website = body.website;
    if (body.avatar != null) data.avatar = body.avatar;
    if (body.facebook != null) data.facebook = body.facebook;
    if (body.twitter != null) data.twitter = body.twitter;
    if (body.linkedin != null) data.linkedin = body.linkedin;
    if (body.instagram != null) data.instagram = body.instagram;

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        bio: updated.bio,
        address: updated.address,
        city: updated.city,
        country: updated.country,
        postalCode: updated.postalCode,
        taxId: updated.taxId,
        company: updated.company,
        website: updated.website,
        avatar: updated.avatar,
        facebook: updated.facebook,
        twitter: updated.twitter,
        linkedin: updated.linkedin,
        instagram: updated.instagram,
        isActive: updated.isActive,
      },
    });
  } catch (err: any) {
    console.error("[profile][PUT]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal update profile" }, { status: 500 });
  }
}