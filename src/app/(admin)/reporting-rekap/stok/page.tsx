"use client";

import { useState, useEffect } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Calendar, TrendingUp, TrendingDown, Package, AlertTriangle, BarChart3, Archive, Download, RefreshCw, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface StockMetric {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
}

export default function StokReportPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const metrics: StockMetric[] = [
    {
      title: "Total Produk",
      value: "1,247",
      change: 5.2,
      icon: <Package className="w-6 h-6" />,
      color: "bg-blue-500"
    },
    {
      title: "Stok Rendah",
      value: "23",
      change: -12.5,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: "bg-red-500"
    },
    {
      title: "Nilai Stok",
      value: "Rp 2.8M",
      change: 8.7,
      icon: <BarChart3 className="w-6 h-6" />,
      color: "bg-emerald-500"
    },
    {
      title: "Stok Habis",
      value: "7",
      change: -25.0,
      icon: <Archive className="w-6 h-6" />,
      color: "bg-orange-500"
    }
  ];

  const stockMovementData = {
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    series: [
      {
        name: "Masuk",
        data: [450, 520, 380, 650, 720, 580, 850, 680, 920, 750, 1050, 980]
      },
      {
        name: "Keluar",
        data: [380, 460, 320, 580, 640, 520, 780, 620, 840, 680, 950, 880]
      }
    ]
  };

  const categoryData = {
    categories: ["Elektronik", "Fashion", "Makanan", "Kesehatan", "Olahraga"],
    series: [35, 25, 20, 12, 8]
  };

  const stockMovementOptions: ApexOptions = {
    chart: {
      type: "bar",
      height: 350,
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif"
    },
    colors: ["#10B981", "#EF4444"],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 4
      }
    },
    dataLabels: { enabled: false },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"]
    },
    xaxis: {
      categories: stockMovementData.categories,
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" }
      }
    },
    yaxis: {
      labels: {
        style: { colors: "#6B7280", fontSize: "12px" }
      }
    },
    fill: { opacity: 1 },
    tooltip: {
      y: {
        formatter: (val) => `${val} unit`
      }
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4
    },
    legend: {
      position: "top",
      horizontalAlign: "right"
    }
  };

  const categoryOptions: ApexOptions = {
    chart: {
      type: "donut",
      height: 300,
      fontFamily: "Inter, sans-serif"
    },
    colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
    labels: categoryData.categories,
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val.toFixed(1)}%`
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%"
        }
      }
    },
    legend: {
      position: "bottom",
      horizontalAlign: "center"
    },
    tooltip: {
      y: {
        formatter: (val) => `${val}%`
      }
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const lowStockProducts = [
    { name: "iPhone 14 Pro", category: "Elektronik", stock: 5, minStock: 10, status: "Low" },
    { name: "Samsung Galaxy S23", category: "Elektronik", stock: 3, minStock: 8, status: "Critical" },
    { name: "Nike Air Max", category: "Fashion", stock: 7, minStock: 15, status: "Low" },
    { name: "Protein Powder", category: "Kesehatan", stock: 2, minStock: 12, status: "Critical" },
    { name: "Yoga Mat", category: "Olahraga", stock: 4, minStock: 10, status: "Low" }
  ];

  const filteredProducts = lowStockProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FeatureGuard feature="reporting.rekap">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 space-y-6">
          <PageBreadcrumb pageTitle="Laporan Stok" />
          
          {/* Header Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Laporan Stok
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Monitoring dan analisis inventory
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
            {/* Stock Movement Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pergerakan Stok
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  {dateRange === "30d" ? "30 Hari Terakhir" : dateRange === "7d" ? "7 Hari Terakhir" : "90 Hari Terakhir"}
                </div>
              </div>
              <ReactApexChart
                options={stockMovementOptions}
                series={stockMovementData.series}
                type="bar"
                height={350}
              />
            </div>

            {/* Category Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Distribusi Kategori
              </h3>
              <ReactApexChart
                options={categoryOptions}
                series={categoryData.series}
                type="donut"
                height={300}
              />
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Peringatan Stok Rendah
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Produk</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Kategori</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Stok Saat Ini</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Min. Stok</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{product.name}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{product.category}</td>
                      <td className="py-3 px-4 text-center text-gray-900 dark:text-white font-medium">{product.stock}</td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">{product.minStock}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === 'Critical' ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300' :
                          'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                        }`}>
                          {product.status === 'Critical' ? 'Kritis' : 'Rendah'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Tidak ada produk yang ditemukan
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}