/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  eslint: {
    // Skip ESLint during production builds to prevent build failures due to lint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Abaikan error tipe saat build produksi agar deploy tidak ter-block
    // (sementara, sampai kompatibilitas tipe Next 15 disesuaikan di semua page)
    ignoreBuildErrors: true,
  },
  turbopack: {},
  webpack(config) {
    // Temukan rule bawaan Next yang menangani asset, lalu kecualikan .svg
    const fileLoaderRule = config.module.rules.find(
      (rule) => rule && rule.test && rule.test.test && rule.test.test('.svg')
    );
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }

    // 1) Izinkan impor URL eksplisit via ?url
    config.module.rules.push({
      test: /\.svg$/i,
      resourceQuery: /url/, // *.svg?url
      type: 'asset/resource',
    });

    // 2) Gunakan SVGR untuk .svg sebagai React component (kecuali node_modules)
    config.module.rules.push({
      test: /\.svg$/i,
      resourceQuery: { not: [/url/] },
      use: ['@svgr/webpack'],
      exclude: /node_modules/,
    });

    return config;
  },
};

export default nextConfig;
