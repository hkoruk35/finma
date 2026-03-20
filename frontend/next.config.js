/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app',
}

module.exports = nextConfig
