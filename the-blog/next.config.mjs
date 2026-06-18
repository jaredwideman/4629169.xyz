/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  output: "standalone",
  experimental: {
    // Allow API routes to write to disk and call git on the server
    serverActions: { bodySizeLimit: "100mb" },
  },
  // We serve uploaded media from /public/uploads via Next's static handler
};

export default nextConfig;
