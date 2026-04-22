import type { NextConfig } from "next";

// Phase 3: service-worker source + manifest + icons live in the repo as
// scaffolding, but we do not wrap the config with @serwist/next yet because
// Next 16's Turbopack-first build doesn't accept serwist's webpack plugin
// until @serwist/turbopack lands. Phase 8 re-introduces the wrapper.

const nextConfig: NextConfig = {
  // Empty turbopack block silences the "webpack config with no turbopack
  // config" warning once Phase 8 adds build-time integrations.
  turbopack: {},
};

export default nextConfig;
