/** @type {import('next').NextConfig} */
const nextConfig = {
  // The classifier reads the studio's rule files at runtime; ship them with the API routes.
  outputFileTracingIncludes: {
    "/api/**": ["./knowledge/**"],
  },
};

export default nextConfig;
