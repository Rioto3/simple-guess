import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import withPWA from "@ducanh2912/next-pwa";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withPWA({
  ...nextConfig,
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});
