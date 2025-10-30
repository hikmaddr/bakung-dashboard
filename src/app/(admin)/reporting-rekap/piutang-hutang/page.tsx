"use client";

import { useState, useEffect } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Calendar, TrendingUp, TrendingDown, CreditCard, AlertCircle, DollarSign, Clock, Download, RefreshCw, Filter } from "lucide-react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const fmtIDR = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const fmtNumber = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default function PiutangHutangReportPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ outstanding: 0, invoiceOpen: 0, overdueCount: 0, dueSoon: 0, paidThisMonth: 0 });
  const [agingSeries, setAgingSeries] = useState<number[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Array<{ customer: string; total: number; dueDate: string | null; status: string | null; days: number }>>([]);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reporting/piutang`);
        if (!res.ok) throw new Error("Gagal memuat data piutang");
        const data = await res.json();
        setMetrics(data.metrics || { outstanding: 0, invoiceOpen: 0, overdueCount: 0, dueSoon: 0, paidThisMonth: 0 });
        const aging = data.aging || { "0-30": 0, "31-60": 0, "61-90": 0, ">90": 0 };
        setAgingSeries([aging["0-30"], aging["31-60"], aging["61-90"], aging[">90"]]);
        setOpenInvoices((data.openInvoices || []).map((inv: any) => ({ customer: inv.customer, total: Number(inv.total || 0), dueDate: inv.dueDate || null, status: inv.status || null, days: Number(inv.days || 0) })));
      } catch (e: any) {
        setError(e?.message || "Terjadi kesalahan");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [dateRange, refreshNonce]);

  const debtTrendData = {
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    series: [
      {
        name: "Piutang",
        data: [85000000, 92000000, 78000000, 105000000, 112000000, 98000000, 125000000, 118000000, 132000000, 109000000, 145000000, 152000000]
      },
      {
        name: "Hutang",
        data: [65000000, 72000000, 58000000, 85000000, 92000000, 78000000, 105000000, 98000000, 112000000, 89000000, 125000000, 132000000]
      }
    ]
  };

  const agingCategories = ["0-30 Hari", "31-60 Hari", "61-90 Hari", "> 90 Hari"];

  const debtTrendOptions: ApexOptions = {
    chart: {
      type: "area",
      height: 350,
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif"
    },
    colors: ["#3B82F6", "#EF4444"],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100]
      }
    },
    stroke: {
      curve: "smooth",
      width: 2
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4
    },
    xaxis: {
      categories: debtTrendData.categories,
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" }
      }
    },
    yaxis: {
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" },
        formatter: (value) => `Rp ${(value / 1000000).toFixed(0)}M`
      }
    },
    tooltip: {
      y: {
        formatter: (value) => `Rp ${value.toLocaleString("id-ID")}`
      }
    },
    dataLabels: { enabled: false },
    legend: {
      position: "top",
      horizontalAlign: "right"
    }
  };

  const agingOptions: ApexOptions = {
    chart: {
      type: "bar",
      height: 300,
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false }
    },
    colors: ["#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "60%",
        borderRadius: 4
      }
    },
    xaxis: {
      categories: agingCategories,
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" }
      }
    },
    yaxis: {
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" },
        formatter: (value) => `Rp ${(value / 1000000).toFixed(0)}M`
      }
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val}%`
    }
  };

  const handleRefresh = () => {
    setRefreshNonce((n) => n + 1);
  };

  const overdueAmount = openInvoices.filter((i) => i.days > 0).reduce((sum, i) => sum + i.total, 0);
  const dueSoonAmount = openInvoices.filter((i) => i.days <= 0 && i.days >= -7).reduce((sum, i) => sum + i.total, 0);
  const displayMetrics = [
    { title: "Total Piutang", value: fmtIDR(metrics.outstanding || 0), change: 0, icon: <CreditCard className="w-6 h-6" />, color: "bg-blue-500" },
    { title: "Invoice Terbuka", value: fmtNumber(metrics.invoiceOpen || 0), change: 0, icon: <AlertCircle className="w-6 h-6" />, color: "bg-indigo-500" },
    { title: "Piutang Jatuh Tempo", value: fmtIDR(overdueAmount), change: 0, icon: <Clock className="w-6 h-6" />, color: "bg-orange-500" },
    { title: "Jatuh Tempo 7 Hari", value: fmtIDR(dueSoonAmount), change: 0, icon: <DollarSign className="w-6 h-6" />, color: "bg-emerald-500" },
  ];

  const filteredInvoices = openInvoices.filter((item) => {
    const isPiutang = true;
    const isOverdue = item.days > 0;
    if (filterType === "all") return true;
    if (filterType === "piutang") return isPiutang;
    if (filterType === "hutang") return false;
    if (filterType === "overdue") return isOverdue;
    return true;
  });

  return (
    <FeatureGuard feature="reporting.rekap">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 space-y-6">
          <PageBreadcrumb pageTitle="Laporan Piutang & Hutang" />
          
          {/* Header Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Laporan Piutang & Hutang
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Monitoring dan analisis keuangan
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                  <option value="90d">90 Hari Terakhir</option>
                  <option value="1y">1 Tahun Terakhir</option>
                </select>
                
                <button 
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayMetrics.map((metric, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${metric.color} text-white`}>
                    {metric.icon}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    metric.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {metric.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(metric.change)}%
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metric.value}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                    {metric.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Debt Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tren Piutang & Hutang
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  {dateRange === "30d" ? "30 Hari Terakhir" : dateRange === "7d" ? "7 Hari Terakhir" : "90 Hari Terakhir"}
                </div>
              </div>
              <ReactApexChart
                options={debtTrendOptions}
                series={debtTrendData.series}
                type="area"
                height={350}
              />
            </div>

            {/* Aging Analysis */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Analisis Umur Piutang
              </h3>
              <ReactApexChart
                options={agingOptions}
                series={[{ data: agingSeries.length ? agingSeries : [0,0,0,0] }]}
                type="bar"
                height={300}
              />
            </div>
          </div>

          {/* Debt Details Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detail Piutang & Hutang
              </h3>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Semua</option>
                  <option value="piutang">Piutang</option>
                  <option value="hutang">Hutang</option>
                  <option value="overdue">Jatuh Tempo</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Customer/Supplier</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Tipe</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Jumlah</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Jatuh Tempo</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Hari</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((item, index) => {
                    const isOverdue = item.days > 0;
                    const isDueSoon = item.days <= 0 && item.days >= -7;
                    const statusLabel = isOverdue ? 'Terlambat' : isDueSoon ? 'Segera Jatuh Tempo' : 'Normal';
                    const statusClass = isOverdue
                      ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                      : isDueSoon
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300';
                    return (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{item.customer}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={'px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'}>
                            Piutang
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-medium">{fmtIDR(item.total)}</td>
                        <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">{item.dueDate ? new Date(item.dueDate).toLocaleDateString('id-ID') : '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-medium ${
                            item.days > 0 ? 'text-red-600 dark:text-red-400' : 
                            item.days > -7 ? 'text-amber-600 dark:text-amber-400' : 
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {item.days > 0 ? `+${item.days}` : item.days} hari
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {filteredInvoices.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Tidak ada data yang ditemukan
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}
