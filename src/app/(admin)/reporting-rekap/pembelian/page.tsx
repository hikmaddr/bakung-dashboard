"use client";

import { useState, useEffect } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Calendar, TrendingUp, TrendingDown, ShoppingBag, Package, Truck, CreditCard, Download, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface PurchaseMetric {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
}

export default function PembelianReportPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(false);
  
  const metrics: PurchaseMetric[] = [
    {
      title: "Total Pembelian",
      value: "Rp 89.750.000",
      change: 7.8,
      icon: <ShoppingBag className="w-6 h-6" />,
      color: "bg-blue-500"
    },
    {
      title: "Jumlah Order",
      value: "567",
      change: 12.3,
      icon: <Package className="w-6 h-6" />,
      color: "bg-emerald-500"
    },
    {
      title: "Supplier Aktif",
      value: "23",
      change: -5.2,
      icon: <Truck className="w-6 h-6" />,
      color: "bg-purple-500"
    },
    {
      title: "Rata-rata Order",
      value: "Rp 158.000",
      change: 3.4,
      icon: <CreditCard className="w-6 h-6" />,
      color: "bg-orange-500"
    }
  ];

  const purchaseTrendData = {
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    series: [
      {
        name: "Pembelian",
        data: [8500000, 9200000, 7800000, 10500000, 11200000, 9800000, 12500000, 11800000, 13200000, 10900000, 14500000, 15200000]
      }
    ]
  };

  const supplierData = {
    categories: ["PT Maju Jaya", "CV Berkah", "UD Sejahtera", "PT Global", "CV Mandiri"],
    series: [28, 22, 18, 16, 16]
  };

  const purchaseTrendOptions: ApexOptions = {
    chart: {
      type: "line",
      height: 350,
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif"
    },
    colors: ["#10B981"],
    stroke: {
      curve: "smooth",
      width: 3
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4
    },
    xaxis: {
      categories: purchaseTrendData.categories,
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
    markers: {
      size: 6,
      colors: ["#10B981"],
      strokeColors: "#fff",
      strokeWidth: 2
    }
  };

  const supplierOptions: ApexOptions = {
    chart: {
      type: "bar",
      height: 300,
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false }
    },
    colors: ["#3B82F6"],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4
      }
    },
    xaxis: {
      categories: supplierData.categories,
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" }
      }
    },
    yaxis: {
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" }
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
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <FeatureGuard feature="reporting.rekap">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 space-y-6">
          <PageBreadcrumb pageTitle="Laporan Pembelian" />
          
          {/* Header Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Laporan Pembelian
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Analisis pembelian dan manajemen supplier
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
            {metrics.map((metric, index) => (
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
            {/* Purchase Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tren Pembelian
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  {dateRange === "30d" ? "30 Hari Terakhir" : dateRange === "7d" ? "7 Hari Terakhir" : "90 Hari Terakhir"}
                </div>
              </div>
              <ReactApexChart
                options={purchaseTrendOptions}
                series={purchaseTrendData.series}
                type="line"
                height={350}
              />
            </div>

            {/* Top Suppliers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Top Supplier
              </h3>
              <ReactApexChart
                options={supplierOptions}
                series={[{ data: supplierData.series }]}
                type="bar"
                height={300}
              />
            </div>
          </div>

          {/* Recent Purchases Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Pembelian Terbaru
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">No. PO</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Supplier</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Tanggal</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Total</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { po: "PO-2024-001", supplier: "PT Maju Jaya", date: "15 Jan 2024", total: "Rp 12.500.000", status: "Completed" },
                    { po: "PO-2024-002", supplier: "CV Berkah", date: "14 Jan 2024", total: "Rp 8.750.000", status: "Processing" },
                    { po: "PO-2024-003", supplier: "UD Sejahtera", date: "13 Jan 2024", total: "Rp 15.200.000", status: "Pending" },
                    { po: "PO-2024-004", supplier: "PT Global", date: "12 Jan 2024", total: "Rp 6.800.000", status: "Completed" },
                    { po: "PO-2024-005", supplier: "CV Mandiri", date: "11 Jan 2024", total: "Rp 9.300.000", status: "Processing" }
                  ].map((purchase, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{purchase.po}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{purchase.supplier}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{purchase.date}</td>
                      <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-medium">{purchase.total}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          purchase.status === 'Completed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' :
                          purchase.status === 'Processing' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300' :
                          'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                        }`}>
                          {purchase.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}