export async function downloadUrlAsFile(url: string, fallbackName?: string) {
  // Fetch the file as blob, extract filename from Content-Disposition if present,
  // then trigger a client-side download. Works reliably on iOS Safari.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Gagal mengunduh file (${res.status})`);
  }

  let fileName = fallbackName || "download.pdf";
  const dispo = res.headers.get("Content-Disposition");
  if (dispo) {
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(dispo);
    const extracted = decodeURIComponent(m?.[1] || m?.[2] || "");
    if (extracted) fileName = extracted;
  }
  if (!/\.pdf$/i.test(fileName)) fileName = `${fileName}.pdf`;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Delay a bit to avoid revoking before Safari consumes it
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }
}

