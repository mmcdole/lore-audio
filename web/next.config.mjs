const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  async rewrites() {
    try {
      const url = new URL(API_BASE_URL);
      return [
        {
          source: "/api/:path*",
          destination: `${url.origin}/api/:path*`
        }
      ];
    } catch (error) {
      console.warn("Invalid NEXT_PUBLIC_API_BASE_URL", error);
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8080/api/:path*"
        }
      ];
    }
  }
};

export default nextConfig;
