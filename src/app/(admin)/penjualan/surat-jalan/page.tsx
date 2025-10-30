"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, ChevronDown, Eye, Edit, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";
import { toast } from "react-hot-toast";
import FeatureGuard from "@/components/FeatureGuard";

type DeliveryRow = {
  id: number;
  deliveryNumber: string;
  date: string;
  status: string;
  customer?: { pic?: string; company?: string };
  refInvoice?: string;
  recvName?: string;
  recvAddress?: string;
  recvPhone?: string;
  expedition?: string;
  shipDate?: string;
  etaDate?: string;
  note?: string;
  items?: Array<{ id: number; name: string; qty: number; unit: string }>;
  attachment?: string | null;
};

export default function SuratJalanPage() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Load drafts from localStorage as fallback data source
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('sjDrafts') || '[]';
        const drafts = JSON.parse(raw);
        const mapped: DeliveryRow[] = Array.isArray(drafts)
          ? drafts.map((d: any) => ({
              id: Number(d.sjNumber?.replace(/\D/g,'')) || d.ts,
              deliveryNumber: d.sjNumber || `DRAFT-${d.ts}`,
              date: d.sjDate || d.shipDate || (d.ts ? new Date(d.ts).toISOString().slice(0,10) : ''),
              status: d.status || 'Draft',
              customer: d.recvName ? { pic: d.recvName, company: undefined } : undefined,
              refInvoice: d.refInvoice || '',
              recvName: d.recvName || '',
              recvAddress: d.recvAddress || '',
              recvPhone: d.recvPhone || '',
              expedition: d.expedition || '',
              shipDate: d.shipDate || d.sjDate || '',
              etaDate: d.etaDate || '',
              note: d.note || '',
              items: Array.isArray(d.items) ? d.items.map((it:any)=>({ id: Number(it.id)||Date.now(), name: it.name, qty: Number(it.qty||0), unit: it.unit||'pcs' })) : [],
              attachment: d.attachment || null,
            }))
          : [];
        setRows(mapped);
      } catch { setRows([]); }
    };
    load();
    const onFocus = () => load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'sjDrafts') load(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); };
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r => r.deliveryNumber.toLowerCase().includes(q) || (r.customer?.pic||'').toLowerCase().includes(q) || (r.customer?.company||'').toLowerCase().includes(q));
  }, [rows, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  const customerText = (r: DeliveryRow) => {
    const name = r.customer?.pic?.trim() || '';
    const company = r.customer?.company?.trim() || '';
    if (name && company) return `${name} - ${company}`;
    if (name) return name;
    if (company) return company;
    return '-';
  };

  const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString('id-ID') : '-');

  const persistStatus = (deliveryNumber: string, newStatus: string) => {
    try {
      const raw = localStorage.getItem('sjDrafts') || '[]';
      const drafts = JSON.parse(raw);
      const updated = Array.isArray(drafts) ? drafts.map((d:any)=> {
        if ((d.sjNumber||'') === deliveryNumber) return { ...d, status:newStatus };
        return d;
      }) : drafts;
      localStorage.setItem('sjDrafts', JSON.stringify(updated));
    } catch {}
  };

  const openWithRow = (r: DeliveryRow, qs: string = '') => {
    try {
      const payload = {
        sjNumber: r.deliveryNumber,
        sjDate: r.date,
        refInvoice: r.refInvoice || '',
        recvName: r.customer?.pic || '',
        // address/phone not stored on list; add empty defaults
        recvAddress: '',
        recvPhone: '',
      };
      localStorage.setItem('sjOpen', JSON.stringify(payload));
    } catch {}
    const url = `/penjualan/surat-jalan/add${qs ? `?${qs}` : ''}`;
    window.open(url, qs.includes('download=1') ? '_blank' : '_self');
  };

  const deleteRow = (r: DeliveryRow) => {
    if (!confirm('Hapus draft surat jalan ini?')) return;
    try {
      const raw = localStorage.getItem('sjDrafts') || '[]';
      const drafts = JSON.parse(raw);
      const filtered = Array.isArray(drafts) ? drafts.filter((d:any)=> (d.sjNumber||'') !== r.deliveryNumber) : [];
      localStorage.setItem('sjDrafts', JSON.stringify(filtered));
      // update UI
      setRows(prev => prev.filter(x => x.deliveryNumber !== r.deliveryNumber));
    } catch {}
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Dikirim': return 'bg-blue-100 text-blue-700';
      case 'Diterima': return 'bg-green-100 text-green-700';
      case 'Dibatalkan': return 'bg-gray-200 text-gray-700';
      case 'Draft':
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  function ShipStatusDropdown({ row, onRequestProof }: { row: DeliveryRow; onRequestProof: (r: DeliveryRow)=>void }){
    const [open, setOpen] = useState(false);
    const ref = (globalThis as any).React?.useRef?.(null) as any; // placeholder if needed
    // simple outside-click handler
    useEffect(()=>{
      const onDown = (e: MouseEvent | TouchEvent) => {
        const el = document.getElementById(`status-dd-${row.id}`);
        if (el && !el.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', onDown as EventListener);
      document.addEventListener('touchstart', onDown as EventListener);
      return () => { document.removeEventListener('mousedown', onDown as EventListener); document.removeEventListener('touchstart', onDown as EventListener); };
    }, [row?.id]);
    const options = row.status === 'Dikirim' ? ['Diterima'] : ['Draft','Dikirim','Diterima','Dibatalkan'];
    return (
      <div id={`status-dd-${row.id}`} className="relative inline-block">
        <button onClick={()=>setOpen(v=>!v)} className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(row.status)}`}>
          {row.status || 'Draft'}
          <ChevronDown className="h-3 w-3" />
        </button>
        {open && (
          <div className="absolute mt-1 w-36 rounded-lg border bg-white shadow-lg z-50">
            {options.map(opt => (
              <button key={opt} onClick={()=>{ setRows(prev=>prev.map(x=>x.deliveryNumber===row.deliveryNumber?{...x,status:opt}:x)); persistStatus(row.deliveryNumber, opt); if (opt==='Diterima' && !row.attachment) { onRequestProof(row); } setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100">{opt}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<DeliveryRow | null>(null);
  const letterBrand = "Nama Brand / Logo Usaha";
  const letterAddress = "Alamat Perusahaan";
  const letterContact = "No. Telepon / Email";

  // Attachment upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<DeliveryRow | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>("");
  const [attachPreview, setAttachPreview] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Harap unggah file gambar'); return; }
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(String(reader.result||''));
    reader.readAsDataURL(f);
  };

  const saveAttachment = () => {
    if (!uploadTarget || !uploadPreview) { toast.error('Pilih gambar terlebih dahulu'); return; }
    try {
      const raw = localStorage.getItem('sjDrafts') || '[]';
      const drafts = JSON.parse(raw);
      const updated = Array.isArray(drafts) ? drafts.map((d:any)=> {
        if ((d.sjNumber||'') === uploadTarget.deliveryNumber) return { ...d, attachment: uploadPreview };
        return d;
      }) : drafts;
      localStorage.setItem('sjDrafts', JSON.stringify(updated));
      setRows(prev => prev.map(x => x.deliveryNumber===uploadTarget.deliveryNumber ? { ...x, attachment: uploadPreview } : x));
      toast.success('Bukti penerimaan tersimpan');
      setUploadOpen(false); setUploadTarget(null); setUploadPreview("");
    } catch { toast.error('Gagal menyimpan lampiran'); }
  };

  return (
    <FeatureGuard feature="sales.delivery">
    <div className="sales-scope p-6 min-h-screen">
      <PageBreadcrumb pageTitle="Surat Jalan" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 min-h-[70vh] overflow-visible flex flex-col gap-4">
        {/* Toolbar */}
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Cari pelanggan / nomor surat jalan..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="h-11 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden"
          />
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 border rounded-full px-4 py-2 hover:bg-gray-50">
                <Download size={18} />
                <span>Unduh</span>
                <ChevronDown size={16} />
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 bg-white border shadow rounded-md w-48 z-10">
                  <ul className="text-sm">
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Unduh Semua Dokumen</li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => { if (!filtered.length) { toast.error('Tidak ada data untuk diekspor'); return; } downloadCSV(filtered, 'surat-jalan.csv'); setShowDropdown(false); }}>Ekspor data CSV</li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={async () => { if (!filtered.length) { toast.error('Tidak ada data untuk diekspor'); return; } await downloadXLSX(filtered, 'surat-jalan.xlsx', 'SuratJalan'); setShowDropdown(false); }}>Ekspor data XLSX</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table or Empty */}
        <div className="overflow-x-auto overflow-y-visible rounded-lg border bg-white shadow-sm min-h-[50vh] flex-1">
          {paged.length === 0 ? (
            <EmptyState
              title="Belum ada data Surat Jalan"
              description="Buat surat jalan baru atau simpan draft untuk ditampilkan di sini."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">No. Surat Jalan</th>
                  <th className="px-4 py-3 text-left">No. Invoice</th>
                  <th className="px-4 py-3 text-left">Lampiran</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Status Pengiriman</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50 transition">
                    <td className="px-4 py-3">{customerText(r)}</td>
                    <td className="px-4 py-3">{r.deliveryNumber}</td>
                    <td className="px-4 py-3">{r.refInvoice || '-'}</td>
                    <td className="px-4 py-3">
                      {r.attachment ? (
                        <button onClick={()=>{ setAttachPreview(r.attachment!); }} className="text-blue-600 hover:underline">Lihat</button>
                      ) : (
                        r.status === 'Draft' ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <button onClick={()=>{ setUploadTarget(r); setUploadOpen(true); }} className="text-blue-600 hover:underline">Upload</button>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3">
                      {r.status === 'Diterima' ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>{r.status}</span>
                      ) : (
                        <ShipStatusDropdown row={r} onRequestProof={(rr)=>{ setUploadTarget(rr); setUploadOpen(true); }} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button title="Lihat" onClick={()=>{ setPreviewRow(r); setPreviewOpen(true); }} className="p-2 rounded-full hover:bg-gray-100"><Eye className="h-4 w-4 text-gray-600" /></button>
                        {r.status !== 'Dikirim' && r.status !== 'Diterima' && (
                          <>
                            <button title="Edit" onClick={()=>openWithRow(r)} className="p-2 rounded-full hover:bg-gray-100"><Edit className="h-4 w-4 text-gray-600" /></button>
                            <button title="Download PDF" onClick={()=>openWithRow(r,'preview=1&download=1')} className="p-2 rounded-full hover:bg-gray-100"><Download className="h-4 w-4 text-emerald-600" /></button>
                            <button title="Hapus" onClick={()=>deleteRow(r)} className="p-2 rounded-full hover:bg-gray-100"><Trash2 className="h-4 w-4 text-red-600" /></button>
                          </>
                        )}
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
          onLimitChange={(v)=>{ setLimit(v); setPage(1); }}
        />
      </div>
      {/* Preview Modal */}
      {previewOpen && previewRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={(e)=>{ if (e.target === e.currentTarget) { setPreviewOpen(false); setPreviewRow(null); } }}>
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Preview Surat Jalan</h3>
              <button className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100" onClick={()=>{ setPreviewOpen(false); setPreviewRow(null); }} aria-label="Close preview">×</button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-5">
              <div className="border rounded p-4 bg-white">
                <div className="text-center">
                  <div className="text-lg font-semibold">{letterBrand}</div>
                  <div className="text-sm text-gray-600 whitespace-pre-line">{letterAddress}</div>
                  <div className="text-sm text-gray-600">{letterContact}</div>
                </div>
                <hr className="my-4" />
                <div className="text-center text-xl font-bold tracking-wide">SURAT JALAN</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-4">
                  <div>
                    <div>No. Surat Jalan : <span className="font-medium">{previewRow.deliveryNumber}</span></div>
                    <div>Tanggal : <span className="font-medium">{fmtDate(previewRow.date)}</span></div>
                    <div>No. Referensi Inv : <span className="font-medium">{previewRow.refInvoice || '-'}</span></div>
                  </div>
                  <div>
                    <div className="font-medium">Kepada Yth:</div>
                    <div>Nama Penerima : {previewRow.recvName || customerText(previewRow)}</div>
                    <div>Alamat : <span className="whitespace-pre-line">{previewRow.recvAddress || '-'}</span></div>
                    <div>Telepon : {previewRow.recvPhone || '-'}</div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Nama Barang</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-left">Unit</th></tr></thead>
                    <tbody>
                      {(!previewRow.items || previewRow.items.length===0) ? (
                        <tr><td colSpan={3} className="text-center text-gray-500 py-4">Tidak ada barang</td></tr>
                      ) : previewRow.items.map(i=> (
                        <tr key={i.id} className="border-t"><td className="px-3 py-2">{i.name}</td><td className="px-3 py-2 text-center">{i.qty}</td><td className="px-3 py-2">{i.unit}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right text-sm text-gray-600 mt-1">Total Qty: {Array.isArray(previewRow.items)? previewRow.items.reduce((s,i)=>s+(i.qty||0),0):0}</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-4">
                  <div>
                    <div className="font-medium">Informasi Pengirim:</div>
                    <div>Dikirim oleh : {previewRow.customer?.pic || '-'}</div>
                    <div>Ekspedisi : {previewRow.expedition || '-'}</div>
                    <div>Tanggal Kirim : {previewRow.shipDate || '-'}</div>
                    <div>Estimasi Tiba : {previewRow.etaDate || '-'}</div>
                    <div>Catatan : {previewRow.note || '-'}</div>
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
      {/* Upload Proof Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={(e)=>{ if (e.target === e.currentTarget) { setUploadOpen(false); setUploadTarget(null); setUploadPreview(""); } }}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Upload Bukti Penerimaan</h3>
              <button className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100" onClick={()=>{ setUploadOpen(false); setUploadTarget(null); setUploadPreview(""); }} aria-label="Close">×</button>
            </div>
            <div className="p-5 space-y-3">
              <input type="file" accept="image/*" onChange={onFileChange} />
              {uploadPreview && (
                <div className="mt-2"><img src={uploadPreview} alt="Preview" className="max-h-80 rounded border" /></div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm" onClick={()=>{ setUploadOpen(false); setUploadTarget(null); setUploadPreview(""); }}>Batal</button>
                <button className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm" onClick={saveAttachment}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Attachment Preview Modal */}
      {attachPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={(e)=>{ if (e.target === e.currentTarget) setAttachPreview(null); }}>
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Lampiran Penerimaan</h3>
              <button className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100" onClick={()=>setAttachPreview(null)} aria-label="Close">×</button>
            </div>
            <div className="p-5">
              <img src={attachPreview} alt="Lampiran" className="max-h-[75vh] mx-auto rounded border" />
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGuard>
  );
}
