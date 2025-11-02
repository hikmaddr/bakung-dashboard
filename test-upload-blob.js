const fs = require("fs");
const path = require("path");
const { put } = require("@vercel/blob");

function loadLocalEnv() {
  const envFile = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(envFile)) {
    return;
  }

  const lines = fs.readFileSync(envFile, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

async function uploadToVercelBlob() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN in environment");
  }

  const sampleFilePath = path.resolve(__dirname, "public", "sample.pdf");
  if (!fs.existsSync(sampleFilePath)) {
    throw new Error(
      `Sample file not found at ${sampleFilePath}. Add a PDF to test uploads.`
    );
  }

  const fileBuffer = fs.readFileSync(sampleFilePath);
  const filename = `test-upload-${Date.now()}.pdf`;

  const blob = await put(`tests/${filename}`, fileBuffer, {
    access: "public",
    token,
    contentType: "application/pdf",
  });

  console.log("File uploaded!");
  console.log("Blob URL:", blob.url);
}

uploadToVercelBlob().catch((error) => {
  console.error("Upload failed:", error.message);
  process.exitCode = 1;
});
