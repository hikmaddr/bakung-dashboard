"use client";

import { useState, useEffect, useMemo } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Calendar, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, FileText, Download, Filter, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

// Dynamically import charts
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface ChartData {
  categories: string[];
  series: { name: string; data: number[] }[];
}

export default function PenjualanReportPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ totalSales: 0, orderCount: 0, activeCustomers: 0, avgOrder: 0 });
  const [salesTrendData, setSalesTrendData] = useState<ChartData>({ categories: [], series: [{ name: "Penjualan", data: [] }] });
  const [topProducts, setTopProducts] = useState<Array<{ name: string; category?: string | null; quantity: number; total: number }>>([]);
  const [categoryData, setCategoryData] = useState<{ categories: string[]; series: number[] }>({ categories: [], series: [] });

  const fmtIDR = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
  const fmtNumber = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const param = dateRange === "1y" ? "ytd" : dateRange;
        const res = await fetch(`/api/reporting/penjualan?range=${param}`);
        if (!res.ok) throw new Error("Gagal memuat data penjualan");
        const data = await res.json();
        setMetrics(data.metrics || { totalSales: 0, orderCount: 0, activeCustomers: 0, avgOrder: 0 });
        const categories = (data.trend || []).map((t: any) => t.month);
        const seriesData = (data.trend || []).map((t: any) => Number(t.total || 0));
        setSalesTrendData({ categories, series: [{ name: "Penjualan", data: seriesData }] });
        const products = (data.topProducts || []).map((p: any) => ({ name: p.name, category: p.category, quantity: Number(p.quantity || 0), total: Number(p.total || 0) }));
        setTopProducts(products);
        // Build category donut from top products
        const catMap: Record<string, number> = {};
        products.forEach((p) => {
          const key = p.category || "Lainnya";
          catMap[key] = (catMap[key] || 0) + p.total;
        });
        const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
        setCategoryData({ categories: catEntries.map(([k]) => k), series: catEntries.map(([, v]) => v) });
      } catch (e: any) {
        setError(e?.message || "Terjadi kesalahan");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [dateRange]);

  const salesTrendOptions: ApexOptions = {
    chart: {
      type: "area",
      height: 350,
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif"
    },
    colors: ["#3B82F6"],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 100]
      }
    },
    stroke: {
      curve: "smooth",
      width: 3
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4
    },
    xaxis: {
      categories: salesTrendData.categories,
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
    dataLabels: { enabled: false }
  };

  const categoryOptions: ApexOptions = {
    chart: {
      type: "donut",
      height: 300,
      fontFamily: "Inter, sans-serif"
    },
    colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
    labels: categoryData.categories,
    legend: {
      position: "bottom",
      fontSize: "14px"
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              fontSize: "16px",
              fontWeight: 600
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val.toFixed(1)}%`
    }
  };

  const handleRefresh = () => {
    // re-trigger effect by toggling dateRange to same value
    setDateRange((prev) => prev);
  };

  return (
    <FeatureGuard feature="reporting.rekap">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 space-y-6">
          <PageBreadcrumb pageTitle="Laporan Penjualan" />
          
          {/* Header Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Laporan Penjualan
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Analisis performa penjualan dan tren bisnis Anda
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-emerald-500 text-white">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{fmtIDR(metrics.totalSales)}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Total Penjualan</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-blue-500 text-white">
                  <ShoppingCart className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{fmtNumber(metrics.orderCount)}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Jumlah Transaksi</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-purple-500 text-white">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{fmtNumber(metrics.activeCustomers)}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Pelanggan Aktif</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-orange-500 text-white">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{fmtIDR(metrics.avgOrder)}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Rata-rata Order</p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tren Penjualan
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  {dateRange === "30d" ? "30 Hari Terakhir" : dateRange === "7d" ? "7 Hari Terakhir" : dateRange === "90d" ? "90 Hari Terakhir" : "Tahun Berjalan"}
                </div>
              </div>
              <ReactApexChart
                options={salesTrendOptions}
                series={salesTrendData.series}
                type="area"
                height={350}
              />
            </div>

            {/* Category Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Distribusi Kategori Produk
              </h3>
              {categoryData.series.length ? (
                <ReactApexChart options={categoryOptions} series={categoryData.series} type="donut" height={300} />
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Data kategori belum tersedia.</p>
              )}
            </div>
          </div>

          {/* Top Products Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Produk Terlaris
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Produk</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Kategori</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Terjual</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Revenue</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length ? (
                    topProducts.map((p, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{p.name}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{p.category || '-'}</td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white">{fmtNumber(p.quantity)}</td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-medium">{fmtIDR(p.total)}</td>
                        <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">—</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}
