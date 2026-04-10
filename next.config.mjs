/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output bundles only the files needed to run the app.
  // The Docker runner stage copies .next/standalone/ + .next/static/ + public/.
  output: "standalone",
};

export default nextConfig;
