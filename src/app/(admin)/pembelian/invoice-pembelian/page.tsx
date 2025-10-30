"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Modal } from "@/components/ui/modal";
import {
  AlarmClock,
  ArrowDownToLine,
  CalendarCheck2,
  CircleDollarSign,
  Download,
  FileText,
  MoreHorizontal,
  NotepadText,
  PlusCircle,
  Receipt,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet2,
} from "lucide-react";

type InvoiceStatus = "Belum Dibayar" | "Sebagian Terbayar" | "Lunas" | "Lewat Jatuh Tempo";

type PurchaseInvoice = {
  id: number;
  invoiceNumber: string;
  supplier: { name: string; pic: string; phone: string };
  issueDate: string;
  dueDate: string;
  poNumber: string;
  status: InvoiceStatus;
  total: number;
  paid: number;
  notes?: string;
  linkedGR: string[];
};

const INVOICES: PurchaseInvoice[] = [
  {
    id: 1,
    invoiceNumber: "INV/PO-25007/1025",
    supplier: { name: "PT Nusantara Chemical", pic: "Budi Santoso", phone: "+62 812-5555-111" },
    issueDate: "2025-10-14",
    dueDate: "2025-10-24",
    poNumber: "PO-25007",
    status: "Belum Dibayar",
    total: 18250000,
    paid: 0,
    notes: "Invoice baru diterima, perlu verifikasi QC.",
    linkedGR: ["GR-25005"],
  },
  {
    id: 2,
    invoiceNumber: "INV/PO-25006/1025",
    supplier: { name: "CV Mega Plastik", pic: "Sinta Putri", phone: "+62 811-8009-321" },
    issueDate: "2025-10-11",
    dueDate: "2025-10-21",
    poNumber: "PO-25006",
    status: "Sebagian Terbayar",
    total: 9450000,
    paid: 3780000,
    notes: "Sudah dibayar 40% sebagai DP.",
    linkedGR: ["GR-25004"],
  },
  {
    id: 3,
    invoiceNumber: "INV/PO-25005/1025",
    supplier: { name: "PT Solusi Tekstil", pic: "Andi Wijaya", phone: "+62 812-9080-111" },
    issueDate: "2025-10-07",
    dueDate: "2025-10-17",
    poNumber: "PO-25005",
    status: "Lewat Jatuh Tempo",
    total: 12800000,
    paid: 6400000,
    notes: "Supplier meminta follow-up pembayaran sebelum pengiriman batch kedua.",
    linkedGR: ["GR-25003"],
  },
  {
    id: 4,
    invoiceNumber: "INV/PO-25004/1025",
    supplier: { name: "PT Prima Metal", pic: "Iwan Nugroho", phone: "+62 823-600-700" },
    issueDate: "2025-10-03",
    dueDate: "2025-10-13",
    poNumber: "PO-25004",
    status: "Lunas",
    total: 22780000,
    paid: 22780000,
    linkedGR: ["GR-25002", "GR-25001"],
  },
  {
    id: 5,
    invoiceNumber: "INV/PO-25003/0925",
    supplier: { name: "CV Global Kargo", pic: "Maria Gunawan", phone: "+62 877-1100-220" },
    issueDate: "2025-09-30",
    dueDate: "2025-10-10",
    poNumber: "PO-25003",
    status: "Lewat Jatuh Tempo",
    total: 5150000,
    paid: 0,
    notes: "Menunggu kelengkapan dokumen pengiriman untuk proses bayar.",
    linkedGR: [],
  },
];

const STATUS_OPTIONS: Array<{ label: string; value: InvoiceStatus | "Semua" }> = [
  { label: "Semua Status", value: "Semua" },
  { label: "Belum Dibayar", value: "Belum Dibayar" },
  { label: "Sebagian Terbayar", value: "Sebagian Terbayar" },
  { label: "Lunas", value: "Lunas" },
  { label: "Lewat Jatuh Tempo", value: "Lewat Jatuh Tempo" },
];

const statusTheme: Record<InvoiceStatus, string> = {
  "Belum Dibayar": "bg-amber-100 text-amber-700",
  "Sebagian Terbayar": "bg-sky-100 text-sky-700",
  Lunas: "bg-emerald-100 text-emerald-700",
  "Lewat Jatuh Tempo": "bg-rose-100 text-rose-600",
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export default function PurchaseInvoicePage() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "Semua">("Semua");
  const [search, setSearch] = useState("");
  const [paymentWindow, setPaymentWindow] = useState<"all" | "7" | "overdue">("all");
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  const filteredInvoices = useMemo(() => {
    const query = search.toLowerCase();
    return INVOICES.filter((invoice) => {
      const matchStatus = statusFilter === "Semua" || invoice.status === statusFilter;
      const matchSearch =
        !query ||
        [invoice.invoiceNumber, invoice.poNumber, invoice.supplier.name]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchPaymentWindow =
        paymentWindow === "all"
          ? true
          : paymentWindow === "7"
          ? isWithinNDays(new Date(invoice.dueDate), 7)
          : new Date(invoice.dueDate) < new Date() && invoice.status !== "Lunas";
      return matchStatus && matchSearch && matchPaymentWindow;
    });
  }, [search, statusFilter, paymentWindow]);

  const metrics = useMemo(() => {
    const outstanding = filteredInvoices
      .filter((invoice) => invoice.status !== "Lunas")
      .reduce((acc, inv) => acc + inv.total - inv.paid, 0);
    const overdueCount = filteredInvoices.filter((inv) => inv.status === "Lewat Jatuh Tempo").length;
    const dueSoon = filteredInvoices.filter(
      (inv) => inv.status !== "Lunas" && isWithinNDays(new Date(inv.dueDate), 5)
    ).length;
    const paidThisMonth = INVOICES.filter((invoice) => invoice.status === "Lunas").reduce(
      (acc, inv) => acc + inv.total,
      0
    );
    return {
      outstanding,
      overdueCount,
      dueSoon,
      paidThisMonth,
    };
  }, [filteredInvoices]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        pageTitle="Invoice Pembelian"
        items={[
          { label: "Pembelian" },
          { label: "Invoice Pembelian", href: "/pembelian/invoice-pembelian" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InvoiceStatCard
          icon={<CircleDollarSign className="h-5 w-5" />}
          title="Outstanding"
          value={currency.format(metrics.outstanding)}
          helper="Nilai invoice belum terbayar"
        />
        <InvoiceStatCard
          icon={<AlarmClock className="h-5 w-5" />}
          title="Lewat Tempo"
          value={metrics.overdueCount}
          helper="Tagihan perlu akselerasi pembayaran"
        />
        <InvoiceStatCard
          icon={<CalendarCheck2 className="h-5 w-5" />}
          title="Jatuh Tempo 7 Hari"
          value={metrics.dueSoon}
          helper="Perlu penjadwalan pembayaran"
        />
        <InvoiceStatCard
          icon={<Wallet2 className="h-5 w-5" />}
          title="Terbayar Bulan Ini"
          value={currency.format(metrics.paidThisMonth)}
          helper="Realisasi pembayaran vendor"
        />
      </section>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Monitoring Invoice</h2>
            <p className="mt-1 text-sm text-gray-500">
              Tracking status pembayaran vendor dan keterhubungan dengan PO maupun GR.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
              onClick={() => setPaymentWindow((prev) => (prev === "all" ? "7" : "all"))}
            >
              <RefreshCcw className="h-4 w-4" />
              {paymentWindow === "7" ? "Tampilkan semua jatuh tempo" : "Fokus jatuh tempo"}
            </button>
            <button className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Export
            </button>
            <Link
              href="/pembelian/invoice-pembelian/add"
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <PlusCircle className="h-4 w-4" />
              Input Invoice
            </Link>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari invoice, NO PO, atau supplier"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value === "Semua" ? "Semua" : (event.target.value as InvoiceStatus))
                }
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">
              <Receipt className="h-3.5 w-3.5" />
              {filteredInvoices.length} invoice aktif
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Tagihan</th>
                  <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                  <th className="px-4 py-3 text-left font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                {filteredInvoices.map((invoice) => {
                  const progress = Math.min((invoice.paid / invoice.total) * 100, 100);
                  const outstanding = invoice.total - invoice.paid;
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-gray-500">PO: {invoice.poNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{invoice.supplier.name}</div>
                        <div className="text-xs text-gray-500">
                          {invoice.supplier.pic} · {invoice.supplier.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="font-medium text-gray-700">{formatDate(invoice.issueDate)}</div>
                        <div className="text-xs text-amber-600">Jatuh tempo {formatDate(invoice.dueDate)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[invoice.status]}`}>
                          {invoice.status === "Lunas" ? (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          ) : invoice.status === "Sebagian Terbayar" ? (
                            <Wallet2 className="h-3.5 w-3.5" />
                          ) : invoice.status === "Belum Dibayar" ? (
                            <NotepadText className="h-3.5 w-3.5" />
                          ) : (
                            <AlarmClock className="h-3.5 w-3.5" />
                          )}
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{currency.format(invoice.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-800">{currency.format(outstanding)}</div>
                        <div className="mt-1 h-1.5 w-24 rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${progress}%` }}
                            aria-hidden
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-400">{Math.round(progress)}% dibayar</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <button
                            onClick={() => setSelectedInvoice(invoice)}
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50"
                          >
                            Lihat detail
                          </button>
                          <button className="rounded-full border border-gray-200 p-1.5 text-gray-500 transition hover:border-gray-300 hover:text-gray-700">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                      Tidak ada invoice dengan filter saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:col-span-1 xl:col-span-2">
          <h3 className="text-base font-semibold text-gray-800">Prioritas Pembayaran</h3>
          <div className="mt-4 space-y-4">
            {INVOICES.filter((invoice) => invoice.status !== "Lunas")
              .slice(0, 4)
              .map((invoice) => (
                <div key={invoice.id} className="flex items-start justify-between rounded-xl border border-gray-100 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">
                      {invoice.supplier.name} · Due {formatDate(invoice.dueDate)}
                    </p>
                    {invoice.notes && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-600">
                        {invoice.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-gray-800">{currency.format(invoice.total - invoice.paid)}</p>
                    <p className="text-xs text-gray-400">Outstanding</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800">Dokumen Terkait</h3>
          <ul className="mt-4 space-y-3 text-sm text-gray-600">
            <li className="flex items-center gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/70 p-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-800">Rekonsiliasi PO & GR</p>
                <p className="text-xs text-gray-500">Pastikan nomor GR sesuai sebelum proses bayar.</p>
              </div>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/70 p-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium text-gray-800">Checklist Approval</p>
                <p className="text-xs text-gray-500">Finance, purchasing, dan warehouse harus menyetujui.</p>
              </div>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-3">
              <ArrowDownToLine className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-gray-800">Backup Bukti Bayar</p>
                <p className="text-xs text-gray-500">Unggah bukti transfer setelah pembayaran dilakukan.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <Modal isOpen={!!selectedInvoice} onClose={() => setSelectedInvoice(null)} className="w-[95vw] max-w-3xl">
        {selectedInvoice && (
          <div className="px-6 pt-8 pb-6">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                  Invoice Pembelian
                  <span className="font-semibold text-gray-800">{selectedInvoice.invoiceNumber}</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-gray-900">Detail Tagihan Vendor</h3>
                <p className="text-sm text-gray-500">
                  Diterbitkan {formatDate(selectedInvoice.issueDate)} · Jatuh tempo{" "}
                  {formatDate(selectedInvoice.dueDate)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${statusTheme[selectedInvoice.status]}`}>
                <CircleDollarSign className="h-4 w-4" />
                {selectedInvoice.status}
              </span>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Supplier</p>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{selectedInvoice.supplier.name}</p>
                  <p className="text-sm text-gray-600">
                    {selectedInvoice.supplier.pic} · {selectedInvoice.supplier.phone}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  PO terkait: <span className="font-medium text-gray-700">{selectedInvoice.poNumber}</span>
                </div>
                <div className="text-xs text-gray-500">
                  GR:{" "}
                  {selectedInvoice.linkedGR.length ? (
                    <span className="font-medium text-gray-700">{selectedInvoice.linkedGR.join(", ")}</span>
                  ) : (
                    <span className="font-medium text-rose-600">Belum ada</span>
                  )}
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Nilai Pembayaran</p>
                <p className="text-2xl font-semibold text-gray-900">{currency.format(selectedInvoice.total)}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Sudah dibayar</span>
                  <span className="font-medium text-emerald-600">
                    {currency.format(selectedInvoice.paid)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min((selectedInvoice.paid / selectedInvoice.total) * 100, 100)}%` }}
                    aria-hidden
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Outstanding</span>
                  <span className="font-semibold text-rose-600">
                    {currency.format(selectedInvoice.total - selectedInvoice.paid)}
                  </span>
                </div>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {selectedInvoice.notes}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <FileText className="h-4 w-4" />
                Pastikan bukti penerimaan barang telah terunggah sebelum verifikasi pembayaran.
              </div>
              <div className="flex gap-2">
                <button className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50">
                  Jadwalkan Pembayaran
                </button>
                <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                  Tandai Sudah Dibayar
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function isWithinNDays(date: Date, days: number) {
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + days);
  return date >= now && date <= future;
}

type InvoiceStatCardProps = {
  icon: ReactNode;
  title: string;
  value: string | number;
  helper: string;
};

function InvoiceStatCard({ icon, title, value, helper }: InvoiceStatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <ShieldCheck className="h-4 w-4 text-gray-300" />
      </div>
      <p className="mt-5 text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-3 text-xs text-gray-400">{helper}</p>
    </div>
  );
}
