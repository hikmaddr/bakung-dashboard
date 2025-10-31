"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import DatePicker from "@/components/DatePicker";
// Hapus html2canvas & jsPDF; gunakan endpoint server-side untuk PDF
import toast from "react-hot-toast";
import FeatureGuard from "@/components/FeatureGuard";

type Item = { id: number; name: string; qty: number; unit: string };

function SuratJalanAddPageInner() {
  const searchParams = useSearchParams();
  const letterBrand = "Nama Brand / Logo Usaha";
  const letterAddress = "Alamat Perusahaan";
  const letterContact = "No. Telepon / Email";

  const [sjNumber, setSjNumber] = useState<string>("");
  const [sjDate, setSjDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [refInvoice, setRefInvoice] = useState<string>("");

  const [recvDiff, setRecvDiff] = useState<boolean>(false);
  const [recvName, setRecvName] = useState<string>("");
  const [recvAddress, setRecvAddress] = useState<string>("");
  const [recvPhone, setRecvPhone] = useState<string>("");

  const [senderName, setSenderName] = useState<string>("");
  const [expeditionOpt, setExpeditionOpt] = useState<string>("Kurir Sendiri");
  const [shipDate, setShipDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [etaDate, setEtaDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [note, setNote] = useState<string>("Barang sudah dicek sebelum dikirim");

  const [items, setItems] = useState<Item[]>([]);
  const totalQty = useMemo(()=>items.reduce((s,i)=>s+(i.qty||0),0),[items]);

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), name: "", qty: 1, unit: "pcs" }]);
  const updateItem = (id:number, field:keyof Item, val:any) => setItems(prev => prev.map(i => i.id===id?{...i,[field]:val}:i));
  const delItem = (id:number) => setItems(prev => prev.filter(i=>i.id!==id));

  // Derived expedition and default receiver values from invoice/kwitansi
  const expedition = expeditionOpt;
  const [defRecvName, setDefRecvName] = useState<string>("");
  const [defRecvAddress, setDefRecvAddress] = useState<string>("");
  const [defRecvPhone, setDefRecvPhone] = useState<string>("");
  const [defCompany, setDefCompany] = useState<string>("");

  useEffect(() => {
    // Prefill from localStorage context created from Kwitansi/Invoice
    try {
      // Try open from drafted row (sjOpen)
      try {
        const s = localStorage.getItem('sjOpen');
        if (s) {
          const o = JSON.parse(s);
          if (o?.sjNumber) setSjNumber(String(o.sjNumber));
          if (o?.sjDate) setSjDate(String(o.sjDate));
          if (o?.refInvoice) setRefInvoice(String(o.refInvoice));
          if (o?.recvName) setRecvName(String(o.recvName));
          if (o?.recvAddress) setRecvAddress(String(o.recvAddress));
          if (o?.recvPhone) setRecvPhone(String(o.recvPhone));
          setRecvDiff(true);
        }
      } catch {}

      const raw = localStorage.getItem('newReceiptFromInvoice');
      if (!raw) return;
      const obj = JSON.parse(raw || '{}');
      const invoiceId = Number(obj?.invoiceId || 0);
      if (!invoiceId) return;
      setRefInvoice(obj?.invoiceNumber || '');
      (async () => {
        try {
          const res = await fetch(`/api/invoices/${invoiceId}`, { cache: 'no-store' });
          const json = await res.json();
          if (!res.ok || json?.success === false) return;
          const data = json.data || {};
          const pic = data?.customer?.pic || '';
          const company = data?.customer?.company || '';
          const name = `${pic}${company ? ' - ' + company : ''}`.trim();
          const addr = data?.customer?.address || '';
          const phone = (data?.customer?.phone) || '';
          setDefRecvName(name);
          setDefRecvAddress(addr);
          setDefRecvPhone(phone);
          setDefCompany(company);
          const mappedItems = Array.isArray(data?.items) ? data.items.map((it:any) => ({ id: Number(it.id), name: it.name, qty: Number(it.qty || 0), unit: it.unit || 'pcs' })) : [];
          setItems(mappedItems);
        } catch {}
      })();
    } catch {}
  }, []);

  const showRecvName = recvDiff ? recvName : (defRecvName || recvName);
  const showRecvAddress = recvDiff ? recvAddress : (defRecvAddress || recvAddress);
  const showRecvPhone = recvDiff ? recvPhone : (defRecvPhone || recvPhone);
  // Default estimasi tiba = tanggal kirim, dan tetap sync jika user belum mengubah manual
  const [etaTouched, setEtaTouched] = useState(false);
  useEffect(() => {
    if (!etaTouched) setEtaDate(shipDate);
  }, [shipDate]);

  // Generate nomor SJ otomatis sekali saat kosong
  useEffect(() => {
    if (!sjNumber) {
      const d = new Date();
      const pad = (n:number) => n.toString().padStart(2,'0');
      const auto = `SJ/${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      setSjNumber(auto);
    }
  }, [sjNumber]);

  // Actions
  const [sendOpen, setSendOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const savePdf = async () => {
    try {
      const payload = {
        number: sjNumber,
        date: sjDate,
        refInvoice,
        receiverName: showRecvName,
        receiverAddress: showRecvAddress,
        receiverPhone: showRecvPhone,
        items: items.map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
        senderName,
        expedition,
        shipDate,
        etaDate,
        note,
      };
      const res = await fetch('/api/deliveries/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Gagal menghasilkan PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SuratJalan-${sjNumber||'SJ'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF berhasil diunduh');
    } catch (e:any) { toast.error(e?.message || 'Gagal menyimpan PDF'); }
  };
  const saveDraft = () => {
    try {
      const raw = localStorage.getItem('sjDrafts') || '[]';
      let drafts:any[] = [];
      try { drafts = JSON.parse(raw); } catch { drafts = []; }
      drafts = Array.isArray(drafts) ? drafts.filter((d:any)=> d?.sjNumber !== sjNumber) : [];
      drafts.push({ ts: Date.now(), sjNumber, sjDate, refInvoice, recvName: showRecvName, recvAddress: showRecvAddress, recvPhone: showRecvPhone, expedition, shipDate, etaDate, note, items });
      localStorage.setItem('sjDrafts', JSON.stringify(drafts));
      toast.success('Draft Surat Jalan disimpan');
      setTimeout(() => { window.location.href = '/penjualan/surat-jalan'; }, 300);
    } catch { toast.error('Gagal menyimpan draft'); }
  };

  return (
    <div className="sales-scope p-6 min-h-screen">
      <PageBreadcrumb pageTitle="Buat Surat Jalan" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col gap-6">
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={saveDraft} className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm">Simpan Draft</button>
          <button type="button" onClick={()=>setIsPreviewOpen(true)} className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm">Preview</button>
          <div className="relative">
            <button type="button" onClick={()=>setSendOpen(v=>!v)} className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm">Kirim</button>
            {sendOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded border bg-white shadow z-10">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm" onClick={()=>{ const t=encodeURIComponent(`Surat Jalan ${sjNumber} tanggal ${sjDate}.`); window.open(`https://wa.me/?text=${t}`,'_blank'); setSendOpen(false); }}>WhatsApp</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm" onClick={()=>{ setIsPreviewOpen(true); setSendOpen(false); setTimeout(()=>{ savePdf(); }, 300); }}>PDF</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm" onClick={()=>{ const subject=encodeURIComponent(`Surat Jalan ${sjNumber}`); const body=encodeURIComponent(`Surat Jalan ${sjNumber} tanggal ${sjDate}.`); window.location.href=`mailto:?subject=${subject}&body=${body}`; setSendOpen(false); }}>Email</button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border bg-white p-4">
          <div>
            <div className="text-xs text-gray-500">Mitra</div>
            <div className="font-medium">{defCompany || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Tanggal</div>
            <div className="font-medium">{sjDate || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Qty</div>
            <div className="font-semibold text-emerald-600">{totalQty}</div>
          </div>
        </div>
        {/* Form */}
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">No. Surat Jalan</label>
                <input value={sjNumber} readOnly className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal</label>
                <DatePicker value={sjDate} onChange={setSjDate} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">No. Referensi Inv</label>
                <input value={refInvoice} readOnly className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input id="recvDiff" type="checkbox" className="h-4 w-4" checked={recvDiff} onChange={(e)=>setRecvDiff(e.target.checked)} />
              <label htmlFor="recvDiff" className="text-sm">Data penerima berbeda dengan data PIC</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Penerima</label>
                <input value={showRecvName} onChange={(e)=>setRecvName(e.target.value)} className="w-full border rounded px-3 py-2" disabled={!recvDiff} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telepon</label>
                <input value={showRecvPhone} onChange={(e)=>setRecvPhone(e.target.value)} className="w-full border rounded px-3 py-2" disabled={!recvDiff} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alamat Penerima</label>
              <textarea value={showRecvAddress} onChange={(e)=>setRecvAddress(e.target.value)} className="w-full border rounded px-3 py-2 min-h-[60px]" disabled={!recvDiff} />
            </div>
            {/* Detail barang di sisi kiri dihapus sesuai permintaan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Dikirim oleh</label>
                <input value={senderName} onChange={(e)=>setSenderName(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Ekspedisi</label>
                <select value={expeditionOpt} onChange={(e)=>setExpeditionOpt(e.target.value)} className="w-full border rounded px-3 py-2">
                  <option>Kurir Sendiri</option>
                  <option>JNE</option>
                  <option>TIKI</option>
                  <option>J&amp;T</option>
                  <option>SiCepat</option>
                  <option>AnterAja</option>
                  <option>POS Indonesia</option>
                  <option>GoSend</option>
                  <option>GrabExpress</option>
                  <option>Wahana</option>
                  <option>SAP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Kirim</label>
                <DatePicker value={shipDate} onChange={setShipDate} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Estimasi Tiba</label>
                <DatePicker value={etaDate} onChange={(v)=>{ setEtaDate(v); setEtaTouched(true); }} />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium mb-1">Catatan</label>
                <input value={note} onChange={(e)=>setNote(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
          </div>

          {/* Preview dipindahkan ke modal */}
        </div>
      </div>
      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={(e)=>{ if (e.target === e.currentTarget) setIsPreviewOpen(false); }}>
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Preview Surat Jalan</h3>
              <button className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100" onClick={()=>setIsPreviewOpen(false)} aria-label="Close preview">×</button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-5">
              <div id="sj-print" className="border rounded p-4 bg-white">
                <div className="text-center">
                  <div className="text-lg font-semibold">{letterBrand}</div>
                  <div className="text-sm text-gray-600 whitespace-pre-line">{letterAddress}</div>
                  <div className="text-sm text-gray-600">{letterContact}</div>
                </div>
                <hr className="my-4" />
                <div className="text-center text-xl font-bold tracking-wide">SURAT JALAN</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-4">
                  <div>
                    <div>No. Surat Jalan : <span className="font-medium">{sjNumber || '-'}</span></div>
                    <div>Tanggal : <span className="font-medium">{sjDate}</span></div>
                    <div>No. Referensi Inv : <span className="font-medium">{refInvoice || '-'}</span></div>
                  </div>
                  <div>
                    <div className="font-medium">Kepada Yth:</div>
                    <div>Nama Penerima : {showRecvName || '-'}</div>
                    <div>Alamat : <span className="whitespace-pre-line">{showRecvAddress || '-'}</span></div>
                    <div>Telepon : {showRecvPhone || '-'}</div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Nama Barang</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-left">Unit</th></tr></thead>
                    <tbody>
                      {items.length===0 ? (<tr><td colSpan={3} className="text-center text-gray-500 py-4">Tidak ada barang</td></tr>) : items.map(i=> (
                        <tr key={i.id} className="border-t"><td className="px-3 py-2">{i.name}</td><td className="px-3 py-2 text-center">{i.qty}</td><td className="px-3 py-2">{i.unit}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right text-sm text-gray-600 mt-1">Total Qty: {totalQty}</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-4">
                  <div>
                    <div className="font-medium">Informasi Pengirim:</div>
                    <div>Dikirim oleh : {senderName || '-'}</div>
                    <div>Ekspedisi : {expedition || '-'}</div>
                    <div>Tanggal Kirim : {shipDate || '-'}</div>
                    <div>Estimasi Tiba : {etaDate || '-'}</div>
                    <div>Catatan : {note || '-'}</div>
                  </div>
                </div>

                <div className="mt-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-center p-2">Penerima Barang</th>
                        <th className="text-center p-2">Pengirim Barang</th>
                        <th className="text-center p-2">Mengetahui</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border h-24 align-top p-2"></td>
                        <td className="border h-24 align-top p-2"></td>
                        <td className="border h-24 align-top p-2"></td>
                      </tr>
                      <tr>
                        <td className="text-center p-2 text-gray-600">(ttd & nama)</td>
                        <td className="text-center p-2 text-gray-600">(ttd & nama)</td>
                        <td className="text-center p-2 text-gray-600">(ttd & nama)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Auto open preview / download via query */}
      <AutoPreviewTrigger open={isPreviewOpen} setOpen={setIsPreviewOpen} searchParams={searchParams} savePdf={savePdf} />
    </div>
  );
}

export default function SuratJalanAddPage() {
  return (
    <FeatureGuard feature="sales.delivery">
      <Suspense fallback={<div />}> 
        <SuratJalanAddPageInner />
      </Suspense>
    </FeatureGuard>
  );
}

function AutoPreviewTrigger({ open, setOpen, searchParams, savePdf }: { open: boolean; setOpen: (v:boolean)=>void; searchParams: ReturnType<typeof useSearchParams>; savePdf: ()=>void; }){
  useEffect(()=>{
    const p = searchParams?.get('preview');
    const d = searchParams?.get('download');
    if (p === '1' && !open) setOpen(true);
    if (d === '1') {
      setOpen(true);
      setTimeout(()=>{ savePdf(); }, 300);
    }
  }, [searchParams]);
  return null;
}
