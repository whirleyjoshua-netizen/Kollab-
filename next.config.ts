import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js dev server (HMR WebSocket) requests originating from
  // common dev-tunnel hosts so phone testing through cloudflared/ngrok works.
  // Production builds are unaffected.
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.vercel.app',
  ],
};

export default nextConfig;
