@echo off
REM === Navigasi ke folder src\app ===
cd src\app

REM === Dashboard ===
mkdir dashboard
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Dashboard</h1></div>);} > dashboard\page.tsx

REM === Client ===
mkdir client
mkdir client\list
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Client List</h1></div>);} > client\list\page.tsx
mkdir client\tambah
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Tambah Client</h1></div>);} > client\tambah\page.tsx

REM === Sales ===
mkdir sales
for %%F in (quotation orders invoices receipts surat-jalan) do (
    mkdir sales\%%F
    echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Sales %%F</h1></div>);} > sales\%%F\page.tsx
)

REM === Purchase ===
mkdir purchase
for %%F in (orders invoices receipts surat-penerimaan) do (
    mkdir purchase\%%F
    echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Purchase %%F</h1></div>);} > purchase\%%F\page.tsx
)

REM === Products ===
mkdir products
mkdir products\list
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Produk</h1></div>);} > products\list\page.tsx
mkdir products\stock
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Stok & Gudang</h1></div>);} > products\stock\page.tsx

REM === Templates ===
mkdir templates
mkdir templates\manager
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Template Manager</h1></div>);} > templates\manager\page.tsx
mkdir templates\branding
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Brand Settings</h1></div>);} > templates\branding\page.tsx

REM === Reports ===
mkdir reports
for %%F in (sales purchase stock finance) do (
    mkdir reports\%%F
    echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Report %%F</h1></div>);} > reports\%%F\page.tsx
)

REM === System ===
mkdir system
mkdir system\users
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">User Management</h1></div>);} > system\users\page.tsx
mkdir system\roles
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Role & Access</h1></div>);} > system\roles\page.tsx
mkdir system\activity
echo export default function Page() {return (<div className="p-6"><h1 className="text-2xl font-bold">Activity Log / Notifications</h1></div>);} > system\activity\page.tsx

echo.
echo ✅ Semua folder dan skeleton page berhasil dibuat!
pause
