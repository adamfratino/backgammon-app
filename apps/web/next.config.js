/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  // Workspace packages ship raw TypeScript rather than a build output,
  // so Next has to compile them alongside the app.
  transpilePackages: ["@repo/galaxy-scraper"],
};

export default nextConfig;
