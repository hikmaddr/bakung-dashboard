export default function WaitingApproval() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h1 className="text-2xl font-semibold">Menunggu Persetujuan Admin</h1>
      <p className="mt-2 text-gray-500">
        Akunmu belum diaktifkan. Harap tunggu konfirmasi dari admin.
      </p>
    </div>
  );
}

