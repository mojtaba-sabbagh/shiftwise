import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./lib/cp_sat.py"] },
};
export default nextConfig;
