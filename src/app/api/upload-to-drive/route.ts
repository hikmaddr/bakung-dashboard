import { google } from "googleapis";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const { fileName, fileBase64 } = await req.json();
    if (!fileName || !fileBase64) {
      return NextResponse.json({ success: false, message: "Invalid data" }, { status: 400 });
    }

    const buffer = Buffer.from(fileBase64, "base64");

    // === Autentikasi Service Account ===
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    // === Upload file ===
    const fileRes = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: "application/pdf",
      },
      media: {
        mimeType: "application/pdf",
        body: BufferToStream(buffer),
      },
      fields: "id",
    });

    const fileId = fileRes.data.id;

    // === Ubah permission jadi public view ===
    await drive.permissions.create({
      fileId: fileId!,
      requestBody: { role: "reader", type: "anyone" },
    });

    const publicUrl = `https://drive.google.com/drive/u/1/folders/1ykLCo9-us3ShN3PrsUw6sD-7_psdc7d8`;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Upload to Drive error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// Helper untuk ubah Buffer ke Stream
import { Readable } from "stream";
function BufferToStream(binary: Buffer) {
  const readable = new Readable();
  readable.push(binary);
  readable.push(null);
  return readable;
}
