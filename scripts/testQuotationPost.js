// Simple local test script to POST /api/quotations with multipart form
// Uses Node.js native fetch/FormData/File (Node >= 18)

import fs from "fs/promises";

async function main() {
  const endpoint = process.env.QUO_URL || "http://localhost:3011/api/quotations";

  // Prepare fields
  const quotationNumber = process.env.QUO_NUMBER || "QUO-2025-0003";
  const date = process.env.QUO_DATE || new Date().toISOString().slice(0, 10);
  const validUntil = process.env.QUO_VALID_UNTIL || new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0, 10);
  const customerId = Number(process.env.QUO_CUSTOMER_ID || 1);

  const items = [
    {
      product: "Produk Uji",
      description: "Deskripsi",
      quantity: 1,
      unit: "pcs",
      price: 43000,
      imageKey: "itemImage1",
    },
  ];

  const fd = new FormData();
  fd.append("quotationNumber", quotationNumber);
  fd.append("date", date);
  fd.append("validUntil", validUntil);
  fd.append("projectDescription", "Test upload via script");
  fd.append("notes", "Automated test");
  fd.append("customerId", String(customerId));
  fd.append("status", "Draft");
  fd.append("items", JSON.stringify(items));

  // Attach files (JPEGs from public folder)
  const projectPath = "public/images/user/user-02.jpg";
  const itemPath = "public/images/user/user-01.jpg";
  try {
    const projectBuf = await fs.readFile(projectPath);
    const projectFile = new File([projectBuf], "user-02.jpg", { type: "image/jpeg" });
    fd.append("projectFile", projectFile);
  } catch (e) {
    console.warn("Skipping projectFile, not found:", projectPath);
  }
  try {
    const itemBuf = await fs.readFile(itemPath);
    const itemFile = new File([itemBuf], "user-01.jpg", { type: "image/jpeg" });
    fd.append("itemImage1", itemFile);
  } catch (e) {
    console.warn("Skipping itemImage1, not found:", itemPath);
  }

  const res = await fetch(endpoint, { method: "POST", body: fd });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const json = await res.json();
    console.log("Response:", JSON.stringify(json, null, 2));
  } else {
    const text = await res.text();
    console.log("Status:", res.status, res.statusText);
    console.log(text);
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

