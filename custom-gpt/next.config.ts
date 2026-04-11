import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'mammoth'],
  turbopack: {}, // empty object silences the error
};

export default nextConfig;