"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type CustomerBasic = {
  id: number;
  pic: string;
  company?: string;
  address?: string;
  phone?: string;
  email?: string | null;
};

type Props = {
  value?: number | null;
  onChange: (customer: CustomerBasic | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onAddNew?: () => void;
};

export default function CustomerPicker({ value, onChange, placeholder = "Pilih Customer...", disabled, className = "", onAddNew }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<CustomerBasic[]>([]);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/customers", { cache: "no-store" });
        const json = await res.json();
        const rows: any[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        const mapped: CustomerBasic[] = rows.map((c: any) => ({ id: Number(c.id), pic: String(c.pic || ""), company: c.company || "", address: c.address || "", phone: c.phone || "", email: c.email ?? null }));
        if (alive) setList(mapped);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = useMemo(() => list.find((x) => x.id === (value ?? -1)) || null, [list, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 50);
    return list.filter((c) =>
      c.pic.toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    ).slice(0, 50);
  }, [query, list]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex-1 justify-between inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          title={selected ? `${selected.pic}${selected.company ? ` - ${selected.company}` : ""}` : placeholder}
        >
          <span className="truncate text-left">
            {selected ? (
              <>
                <span className="font-medium">{selected.pic}</span>
                {selected.company ? <span className="text-gray-500"> {`- ${selected.company}`}</span> : null}
              </>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </span>
          <svg className="ml-2 h-4 w-4 opacity-75" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" /></svg>
        </button>
        {onAddNew && (
          <button type="button" onClick={onAddNew} className="px-3 py-2.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">+ Tambah</button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="p-2 border-b border-gray-200 dark:border-gray-800">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, perusahaan, email, no HP..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Memuat...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">Tidak ada hasil</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); setQuery(""); }}
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${selected?.id === c.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  <div className="font-medium">{c.pic}</div>
                  <div className="text-xs text-gray-500 truncate">{[c.company, c.email, c.phone].filter(Boolean).join(" • ")}</div>
                </button>
              ))
            )}
          </div>
          {selected && (
            <div className="border-t border-gray-200 p-2 text-right dark:border-gray-800">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => onChange(null)}
              >Kosongkan</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

