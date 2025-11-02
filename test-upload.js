const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

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

async function uploadToDrive() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_PATH) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_PATH in environment");
  }
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID in environment");
  }

  const credentialsPath = path.resolve(
    __dirname,
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH
  );
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Google service account file not found at ${credentialsPath}`
    );
  }

  const sampleFilePath = path.resolve(__dirname, "public", "sample.pdf");
  if (!fs.existsSync(sampleFilePath)) {
    throw new Error(
      `Sample file not found at ${sampleFilePath}. Add a PDF to test uploads.`
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const driveService = google.drive({ version: "v3", auth });
  const fileMetadata = {
    name: "test-upload.pdf",
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
  };

  const media = {
    mimeType: "application/pdf",
    body: fs.createReadStream(sampleFilePath),
  };

  const { data } = await driveService.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, webViewLink",
  });

  await driveService.permissions.create({
    fileId: data.id,
    requestBody: { role: "reader", type: "anyone" },
  });

  console.log("✅ File uploaded!");
  console.log("🔗 Link preview:", data.webViewLink);
}

uploadToDrive().catch((error) => {
  console.error("❌ Upload failed:", error.message);
  process.exitCode = 1;
});

