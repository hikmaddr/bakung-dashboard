"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState({
    pic: "",
    email: "",
    company: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((res) => res.json())
      .then((data) => setForm(data))
      .catch((err) => console.error("Gagal ambil data client:", err));
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const normalizePhone = (raw: string) => {
    let digits = (raw || "").replace(/\D/g, "");
    if (digits.startsWith("620")) digits = "62" + digits.slice(3);
    if (digits.startsWith("0")) digits = "62" + digits.slice(1);
    if (!digits.startsWith("62")) digits = "62" + digits;
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, phone: normalizePhone(form.phone) };
    const res = await fetch(`/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success("Client berhasil diperbarui!");
      router.push("/client/list");
    } else {
      toast.error("Gagal update client");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Client</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium">PIC</label>
          <input
            name="pic"
            value={form.pic}
            onChange={handleChange}
            className="border w-full px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Email</label>
          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            className="border w-full px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Perusahaan</label>
          <input
            name="company"
            value={form.company}
            onChange={handleChange}
            className="border w-full px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Alamat</label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            className="border w-full px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">No HP</label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="border w-full px-3 py-2 rounded"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Simpan Perubahan
        </button>
      </form>
    </div>
  );
}
