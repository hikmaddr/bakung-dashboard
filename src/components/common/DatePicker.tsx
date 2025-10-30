"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  label?: string;
  value: string; // format yyyy-mm-dd
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
};

function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DatePicker({ label, value, onChange, placeholder = "Select date", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(() => selected?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => selected?.getMonth() ?? new Date().getMonth());

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const grid: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(viewYear, viewMonth, d));
  while (grid.length % 7 !== 0) grid.push(null);

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(viewYear, viewMonth, 1));

  const handleSelect = (d: Date) => {
    onChange(formatYMD(d));
    setOpen(false);
  };

  const displayValue = selected ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(selected) : "";

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      {label && <label className="block mb-1 font-medium">{label}</label>}
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full justify-between rounded border px-3 py-2 text-left">
        <span className={displayValue ? "text-gray-900" : "text-gray-400"}>{displayValue || placeholder}</span>
        <span className="float-right text-gray-400">📅</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-[280px] rounded-xl border bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button className="rounded px-2 py-1 hover:bg-gray-100" onClick={() => setViewMonth((m) => (m === 0 ? (setViewYear((y)=>y-1), 11) : m - 1))}>{"<"}</button>
            <div className="font-semibold">{monthLabel}</div>
            <button className="rounded px-2 py-1 hover:bg-gray-100" onClick={() => setViewMonth((m) => (m === 11 ? (setViewYear((y)=>y+1), 0) : m + 1))}>{">"}</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d)=> (<div key={d} className="py-1">{d}</div>))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 text-center">
            {grid.map((d, i) => {
              if (!d) return <div key={i} className="py-2" />;
              const isSel = selected && d.toDateString() === selected.toDateString();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(d)}
                  className={`rounded py-2 text-sm hover:bg-gray-100 ${isSel ? 'bg-blue-600 text-white hover:bg-blue-600' : ''}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

