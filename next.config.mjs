/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Skip lint during production build to avoid errors from dev-only warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
