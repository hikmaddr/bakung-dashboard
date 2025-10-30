"use client";

import { X } from "lucide-react";
import { useState } from "react";

export default function SendQuotationModal({ isOpen, onClose, quotation }: any) {
  const [method, setMethod] = useState<"whatsapp" | "email" | "sms">("whatsapp");

  if (!isOpen) return null;

  const message = `Hi ${quotation.customer?.pic},

${quotation.customer?.company} telah mengirimkan Quotation berikut:
No: ${quotation.quotationNumber}
Tanggal: ${new Date(quotation.date).toLocaleDateString("id-ID")}
Total: Rp${quotation.items.reduce((a: number, i: any) => a + i.price * i.quantity, 0).toLocaleString("id-ID")}

Untuk info lebih lanjut hubungi kami.
`;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl flex flex-col md:flex-row overflow-hidden animate-in fade-in">
        {/* Left Menu */}
        <div className="md:w-1/3 border-r p-6 space-y-3">
          <h2 className="text-lg font-semibold mb-2">Pilih metode</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="method"
              checked={method === "whatsapp"}
              onChange={() => setMethod("whatsapp")}
            />
            WhatsApp
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="method"
              checked={method === "email"}
              onChange={() => setMethod("email")}
            />
            Email
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="method"
              checked={method === "sms"}
              onChange={() => setMethod("sms")}
            />
            SMS
          </label>
        </div>

        {/* Right Preview */}
        <div className="md:w-2/3 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>

          <h3 className="font-semibold mb-2">Preview Pesan</h3>
          <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px] whitespace-pre-line text-sm">
            {message}
          </div>

          <div className="flex justify-end mt-4 gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              onClick={() => console.log("Kirim via", method)}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Kirim {method === "whatsapp" ? "via WhatsApp" : method === "email" ? "via Email" : "via SMS"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
