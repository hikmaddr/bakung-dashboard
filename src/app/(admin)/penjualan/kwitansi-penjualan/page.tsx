"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Download, ChevronDown, Eye, Trash2, Truck } from "lucide-react";
import { StatusBadge, getInvoiceStatusLabel } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";
import toast from "react-hot-toast";
import FeatureGuard from "@/components/FeatureGuard";
import { formatDownloadFileName } from "@/utils/downloadFilename";

type ReceiptRow = {
  id: number;
  receiptNumber: string;
  date: string;
  total: number;
  customer?: { pic?: string; company?: string };
  _ts?: number; // key for local drafts deletion
};

  export default function KwitansiPenjualanPage() {
    // State untuk popup Surat Jalan
    const [sjOpen, setSjOpen] = useState(false);
    const [sjLoading, setSjLoading] = useState(false);
    const [sjData, setSjData] = useState<{ number: string; date: string; refInvoice: string; recvName: string; recvAddress: string; recvPhone: string; items: Array<{ name: string; qty: number; unit: string }>; senderName: string; expedition: string; shipDate: string; etaDate: string; note: string } | null>(null);
    const [waPhone, setWaPhone] = useState("");
    const [emailTo, setEmailTo] = useState("");

    const fallbackSjNumber = () => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `SJ/${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    };

    const openSjModal = async (r: ReceiptRow) => {
      // Cegah dari draft tanpa invoice ID valid
      if (r._ts && r.id === r._ts) {
        toast.error("Tidak bisa buat Surat Jalan dari draft kwitansi. Pilih invoice valid.");
        return;
      }
      setSjLoading(true);
      setSjOpen(true);
      try {
        const res = await fetch(`/api/invoices/${r.id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || "Gagal memuat data invoice");
        }
        const data = json.data || {};
        const invoiceNumber = data?.invoiceNumber || String(r.id);
        const pic = data?.customer?.pic || "";
        const company = data?.customer?.company || "";
        const name = `${pic}${company ? " - " + company : ""}`.trim();
        const addr = data?.customer?.address || "";
        const phone = data?.customer?.phone || "";
        const mappedItems = Array.isArray(data?.items)
          ? data.items.map((it: any) => ({ name: it?.name || "", qty: Number(it?.qty || 0), unit: it?.unit || "pcs" }))
          : [];
        const today = new Date().toISOString().slice(0, 10);
        const brandId = (data?.brandProfileId != null) ? Number(data.brandProfileId) : undefined;
        let nextNumber = "";
        try {
          const url = `/api/deliveries/next-number?date=${today}` + (brandId ? `&brandId=${brandId}` : "");
          const nres = await fetch(url, { cache: "no-store" });
          const njson = await nres.json().catch(() => ({}));
          if (nres.ok) {
            nextNumber = njson?.deliveryNumber || njson?.number || "";
          }
        } catch {}
        if (!nextNumber) nextNumber = fallbackSjNumber();
        const payload = {
          number: nextNumber,
          date: today,
          refInvoice: invoiceNumber,
          recvName: name,
          recvAddress: addr,
          recvPhone: phone,
          items: mappedItems,
          senderName: "",
          expedition: "Kurir Sendiri",
          shipDate: today,
          etaDate: today,
          note: "Barang sudah dicek sebelum dikirim",
        };
        setSjData(payload);
        setWaPhone(normalizePhone(phone));
        setEmailTo(data?.customer?.email || "");
      } catch (e: any) {
        toast.error(e?.message || "Gagal menyiapkan Surat Jalan");
        setSjOpen(false);
      } finally {
        setSjLoading(false);
      }
    };

    const downloadSjPdf = async () => {
      if (!sjData) return;
      try {
        setSjLoading(true);
        const response = await fetch("/api/deliveries/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sjData),
        });
        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.message || "Gagal membuat PDF Surat Jalan");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        const filename = formatDownloadFileName(
          sjData.number,
          sjData.recvName,
          sjData.number || "SJ",
          sjData.recvName || "Receiver"
        );
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Surat Jalan berhasil diunduh");
      } catch (e: any) {
        toast.error(e?.message || "Gagal mengunduh PDF");
      } finally {
        setSjLoading(false);
      }
    };

    const normalizePhone = (raw: string) => {
      let s = (raw || "").trim();
      // keep digits and plus
      s = s.replace(/[^0-9+]/g, "");
      if (!s) return "";
      if (s.startsWith("+")) s = s.slice(1);
      // asumsi Indonesia: jika mulai 0 -> ganti dengan 62
      if (s.startsWith("0")) s = "62" + s.slice(1);
      return s;
    };
    const isValidPhone = (s: string) => /^\d{8,}$/.test(s);
    const isValidEmail = (s: string) => /.+@.+\..+/.test(s);

    const buildSjMessage = () => {
      if (!sjData) return "";
      const totalItems = Array.isArray(sjData.items) ? sjData.items.length : 0;
      return `Surat Jalan ${sjData.number} tanggal ${sjData.date}. Ref Invoice: ${sjData.refInvoice || '-'}${totalItems ? `, Total item: ${totalItems}` : ''}.`;
    };

    const sendViaWhatsApp = () => {
      try {
        const msg = encodeURIComponent(buildSjMessage());
        const dest = normalizePhone(waPhone);
        if (!isValidPhone(dest)) {
          toast.error("Nomor WhatsApp tidak valid");
          return;
        }
        window.open(`https://wa.me/${dest}?text=${msg}`, "_blank");
        toast.success("WhatsApp dibuka dengan tujuan");
        setSjOpen(false);
      } catch { toast.error("Gagal membuka WhatsApp"); }
    };

    const sendViaEmail = () => {
      try {
        const subject = encodeURIComponent(`Surat Jalan ${sjData?.number || ''}`);
        const body = encodeURIComponent(buildSjMessage());
        const dest = (emailTo || "").trim();
        if (!isValidEmail(dest)) {
          toast.error("Alamat email tidak valid");
          return;
        }
        window.location.href = `mailto:${encodeURIComponent(dest)}?subject=${subject}&body=${body}`;
        setSjOpen(false);
      } catch { toast.error("Gagal membuka Email"); }
    };

    const previewSjPdf = async () => {
      if (!sjData) return;
      try {
        setSjLoading(true);
        const response = await fetch("/api/deliveries/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sjData),
        });
        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.message || "Gagal membuat PDF Surat Jalan");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success("Preview PDF dibuka");
        // Jangan revoke langsung; biarkan tab baru menggunakan URL
        setTimeout(() => { try { window.URL.revokeObjectURL(url); } catch {} }, 60000);
      } catch (e: any) {
        toast.error(e?.message || "Gagal membuka preview PDF");
      } finally {
        setSjLoading(false);
      }
    };

    const saveSjDraft = () => {
      if (!sjData) return;
      try {
        const raw = localStorage.getItem('sjDrafts') || '[]';
        let drafts: any[] = [];
        try { drafts = JSON.parse(raw); } catch { drafts = []; }
        drafts = Array.isArray(drafts) ? drafts.filter((d:any)=> (d?.sjNumber||'') !== sjData.number) : [];
        drafts.push({
          ts: Date.now(),
          sjNumber: sjData.number,
          sjDate: sjData.date,
          refInvoice: sjData.refInvoice,
          recvName: sjData.recvName,
          recvAddress: sjData.recvAddress,
          recvPhone: sjData.recvPhone,
          expedition: sjData.expedition,
          shipDate: sjData.shipDate,
          etaDate: sjData.etaDate,
          note: sjData.note,
          items: sjData.items,
        });
        localStorage.setItem('sjDrafts', JSON.stringify(drafts));
        toast.success('Draft Surat Jalan disimpan');
        setSjOpen(false);
        setTimeout(()=>{ window.location.href = '/penjualan/surat-jalan'; }, 200);
      } catch { toast.error('Gagal menyimpan draft'); }
    };
  const [showDropdown, setShowDropdown] = useState(false);
  const [rows, setRows] = useState<ReceiptRow[]>([]); // gabungan draft (localStorage) + data API (jika ada)
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusMap, setStatusMap] = useState<Record<number, any>>({});

  // Load draft dari localStorage saat mount dan saat kembali fokus
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('kwitansiDrafts') || '[]';
        const drafts = JSON.parse(raw);
        const mapped: ReceiptRow[] = Array.isArray(drafts)
          ? drafts.map((d: any) => ({
              id: Number(d.invoiceId) || d.ts,
              receiptNumber: d.invoiceNumber || `DRAFT-${d.ts}`,
              date: new Date(d.ts).toLocaleDateString('id-ID'),
              total: Number(d.total || 0),
              customer: d.customer || undefined,
              _ts: d.ts,
            }))
          : [];
        setRows(mapped);
      } catch {
        setRows([]);
      }
    };
    load();
    const onFocus = () => load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'kwitansiDrafts') load(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); };
  }, []);

  // Ambil daftar kwitansi dari server dan gabungkan dengan draft lokal
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/receipts', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.success === false) throw new Error(json?.message || 'Gagal memuat kwitansi');
        const serverRows: ReceiptRow[] = Array.isArray(json?.data)
          ? json.data.map((r: any) => ({
              id: Number(r.id), // invoiceId agar preview/unduh mengikuti alur saat ini
              receiptNumber: r.receiptNumber || `RCPT-${r.receiptId || r.id}`,
              date: r.date ? new Date(r.date).toLocaleDateString('id-ID') : '-',
              total: Number(r.total || 0),
              customer: r.customer || undefined,
            }))
          : [];
        if (cancelled) return;
        setRows((prev) => {
          const byId = new Map<number, ReceiptRow>();
          // Prioritaskan data server (lebih otoritatif)
          for (const s of serverRows) byId.set(s.id, s);
          // Tambahkan draft dan entry lama yang belum tergantikan
          for (const p of prev) {
            const isDraft = p._ts && p.id === p._ts;
            if (!isDraft && byId.has(p.id)) continue; // jika sudah ada dari server, skip
            byId.set(p.id, p);
          }
          return Array.from(byId.values()).sort((a, b) => (b._ts || 0) - (a._ts || 0));
        });
      } catch (e) {
        // Abaikan error; tetap tampilkan draft jika API gagal
        console.error('Failed to fetch receipts list', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Enrich status untuk kwitansi non-draft berdasarkan status invoice terkait
  useEffect(() => {
    const nonDraft = rows.filter(r => !(r._ts && r.id === r._ts));
    if (nonDraft.length === 0) { setStatusMap({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          nonDraft.map(async (r) => {
            try {
              const res = await fetch(`/api/invoices/${r.id}`, { cache: 'no-store' });
              const json = await res.json();
              if (!res.ok || json?.success === false) throw new Error(json?.message || 'Gagal memuat invoice');
              const inv = json.data || {};
              const label = getInvoiceStatusLabel(inv);
              return [r.id, label] as const;
            } catch {
              return [r.id, 'Pending'] as const;
            }
          })
        );
        if (cancelled) return;
        const map: Record<number, any> = {};
        for (const [id, label] of entries) map[id] = label;
        setStatusMap(map);
      } catch {
        if (!cancelled) setStatusMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r => r.receiptNumber.toLowerCase().includes(q) || (r.customer?.pic||'').toLowerCase().includes(q) || (r.customer?.company||'').toLowerCase().includes(q));
  }, [rows, searchTerm]);
  const { totalPages, paged } = useMemo(() => {
    const total = Math.max(1, Math.ceil(filtered.length / limit));
    const start = (page - 1) * limit;
    const slice = filtered.slice(start, start + limit);
    return { totalPages: total, paged: slice } as const;
  }, [filtered, limit, page]);
  const fmt = useCallback((n: number) => (Number(n) || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }), []);
  const customerText = useCallback((r: ReceiptRow) => {
    const name = r.customer?.pic?.trim() || '';
    const company = r.customer?.company?.trim() || '';
    if (name && company) return `${name} - ${company}`;
    if (name) return name;
    if (company) return company;
    return '-';
  }, []);
  const openPreview = useCallback((r: ReceiptRow) => {
    try {
      const payload = { from: 'receipt-list', invoiceId: r.id, invoiceNumber: r.receiptNumber, ts: Date.now() };
      localStorage.setItem('newReceiptFromInvoice', JSON.stringify(payload));
    } catch {}
    window.open(`/penjualan/kwitansi-penjualan/${r.id}`, '_blank');
  }, []);
  const sendToSJ = useCallback((r: ReceiptRow) => {
    try {
      const payload = { from: 'receipt-list', invoiceId: r.id, invoiceNumber: r.receiptNumber, ts: Date.now() };
      localStorage.setItem('newReceiptFromInvoice', JSON.stringify(payload));
    } catch {}
    window.location.href = `/penjualan/surat-jalan/add?from=receipt-list&invoiceId=${r.id}`;
  }, []);
  const downloadKw = useCallback(async (r: ReceiptRow) => {
    try {
      const payload = { from: 'receipt-list', invoiceId: r.id, invoiceNumber: r.receiptNumber, ts: Date.now() };
      localStorage.setItem('newReceiptFromInvoice', JSON.stringify(payload));
    } catch {}

    // Periksa apakah ini adalah draft (ID berupa timestamp) atau invoice yang valid
    const isDraft = r._ts && r.id === r._ts;
    if (isDraft) {
      toast.error("Tidak dapat mengunduh PDF untuk draft kwitansi. Silakan buat kwitansi terlebih dahulu.");
      return;
    }

    try {
      const response = await fetch(`/api/receipts/${r.id}/pdf`, { cache: "no-store" });
      if (!response.ok) {
        const errorMessage = (await response.json().catch(() => null))?.message ?? "Gagal mengunduh kwitansi";
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = formatDownloadFileName(
        r.receiptNumber,
        r.customer?.pic || r.customer?.company,
        r.receiptNumber || `KW-${r.id}`,
        r.customer?.pic || r.customer?.company || "Customer"
      );
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Kwitansi berhasil diunduh");
    } catch (err) {
      console.error("Failed to download receipt PDF", err);
      const message = err instanceof Error ? err.message : "Gagal mengunduh kwitansi";
      toast.error(message);
    }
  }, []);
  const deleteDraft = useCallback((r: ReceiptRow) => {
    if (!confirm('Hapus kwitansi ini?')) return;
    try {
      const raw = localStorage.getItem('kwitansiDrafts') || '[]';
      const drafts = JSON.parse(raw);
      const filtered = Array.isArray(drafts)
        ? drafts.filter((d: any) => {
            if (r._ts) return d.ts !== r._ts;
            return Number(d.invoiceId) !== r.id;
          })
        : [];
      localStorage.setItem('kwitansiDrafts', JSON.stringify(filtered));
      setRows(prev => prev.filter(x => x !== r));
    } catch {
      // fallback update state only
      setRows(prev => prev.filter(x => x !== r));
    }
  }, []);

  return (
    <>
    <FeatureGuard feature="sales.receipt">
    <div className="sales-scope p-6 min-h-screen">
      <PageBreadcrumb pageTitle="Kwitansi Penjualan" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 min-h-[70vh] overflow-visible flex flex-col gap-4">
        {/* Toolbar */}
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Cari pelanggan / nomor kwitansi..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="h-11 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden"
          />
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowDropdown(v=>!v)} className="border px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Unduh & Bagikan
                <ChevronDown className="h-4 w-4" />
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white shadow-lg rounded-md border z-10">
                  <ul className="py-2 text-sm text-gray-700">
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Unduh Semua Dokumen</li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                      if (!filtered.length) { toast.error('Tidak ada data untuk diekspor'); return; }
                      downloadCSV(filtered, 'kwitansi.csv'); setShowDropdown(false);
                    }}>Ekspor data CSV</li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={async () => {
                      if (!filtered.length) { toast.error('Tidak ada data untuk diekspor'); return; }
                      await downloadXLSX(filtered, 'kwitansi.xlsx', 'Kwitansi'); setShowDropdown(false);
                    }}>Ekspor data XLSX</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        <div className="overflow-x-auto overflow-y-visible rounded-lg border bg-white shadow-sm min-h-[50vh] flex-1">
          {paged.length === 0 ? (
            <EmptyState
              title="Belum ada kwitansi penjualan"
              description="Buat Kwitansi Penjualan atau kirim Invoice Penjualan untuk menyediakan beragam metode pembayaran kepada pelanggan Anda."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">No. Kwitansi</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Nilai Invoice</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50 transition">
                    <td className="px-4 py-3">{customerText(r)}</td>
                    <td className="px-4 py-3">{r.receiptNumber}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r._ts && r.id === r._ts) ? "Draft" : (statusMap[r.id] || "Pending")} />
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(r.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button onClick={() => openPreview(r)} title="Lihat" className="p-2 rounded-full hover:bg-gray-100">
                          <Eye className="h-4 w-4 text-gray-600" />
                        </button>
                        <button onClick={() => openSjModal(r)} title="Buat Surat Jalan" className="p-2 rounded-full hover:bg-gray-100">
                          <Truck className="h-4 w-4 text-indigo-600" />
                        </button>
                        <button onClick={() => downloadKw(r)} title="Download PDF" className="p-2 rounded-full hover:bg-gray-100">
                          <Download className="h-4 w-4 text-emerald-600" />
                        </button>
                        <button onClick={() => deleteDraft(r)} title="Hapus" className="p-2 rounded-full hover:bg-gray-100">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(v) => { setLimit(v); setPage(1); }}
        />
      </div>
      </div>
    </FeatureGuard>

    {/* Popup Surat Jalan tanpa form */}
    {sjOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSjOpen(false);
        }}
      >
        <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold">Buat Surat Jalan</h3>
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100"
              onClick={() => setSjOpen(false)}
              aria-label="Tutup"
            >
              ×
            </button>
          </div>
          <div className="px-6 py-4">
            {sjLoading && <div className="text-sm text-slate-500">Menyiapkan data...</div>}
            {!sjLoading && sjData && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div>No. Surat Jalan : <span className="font-medium">{sjData.number}</span></div>
                    <div>Tanggal : <span className="font-medium">{sjData.date}</span></div>
                    <div>No. Referensi Inv : <span className="font-medium">{sjData.refInvoice || "-"}</span></div>
                  </div>
                  <div>
                    <div className="font-medium">Kepada Yth:</div>
                    <div>Nama Penerima : {sjData.recvName || "-"}</div>
                    <div>Alamat : <span className="whitespace-pre-line">{sjData.recvAddress || "-"}</span></div>
                    <div>Telepon : {sjData.recvPhone || "-"}</div>
                  </div>
                </div>
                <div className="mt-2 overflow-x-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Nama Barang</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!sjData.items || sjData.items.length === 0) ? (
                        <tr><td colSpan={3} className="text-center text-gray-500 py-4">Tidak ada barang</td></tr>
                      ) : sjData.items.map((i, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{i.name}</td>
                          <td className="px-3 py-2 text-center">{i.qty}</td>
                          <td className="px-3 py-2">{i.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Informasi pengirim dan input tujuan dihilangkan sesuai permintaan */}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t px-6 py-4">
            {/* Grup kiri: kirim/preview */}
            <div className="flex items-center gap-2">
              <button
                onClick={sendViaWhatsApp}
                disabled={!sjData || sjLoading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Kirim via WhatsApp
              </button>
              <button
                onClick={sendViaEmail}
                disabled={!sjData || sjLoading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Kirim via Email
              </button>
              <button
                onClick={previewSjPdf}
                disabled={!sjData || sjLoading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Preview PDF
              </button>
            </div>

            {/* Grup tengah: simpan/unduh */}
            <div className="flex items-center gap-2">
              <button
                onClick={saveSjDraft}
                disabled={!sjData || sjLoading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Simpan
              </button>
              <button
                onClick={downloadSjPdf}
                disabled={!sjData || sjLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Unduh PDF
              </button>
            </div>

            {/* Grup kanan: batal */}
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                onClick={() => setSjOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
