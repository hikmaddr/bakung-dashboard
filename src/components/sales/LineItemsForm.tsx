"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export type LineItem = {
  id?: number;
  product: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  imageUrl?: string | null;
};

export default function LineItemsForm({
  items,
  setItems,
}: {
  items: LineItem[];
  setItems: (items: LineItem[]) => void;
}) {
  const handleChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: field === "qty" || field === "price" ? Number(value) : value,
    };
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { product: "", description: "", qty: 1, unit: "", price: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase">
        Item Produk
      </h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Produk</th>
              <th className="px-4 py-2 text-left">Deskripsi</th>
              <th className="px-4 py-2 text-center">Qty</th>
              <th className="px-4 py-2 text-center">Satuan</th>
              <th className="px-4 py-2 text-right">Harga</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
              <th className="px-4 py-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={item.product}
                    onChange={(e) =>
                      handleChange(idx, "product", e.target.value)
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Nama produk"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      handleChange(idx, "description", e.target.value)
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Deskripsi"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => handleChange(idx, "qty", e.target.value)}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-center"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => handleChange(idx, "unit", e.target.value)}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-center"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => handleChange(idx, "price", e.target.value)}
                    className="w-28 rounded border border-gray-300 px-2 py-1 text-sm text-right"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  Rp {(item.qty * item.price).toLocaleString("id-ID")}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-4 text-center text-gray-500 italic"
                >
                  Belum ada item
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={handleAddItem}
        className="mt-3 inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-blue-700"
      >
        <Plus className="mr-1 h-4 w-4" />
        Tambah Item
      </button>
    </div>
  );
}
