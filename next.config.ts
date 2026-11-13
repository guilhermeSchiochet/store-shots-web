import type { NextConfig } from "next";

// App 100% no navegador (Canvas, IndexedDB, Web Worker): exporta como site estático.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
