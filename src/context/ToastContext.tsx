// File: @/context/ToastContext.tsx (ASUMSI LOKASI GLOBAL)

"use client";
import React from 'react';
import { Toaster } from 'react-hot-toast'; 

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      {/* ✅ HANYA ADA SATU TOASTER DI SINI (GLOBAL) */}
      <Toaster 
          position="top-center" // Atau posisi lain yang Anda inginkan
          toastOptions={{
              duration: 3000, // Notifikasi akan hilang setelah 3 detik
          }}
      /> 
    </>
  );
};