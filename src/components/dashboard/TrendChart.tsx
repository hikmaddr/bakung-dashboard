"use client";

import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

// Avoid SSR evaluating apexcharts which references window at import time
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type TrendChartProps = {
  categories: string[];
  series: { name: string; data: number[] }[];
  height?: number;
  valueType?: "currency" | "number";
  className?: string;
};

export function TrendChart({
  categories,
  series,
  height = 260,
  valueType = "number",
  className,
}: TrendChartProps) {
  const formatters = useMemo(() => {
    const currency = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
    const numeric = new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0,
    });

    const formatValue = (value: number) => {
      if (!Number.isFinite(value)) return "0";
      return valueType === "currency"
        ? currency.format(value)
        : numeric.format(value);
    };

    return { currency, numeric, formatValue };
  }, [valueType]);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "area",
      toolbar: { show: false },
    },
    stroke: {
      width: 2,
      curve: "smooth",
    },
    dataLabels: {
      enabled: false,
    },
    grid: {
      strokeDashArray: 3,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0.35,
        opacityFrom: 0.6,
        opacityTo: 0.1,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      markers: {
        size: 12,
      },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: "#6B7280",
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (value) =>
          formatters.formatValue(
            typeof value === "number" ? value : Number(value),
          ),
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value) =>
          formatters.formatValue(typeof value === "number" ? value : 0),
      },
    },
    colors: ["#4F46E5", "#0EA5E9", "#F97316", "#22C55E"],
  };

  return (
    <div
      className={`max-w-full overflow-x-auto custom-scrollbar ${
        className ?? ""
      }`}
    >
      <div className="min-w-[640px]">
        <ReactApexChart
          options={options}
          series={series}
          type="area"
          height={height}
        />
      </div>
    </div>
  );
}
