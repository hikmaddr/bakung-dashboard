 
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";

type Category = { id: number; name: string; code: string; description?: string|null };

type Product = {
  id: number;
  name: string;
  sku: string;
  category?: string;
  buyPrice: number;
  sellPrice: number;
  qty: number;
  unit?: string;
  description?: string;
  imageUrl?: string | null;
};

type Unit = { id: number; name: string; symbol: string; description?: string | null };

export default function Page() {
  const [tab, setTab] = useState<"produk" | "kategori" | "kategori-unit">("produk");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"form" | "upload">("form");
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ sku: "", name: "", description: "", categoryId: "" as number | "", unit: "pcs", buyPrice: 0, sellPrice: 0 });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCatModal, setIsCatModal] = useState(false);
  const [catForm, setCatForm] = useState<{ name: string; code: string; description: string; parentId?: string }>({ name: "", code: "", description: "" });
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [codeTouched, setCodeTouched] = useState(false);

  // Kategori Unit state
  const [unitSearch, setUnitSearch] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitDdOpen, setUnitDdOpen] = useState(false);
  const unitUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingUnits, setUploadingUnits] = useState(false);
  const [prodDdOpen, setProdDdOpen] = useState(false);
  const prodUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingProducts, setUploadingProducts] = useState(false);
  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.symbol.toLowerCase().includes(q) ||
        (u.description || "").toLowerCase().includes(q)
    );
  }, [units, unitSearch]);
  const [isUnitModal, setIsUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState<{ name: string; symbol: string; description: string }>({
    name: "",
    symbol: "",
    description: "",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.sku || "").toLowerCase().includes(q) ||
      (r.category || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/products', { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data)) setRows(data.map((p:any)=>({ id:p.id, name:p.name, sku:p.sku, category:p.category?.name, buyPrice:p.buyPrice, sellPrice:p.sellPrice, qty:p.qty, unit:p.unit, description:p.description, imageUrl:p.imageUrl })) );
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/product-categories', { cache: 'no-store' }); const d = await r.json(); if (Array.isArray(d)) setCategories(d); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const cid = form.categoryId;
      if (!cid) return;
      const cat = categories.find(c=> c.id === cid);
      if (!cat) return;
      if (!form.sku || form.sku.slice(0,3) !== cat.code) {
        try { const r = await fetch(`/api/products/new-sku?code=${encodeURIComponent(cat.code)}`); const j = await r.json(); if (j?.sku) setForm(f => ({ ...f, sku: j.sku })); } catch {}
      }
    })();
  }, [form.categoryId, categories]);

  // Muat daftar unit dari API
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/product-units', { cache: 'no-store' });
        const d = await r.json();
        if (Array.isArray(d)) setUnits(d);
      } catch {}
    })();
  }, []);

  // Helper: unduh CSV unit
  const handleDownloadUnits = () => {
    try {
      if (!units.length) return toast.error("Tidak ada data untuk diunduh");
      downloadCSV(units.map(u=>({ Satuan: u.name, Simbol: u.symbol, Keterangan: u.description ?? "" })), "unit-kategori.csv");
    } catch (e:any) {
      toast.error(e?.message || "Gagal mengunduh CSV");
    }
  };

  // Unduh XLSX unit
  const handleDownloadUnitsXLSX = async () => {
    try {
      if (!units.length) return toast.error("Tidak ada data untuk diunduh");
      const rowsX = units.map(u=>({ Satuan: u.name, Simbol: u.symbol, Keterangan: u.description ?? "" }));
      await downloadXLSX(rowsX, "unit-kategori.xlsx", "Units");
    } catch (e:any) {
      toast.error(e?.message || "Gagal mengunduh XLSX");
    }
  };

  // Unduh CSV produk
  const handleDownloadProducts = () => {
    try {
      if (!rows.length) return toast.error("Tidak ada data untuk diunduh");
      downloadCSV(rows.map(r=>({
        SKU: r.sku,
        Nama: r.name,
        Kategori: r.category ?? '',
        Unit: r.unit ?? '',
        HargaModal: r.buyPrice,
        HargaJual: r.sellPrice,
        Kuantitas: r.qty,
        Deskripsi: r.description ?? ''
      })), 'produk.csv');
    } catch (e:any) { toast.error(e?.message || 'Gagal mengunduh CSV'); }
  };

  // Unduh XLSX produk
  const handleDownloadProductsXLSX = async () => {
    try {
      if (!rows.length) return toast.error("Tidak ada data untuk diunduh");
      const out = rows.map(r=>({
        SKU: r.sku,
        Nama: r.name,
        Kategori: r.category ?? '',
        Unit: r.unit ?? '',
        HargaModal: r.buyPrice,
        HargaJual: r.sellPrice,
        Kuantitas: r.qty,
        Deskripsi: r.description ?? ''
      }));
      await downloadXLSX(out, 'produk.xlsx', 'Produk');
    } catch (e:any) { toast.error(e?.message || 'Gagal mengunduh XLSX'); }
  };

  // Helper: parser CSV sederhana (kompatibel dengan field berquote)
  function parseCSV(text: string): string[][] {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n+/).filter(l=>l.trim().length>0);
    const rows: string[][] = [];
    const re = /\s*(?:"([^"]*(?:""[^"]*)*)"|([^,]*))\s*(?:,|$)/g;
    for (const line of lines) {
      const row: string[] = [];
      line.replace(re, (_, quoted, plain) => {
        const v = quoted != null ? quoted.replace(/""/g, '"') : (plain ?? "");
        row.push(v);
        return "";
      });
      rows.push(row);
    }
    return rows;
  }

  const refetchUnits = async () => {
    try {
      const r = await fetch('/api/product-units', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) setUnits(d);
    } catch {}
  };

  const handleUploadUnitsFile = async (file: File) => {
    try {
      setUploadingUnits(true);
      const isXlsx = /\.xlsx$/i.test(file.name) || (file.type && file.type.includes('spreadsheet'));
      const mapBySymbol = new Map(units.map(u=> [String(u.symbol).toLowerCase(), u]));
      const tasks: Promise<any>[] = [];

      if (isXlsx) {
        const ab = await file.arrayBuffer();
        const XLSXModule: any = await import('xlsx');
        const XLSX: any = XLSXModule.default ?? XLSXModule;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) { toast.error('File kosong'); return; }
        const get = (obj: any, syn: string[]) => {
          const keys = Object.keys(obj);
          for (const k of keys) {
            const lk = k.trim().toLowerCase();
            if (syn.includes(lk)) return String(obj[k] ?? '');
          }
          return '';
        };
        for (const obj of json) {
          const name = get(obj, ['satuan','name','nama','unit']).trim();
          const symbol = get(obj, ['simbol','symbol','kode','code']).trim();
          const description = get(obj, ['keterangan','description','deskripsi']).trim() || null;
          if (!name || !symbol) continue;
          const existing = mapBySymbol.get(symbol.toLowerCase());
          if (existing) {
            tasks.push(fetch(`/api/product-units/${existing.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, symbol, description }) }));
          } else {
            tasks.push(fetch('/api/product-units', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, symbol, description }) }));
          }
        }
      } else {
        const text = await file.text();
        const rows = parseCSV(text);
        if (!rows.length) { toast.error('File kosong'); return; }
        const header = rows[0].map(h=>h.trim().toLowerCase());
        const iName = header.findIndex(h=> ['satuan','name','nama','unit'].includes(h));
        const iSymbol = header.findIndex(h=> ['simbol','symbol','kode','code'].includes(h));
        const iDesc = header.findIndex(h=> ['keterangan','description','deskripsi'].includes(h));
        if (iName < 0 || iSymbol < 0) { toast.error('Header CSV harus memuat Satuan dan Simbol'); return; }
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const name = (row[iName] ?? '').trim();
          const symbol = (row[iSymbol] ?? '').trim();
          const description = (iDesc >=0 ? (row[iDesc] ?? '').trim() : '').trim() || null;
          if (!name || !symbol) continue;
          const existing = mapBySymbol.get(symbol.toLowerCase());
          if (existing) {
            tasks.push(fetch(`/api/product-units/${existing.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, symbol, description }) }));
          } else {
            tasks.push(fetch('/api/product-units', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, symbol, description }) }));
          }
        }
      }
      if (tasks.length === 0) { toast.error('Tidak ada baris valid untuk diunggah'); return; }
      const responses = await Promise.all(tasks);
      const failures: string[] = [];
      for (const resp of responses) {
        if (!resp.ok) {
          try { failures.push(await resp.text()); } catch { failures.push(String(resp.status)); }
        }
      }
      if (failures.length) toast.error(`Beberapa baris gagal diunggah: ${failures.length}`); else toast.success('Unggah data selesai');
      await refetchUnits();
    } catch (e:any) {
      toast.error(e?.message || 'Gagal mengunggah file');
    } finally {
      setUploadingUnits(false);
      setUnitDdOpen(false);
    }
  };

  const handleUploadProductsFile = async (file: File) => {
    try {
      setUploadingProducts(true);
      // Jika file adalah XLSX, lakukan parsing XLSX lalu keluar lebih awal
      const isXlsx = /\.xlsx$/i.test(file.name) || (file.type && file.type.includes('spreadsheet'));
      if (isXlsx) {
        const bySku = new Map(rows.map(r=> [String(r.sku).toLowerCase(), r]));
        const ab = await file.arrayBuffer();
        const XLSXModule: any = await import('xlsx');
        const XLSX: any = XLSXModule.default ?? XLSXModule;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) { toast.error('File kosong'); return; }
        const get = (obj: any, syn: string[]) => {
          const keys = Object.keys(obj);
          for (const k of keys) { const lk = k.trim().toLowerCase(); if (syn.includes(lk)) return String(obj[k] ?? ''); }
          return '';
        };
        const tasksX: Promise<Response>[] = [];
        for (const obj of json) {
          const sku = get(obj, ['sku','kode produk','kode']).trim(); if (!sku) continue;
          const name = get(obj, ['nama','name','product name']).trim(); if (!name) continue;
          const catVal = get(obj, ['kategori','category','category name','kode kategori','category code']).trim();
          const unit = (get(obj, ['unit','satuan']).trim() || 'pcs');
          const buyPrice = Number(get(obj, ['harga modal','buyprice','harga beli']).replace(/[\,\s]/g,'')) || 0;
          const sellPrice = Number(get(obj, ['harga jual','sellprice']).replace(/[\,\s]/g,'')) || 0;
          const qty = Number(get(obj, ['kuantitas','qty','quantity']).replace(/[\,\s]/g,'')) || 0;
          const description = (get(obj, ['deskripsi','description','keterangan']).trim() || null);
          let categoryId: number | undefined = undefined;
          if (catVal) { const lower = catVal.toLowerCase(); const found = categories.find(c=> c.name.toLowerCase() === lower || c.code.toLowerCase() === lower); if (found) categoryId = found.id; }
          const existing = bySku.get(sku.toLowerCase());
          const payload = { sku, name, description, categoryId, unit, buyPrice, sellPrice, qty } as any;
          if (existing) tasksX.push(fetch(`/api/products/${existing.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }));
          else tasksX.push(fetch('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }));
        }
        if (tasksX.length === 0) { toast.error('Tidak ada baris valid untuk diunggah'); return; }
        const resX = await Promise.all(tasksX);
        const failuresX: string[] = [];
        for (const resp of resX) {
          if (!resp.ok) {
            try { failuresX.push(await resp.text()); } catch { failuresX.push(String(resp.status)); }
          }
        }
        if (failuresX.length) toast.error(`Beberapa baris gagal diunggah: ${failuresX.length}`); else toast.success('Unggah data produk selesai');
        try { const res = await fetch('/api/products', { cache: 'no-store' }); const data = await res.json(); if (Array.isArray(data)) setRows(data.map((p:any)=>({ id:p.id, name:p.name, sku:p.sku, category:p.category?.name, buyPrice:p.buyPrice, sellPrice:p.sellPrice, qty:p.qty, unit:p.unit, description:p.description, imageUrl:p.imageUrl })) ); } catch {}
        return;
      }
      const text = await file.text();
      const rowsCsv = parseCSV(text);
      if (!rowsCsv.length) { toast.error('File kosong'); return; }
      const header = rowsCsv[0].map(h=>h.trim().toLowerCase());
      const iSku = header.findIndex(h=> ['sku','kode produk','kode'].includes(h));
      const iName = header.findIndex(h=> ['nama','name','product name'].includes(h));
      const iCategory = header.findIndex(h=> ['kategori','category','category name','kode kategori','category code'].includes(h));
      const iUnit = header.findIndex(h=> ['unit','satuan'].includes(h));
      const iBuy = header.findIndex(h=> ['harga modal','buyprice','harga beli'].includes(h));
      const iSell = header.findIndex(h=> ['harga jual','sellprice'].includes(h));
      const iQty = header.findIndex(h=> ['kuantitas','qty','quantity'].includes(h));
      const iDesc = header.findIndex(h=> ['deskripsi','description','keterangan'].includes(h));
      if (iSku < 0 || iName < 0) { toast.error('Header CSV harus memuat SKU dan Nama'); return; }

      // Map sku -> product
      const bySku = new Map(rows.map(r=> [String(r.sku).toLowerCase(), r]));

      const tasks: Promise<Response>[] = [];
      for (let r = 1; r < rowsCsv.length; r++) {
        const row = rowsCsv[r];
        const sku = (row[iSku] ?? '').trim(); if (!sku) continue;
        const name = (row[iName] ?? '').trim(); if (!name) continue;
        const catVal = iCategory>=0 ? (row[iCategory] ?? '').trim() : '';
        const unit = iUnit>=0 ? (row[iUnit] ?? '').trim() || 'pcs' : 'pcs';
        const buyPrice = iBuy>=0 ? Number((row[iBuy] ?? '0').toString().replace(/[,\s]/g,'')) || 0 : 0;
        const sellPrice = iSell>=0 ? Number((row[iSell] ?? '0').toString().replace(/[,\s]/g,'')) || 0 : 0;
        const qty = iQty>=0 ? Number((row[iQty] ?? '0').toString().replace(/[,\s]/g,'')) || 0 : 0;
        const description = iDesc>=0 ? (row[iDesc] ?? '').trim() || null : null;

        // map kategori: cocokkan ke categories by name atau code
        let categoryId: number | undefined = undefined;
        if (catVal) {
          const lower = catVal.toLowerCase();
          const found = categories.find(c=> c.name.toLowerCase() === lower || c.code.toLowerCase() === lower);
          if (found) categoryId = found.id;
        }

        const existing = bySku.get(sku.toLowerCase());
        const payload = { sku, name, description, categoryId, unit, buyPrice, sellPrice, qty } as any;
        if (existing) {
          tasks.push(fetch(`/api/products/${existing.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }));
        } else {
          tasks.push(fetch('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }));
        }
      }
      if (tasks.length === 0) { toast.error('Tidak ada baris valid untuk diunggah'); return; }
      const responses = await Promise.all(tasks);
      const failures: string[] = [];
      for (const resp of responses) {
        if (!resp.ok) {
          try { failures.push(await resp.text()); } catch { failures.push(String(resp.status)); }
        }
      }
      if (failures.length) toast.error(`Beberapa baris gagal diunggah: ${failures.length}`); else toast.success('Unggah data produk selesai');
      // Refresh products
      try { const res = await fetch('/api/products', { cache: 'no-store' }); const data = await res.json(); if (Array.isArray(data)) setRows(data.map((p:any)=>({ id:p.id, name:p.name, sku:p.sku, category:p.category?.name, buyPrice:p.buyPrice, sellPrice:p.sellPrice, qty:p.qty, unit:p.unit, description:p.description, imageUrl:p.imageUrl })) ); } catch {}
    } catch (e:any) { toast.error(e?.message || 'Gagal mengunggah CSV'); }
    finally { setUploadingProducts(false); setProdDdOpen(false); }
  };

  return (
    <div className="p-6">
      <PageBreadcrumb pageTitle="Produk" />

      <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="flex gap-6 border-b border-gray-200 pb-2 text-sm">
            {([
              { key: "produk", label: "Produk" },
              { key: "kategori", label: "Kategori Produk" },
              { key: "kategori-unit", label: "Kategori Unit" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`pb-2 ${tab === t.key ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "produk" && (
            <div className="mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="w-full sm:w-72">
                  <input
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}
                    placeholder="Cari produk..."
                    className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                  />
                </div>
                <div className="flex items-center gap-3 relative">
                  <button type="button" className="dropdown-toggle rounded-full border px-4 py-2 text-sm hover:bg-gray-50" onClick={()=> setProdDdOpen(o=> !o)} disabled={uploadingProducts}>Unggah dan Unduh</button>
                  <Dropdown isOpen={prodDdOpen} onClose={()=> setProdDdOpen(false)}>
                    <div className="py-1">
                      <DropdownItem onClick={()=> prodUploadInputRef.current?.click()}>Unggah Data Produk</DropdownItem>
                      <DropdownItem onClick={handleDownloadProducts}>Unduh Data Produk</DropdownItem>
                      <DropdownItem onClick={handleDownloadProductsXLSX}>Unduh XLSX Produk</DropdownItem>
                    </div>
                  </Dropdown>
                  <input ref={prodUploadInputRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleUploadProductsFile(f); e.currentTarget.value=''; }} />
                  <button onClick={()=>{ if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview); setEditing(null); setForm({ sku: "", name: "", description: "", categoryId: "", unit: "pcs", buyPrice: 0, sellPrice: 0 }); setPhoto(null); setPhotoPreview(null); setActiveModalTab("form"); setIsModalOpen(true); }} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Buat Produk Baru</button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left w-20">Foto</th>
                      <th className="p-3 text-left">Nama Produk</th>
                      <th className="p-3 text-left">Kode Produk (SKU)</th>
                      <th className="p-3 text-left">Nama Kategori</th>
                      <th className="p-3 text-right">Harga Modal</th>
                      <th className="p-3 text-right">Harga Jual</th>
                      <th className="p-3 text-right">Kuantitas</th>
                      <th className="p-3 text-left">Unit</th>
                      <th className="p-3 text-left">Deskripsi</th>
                      <th className="p-3 text-center w-32">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-gray-500">Tidak ada produk</td>
                      </tr>
                    ) : (
                      filtered.map((p) => (
                        <tr key={p.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="h-10 w-14 rounded border object-cover" />
                            ) : (
                              <div className="h-10 w-14 rounded border bg-gray-50 grid place-items-center text-[10px] text-gray-400">NO IMAGE</div>
                            )}
                          </td>
                          <td className="p-3">{p.name}</td>
                          <td className="p-3">{p.sku}</td>
                          <td className="p-3">{p.category || '-'}</td>
                          <td className="p-3 text-right">{p.buyPrice.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right">{p.sellPrice.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right">{p.qty}</td>
                          <td className="p-3">{p.unit || '-'}</td>
                          <td className="p-3 truncate max-w-[240px]">{p.description || '-'}</td>
                          <td className="p-3 text-center">
                            <div className="inline-flex relative">
                              <button className="rounded bg-emerald-500 px-3 py-1.5 text-white text-xs" onClick={()=>{ const cat = categories.find(c=> c.name===p.category); setEditing(p); setForm({ sku: p.sku, name: p.name, description: p.description||"", categoryId: cat?.id ?? "", unit: p.unit||"pcs", buyPrice: p.buyPrice, sellPrice: p.sellPrice }); if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview); setPhoto(null); setPhotoPreview(p.imageUrl || null); setActiveModalTab("form"); setIsModalOpen(true); }}>Ubah</button>
                              <button className="ml-2 rounded bg-red-500 px-3 py-1.5 text-white text-xs" onClick={async()=>{ try { const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' }); if (res.ok) setRows(rs=> rs.filter(x=> x.id!==p.id)); } catch {} }}>Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "kategori" && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Semua Kategori</div>
                <button onClick={()=>{ setCatForm({ name:'', code:'', parentId:'', description:''}); setIsCatModal(true); }} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Buat Kategori Baru</button>
              </div>
              <div className="mt-4 rounded-2xl border border-gray-200 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Nama Kategori</th>
                      <th className="p-3 text-left">Kode</th>
                      
                      <th className="p-3 text-left">Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.length===0 ? (
                      <tr><td colSpan={3} className="p-6 text-center text-gray-500">Tidak ada kategori</td></tr>
                    ) : categories.map(c => (
                      <tr key={c.id} className="border-t">
                        <td className="p-3">{c.name}</td>
                        <td className="p-3">{c.code}</td>
                        <td className="p-3">{c.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "kategori-unit" && (
            <div className="mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="w-full sm:w-72">
                  <input
                    value={unitSearch}
                    onChange={(e)=>setUnitSearch(e.target.value)}
                    placeholder="Cari unit..."
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-3 relative">
                  <button
                    type="button"
                    className="dropdown-toggle rounded-full border px-4 py-2 text-sm hover:bg-gray-50"
                    onClick={()=> setUnitDdOpen(o=> !o)}
                    disabled={uploadingUnits}
                  >Unggah dan Unduh</button>
                  <Dropdown isOpen={unitDdOpen} onClose={()=> setUnitDdOpen(false)}>
                    <div className="py-1">
                      <DropdownItem onClick={()=>{ unitUploadInputRef.current?.click(); }}>
                        Unggah Data Unit
                      </DropdownItem>
                      <DropdownItem onClick={handleDownloadUnits}>
                        Unduh Data Unit
                      </DropdownItem>
                      <DropdownItem onClick={handleDownloadUnitsXLSX}>
                        Unduh XLSX Unit
                      </DropdownItem>
                    </div>
                  </Dropdown>
                  <input
                    ref={unitUploadInputRef}
                    type="file"
                    accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleUploadUnitsFile(f); e.currentTarget.value=''; }}
                  />
                  <button
                    onClick={()=>{ setEditingUnit(null); setUnitForm({ name:"", symbol:"", description:""}); setIsUnitModal(true); }}
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Buat Unit Baru
                  </button>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-gray-200 overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Satuan</th>
                      <th className="p-3 text-left">Simbol</th>
                      <th className="p-3 text-left">Keterangan</th>
                      <th className="p-3 text-center w-32">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-gray-500">Tidak ada unit</td></tr>
                    ) : (
                      filteredUnits.map((u) => (
                        <tr key={u.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">{u.name}</td>
                          <td className="p-3">{u.symbol}</td>
                          <td className="p-3">{u.description || '-'}</td>
                          <td className="p-3 text-center">
                            <div className="inline-flex relative">
                              <button
                                className="rounded bg-emerald-500 px-3 py-1.5 text-white text-xs"
                                onClick={()=>{ setEditingUnit(u); setUnitForm({ name: u.name, symbol: u.symbol, description: u.description || "" }); setIsUnitModal(true); }}
                              >Ubah</button>
                              <button
                                className="ml-2 rounded bg-red-500 px-3 py-1.5 text-white text-xs"
                                onClick={async()=>{
                                  try {
                                    const res = await fetch(`/api/product-units/${u.id}`, { method: 'DELETE' });
                                    if (res.ok) setUnits(rs=> rs.filter(x=> x.id!==u.id));
                                    else { const j = await res.json(); toast.error(j?.error || 'Gagal menghapus unit'); }
                                  } catch (e:any) { toast.error(e?.message || 'Gagal menghapus unit'); }
                                }}
                              >Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Produk */}
      <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} className="w-[92vw] max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="max-h-[90vh] overflow-y-auto">
          <div className="px-6 pt-6">
            <div className="text-xs inline-block rounded-full border px-2 py-0.5 text-gray-600">Produk</div>
            <h3 className="mt-2 text-xl font-semibold">{editing ? 'Ubah Produk' : 'Buat Produk Baru'}</h3>
          </div>
          <div className="mt-4 px-6 border-b border-gray-200">
            {([
              {k:'form',t:'Produk'},
              {k:'upload',t:'Upload Foto Produk'},
            ] as const).map(x=> (
              <button key={x.k} onClick={()=>setActiveModalTab(x.k)} className={`mr-6 pb-2 text-sm ${activeModalTab===x.k?'border-b-2 border-blue-600 text-blue-600':'text-gray-600 hover:text-gray-800'}`}>{x.t}</button>
            ))}
          </div>

          {activeModalTab === 'form' && (
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm mb-1 font-medium">Kode Produk (SKU)</label>
                <input value={form.sku} onChange={(e)=>setForm({...form, sku:e.target.value})} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm" placeholder="SKU0002" />
              </div>
              <div>
                <label className="block text-sm mb-1 font-medium">Nama Produk</label>
                <input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm" placeholder="cth. LED TV 40, T-Shirt Size S, dll" />
              </div>
              <div>
                <label className="block text-sm mb-1 font-medium">Deskripsi Produk</label>
                <textarea value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} rows={3} className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm" placeholder="cth. Warna hitam, size S, 10 kg, dll" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 font-medium">Kategori Produk</label>
                  <select value={form.categoryId||""} onChange={(e)=> setForm({...form, categoryId: e.target.value? Number(e.target.value): ""})} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm">
                    <option value="">Tidak ada kategori yang dipilih</option>
                    {categories.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.code})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1 font-medium">Satuan Dasar</label>
                  <input value={form.unit} onChange={(e)=>setForm({...form, unit:e.target.value})} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm" placeholder="pcs" />
                </div>
              </div>
              <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
                <div className="text-sm font-medium text-blue-800 mb-3">Atur Harga</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1 text-blue-900">Harga Beli</label>
                    <input type="number" value={form.buyPrice} onChange={(e)=>setForm({...form, buyPrice: Math.max(0, Number(e.target.value))})} className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-blue-900">Harga Jual</label>
                    <input type="number" value={form.sellPrice} onChange={(e)=>setForm({...form, sellPrice: Math.max(0, Number(e.target.value))})} className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm" placeholder="0" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModalTab === 'upload' && (
            <div className="px-6 py-6">
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <div className="text-sm font-medium mb-2">Foto Produk</div>
                {photoPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={photoPreview} alt="Preview" className="h-28 w-28 rounded border object-cover" />
                    <button
                      type="button"
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
                      onClick={() => {
                        if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                    >
                      Hapus Foto
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id="prod-photo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
                        setPhoto(f);
                        setPhotoPreview(f ? URL.createObjectURL(f) : null);
                      }}
                    />
                    <label
                      htmlFor="prod-photo"
                      className="inline-block cursor-pointer rounded border px-4 py-2 text-sm bg-white hover:bg-gray-50"
                    >
                      Tarik & Letakkan atau Cari
                    </label>
                    <div className="mt-2 text-xs text-gray-500">
                      Kami mendukung file .jpeg, .jpg, .png. Pastikan file ≤ 2 MB dan dimensi ≥ 200x200.
                    </div>
                  </>
                )}
                <div className="mt-2 text-xs text-gray-500">Kami mendukung file .jpeg, .jpg, dan .png. Pastikan file ≤ 2 MB dan dimensi ≥ 200x200.</div>
                {photo && <div className="mt-3 text-sm">Dipilih: {photo.name}</div>}
              </div>
            </div>
          )}


<div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button onClick={()=>setIsModalOpen(false)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">Batalkan</button>
            <button onClick={async()=>{
              if (!form.name.trim()) return;
              try {
                const fd = new FormData();
                fd.append('sku', form.sku); fd.append('name', form.name); fd.append('description', form.description); fd.append('unit', form.unit); fd.append('buyPrice', String(form.buyPrice||0)); fd.append('sellPrice', String(form.sellPrice||0)); if (form.categoryId) fd.append('categoryId', String(form.categoryId)); if (photo) fd.append('photo', photo);
                if (editing) {
                  const res = await fetch(`/api/products/${editing.id}`, { method: 'PUT', body: fd }); const saved = await res.json(); if (res.ok) setRows(rs => rs.map(x=> x.id===editing.id ? { id:saved.id, name:saved.name, sku:saved.sku, description:saved.description, category: categories.find(c=>c.id===saved.categoryId)?.name || null as any, unit:saved.unit, buyPrice:saved.buyPrice, sellPrice:saved.sellPrice, qty:saved.qty, imageUrl:saved.imageUrl } : x));
                } else {
                  const res = await fetch('/api/products', { method: 'POST', body: fd }); const saved = await res.json(); if (res.ok) setRows(rs => [{ id:saved.id, name:saved.name, sku:saved.sku, description:saved.description, category: categories.find(c=>c.id===saved.categoryId)?.name || null as any, unit:saved.unit, buyPrice:saved.buyPrice, sellPrice:saved.sellPrice, qty:saved.qty, imageUrl:saved.imageUrl }, ...rs]);
                }
                setIsModalOpen(false);
              } catch {}
            }} className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Simpan</button>
          </div>
        </div>
      </Modal>

      {/* Modal Kategori */}
      <Modal isOpen={isCatModal} onClose={()=>setIsCatModal(false)} className="w-[92vw] max-w-md">
        <div className="px-6 pt-6 pb-4">
          <div className="text-xs inline-block rounded-full border px-2 py-0.5 text-gray-600">Kategori</div>
          <h3 className="mt-2 text-xl font-semibold">Buat Kategori Baru</h3>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm mb-1 font-medium">Nama Kategori *</label>
            <input
              value={catForm.name}
              onChange={(e)=>{
                const v = e.target.value;
                setCatForm({...catForm, name: v});
                if (!codeTouched) {
                  const letters = (v || '').toUpperCase().replace(/[^A-Z0-9 ]/g,'');
                  const parts = letters.trim().split(/\s+/).filter(Boolean);
                  let code = '';
                  if (parts.length > 1) {
                    code = parts.map(p=>p[0]).join('').slice(0,3);
                  } else {
                    code = letters.replace(/\s+/g,'').slice(0,3);
                  }
                  setCatForm(prev => ({ ...prev, code }));
                }
              }}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm"
              placeholder="Nama kategori"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Kode Kategori (3 huruf) *</label>
            <input
              value={catForm.code}
              onChange={(e)=>{
                setCodeTouched(true);
                setCatForm({...catForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)});
              }}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm"
              placeholder="ELK"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-1 font-medium">Deskripsi Kategori</label>
            <textarea value={catForm.description} onChange={(e)=>setCatForm({...catForm, description:e.target.value})} rows={3} className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm" placeholder="Deskripsi" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={()=>setIsCatModal(false)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">Batalkan</button>
          <button
            disabled={!catForm.name.trim() || catForm.code.trim().length < 2}
            onClick={async()=>{
              const name = catForm.name.trim();
              const code = catForm.code.trim().toUpperCase().slice(0,3);
              if(!name || !code) return;
              try {
                const res = await fetch('/api/product-categories', {
                  method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ name, code, description: catForm.description?.trim() || null })
                });
                const saved = await res.json();
                if (!res.ok) {
                  toast.error(saved?.error || 'Gagal menyimpan kategori');
                  return;
                }
                setCategories(cs=> [...cs, saved].sort((a:any,b:any)=> String(a.name).localeCompare(String(b.name))));
                setIsCatModal(false);
                setCatForm({ name:'', code:'', description:'' });
              } catch (e:any) {
                toast.error(e?.message || 'Gagal menyimpan kategori');
              }
            }}
            className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            Simpan
          </button>
        </div>
      </Modal>

      {/* Modal Unit */}
      <Modal isOpen={isUnitModal} onClose={()=>setIsUnitModal(false)} className="w-[92vw] max-w-md">
        <div className="px-6 pt-6 pb-4">
          <div className="text-xs inline-block rounded-full border px-2 py-0.5 text-gray-600">Kategori Unit</div>
          <h3 className="mt-2 text-xl font-semibold">{editingUnit ? 'Ubah Unit' : 'Buat Unit Baru'}</h3>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm mb-1 font-medium">Satuan *</label>
            <input value={unitForm.name} onChange={(e)=>setUnitForm({...unitForm, name: e.target.value})} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm" placeholder="cth. pcs, meter, bungkus" />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Simbol *</label>
            <input value={unitForm.symbol} onChange={(e)=>setUnitForm({...unitForm, symbol: e.target.value})} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm" placeholder="cth. PCS, M, BKS" />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Keterangan</label>
            <textarea value={unitForm.description} onChange={(e)=>setUnitForm({...unitForm, description: e.target.value})} rows={3} className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm" placeholder="Deskripsi unit (opsional)" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={()=>setIsUnitModal(false)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">Batalkan</button>
          <button
            disabled={!unitForm.name.trim() || !unitForm.symbol.trim()}
            onClick={async()=>{
              const name = unitForm.name.trim();
              const symbol = unitForm.symbol.trim();
              const description = unitForm.description.trim() || null;
              try {
                if (editingUnit) {
                  const res = await fetch(`/api/product-units/${editingUnit.id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, symbol, description })
                  });
                  const saved = await res.json();
                  if (res.ok) {
                    setUnits(prev => prev.map(u => u.id === editingUnit.id ? saved : u));
                  } else {
                    toast.error(saved?.error || 'Gagal menyimpan unit');
                    return;
                  }
                } else {
                  const res = await fetch('/api/product-units', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, symbol, description })
                  });
                  const saved = await res.json();
                  if (res.ok) {
                    setUnits(prev => [...prev, saved]);
                  } else {
                    toast.error(saved?.error || 'Gagal menyimpan unit');
                    return;
                  }
                }
                setIsUnitModal(false);
                setEditingUnit(null);
                setUnitForm({ name:"", symbol:"", description:"" });
              } catch (e:any) {
                toast.error(e?.message || 'Gagal menyimpan unit');
              }
            }}
            className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            Simpan
          </button>
        </div>
      </Modal>
    </div>
  );
}













