/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['hugeicons-react'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.GATEWAY_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
      {
        source: '/mcp',
        destination: `${process.env.GATEWAY_API_URL || 'http://localhost:4000'}/mcp`,
      },
    ];
  },
};

module.exports = nextConfig;
