/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  eslint: {
    // Skip ESLint during production builds to prevent build failures due to lint errors
    ignoreDuringBuilds: true,
  },
  turbopack: {},
  webpack(config) {
    // 1) Treat SVG from node_modules (e.g., pdfjs-dist) as files, not React components
    config.module.rules.push({
      test: /\.svg$/i,
      include: /node_modules/,
      type: 'asset/resource',
    });

    // 2) Allow explicit URL imports anywhere via ?url
    config.module.rules.push({
      test: /\.svg$/i,
      resourceQuery: /url/, // *.svg?url
      type: 'asset/resource',
    });

    // 3) Use SVGR only for app source (exclude node_modules)
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      resourceQuery: { not: [/url/] },
      use: ['@svgr/webpack'],
      exclude: /node_modules/,
    });

    return config;
  },
};

export default nextConfig;
