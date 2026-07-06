/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Pastikan font & gambar public ikut ter-trace ke serverless function
  // (dipakai pdfCommon.ts via fs.readFile — tanpa ini PDF gagal di Vercel)
  outputFileTracingIncludes: {
    "/api/**": ["./public/fonts/**", "./public/images/**"],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: 'https', hostname: 'blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'pzvwweq0cd5gjc1s.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'public.blob.vercel-storage.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async headers() {
    return [
      { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/uploads/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find(
      (rule) => rule && rule.test && rule.test.test && rule.test.test('.svg')
    );
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }
    config.module.rules.push({
      test: /\.svg$/i,
      resourceQuery: /url/,
      type: 'asset/resource',
    });
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
