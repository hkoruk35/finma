/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://afk-nexro-production.up.railway.app',
}

module.exports = nextConfig
