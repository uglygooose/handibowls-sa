"use client";

import { SerwistProvider } from "@serwist/next/react";

// Phase 13 / 13-3 / Batch I — Client-Component shim wrapping
// @serwist/next's SerwistProvider.
//
// Why the shim instead of importing SerwistProvider directly into
// app/layout.tsx (a Server Component):
//   @serwist/next/react ships index.react.js WITHOUT a "use client"
//   directive at the top of the file. Importing it from a Server
//   Component causes Next 16 + Turbopack to bundle the
//   createContext() / useState() / useEffect() calls into the
//   server runtime, which breaks at build time
//   ("createContext is not a function" on /_not-found page-data
//   collection).
//
// The shim:
//   - "use client" directive promotes everything in this module
//     (including the transitive SerwistProvider import) into the
//     client bundle.
//   - Returns SerwistProvider as a sibling-mount element with no
//     children (no useSerwist() consumers downstream — the
//     registration side-effect is the entire fix).
//   - swUrl points at /sw.js served by app/[path]/route.ts
//     (Phase 8d Turbopack-compatible Serwist route handler).
//
// Default props from SerwistProvider apply: register=true,
// cacheOnNavigation=true, reloadOnOnline=true. Closes DRIFT
// sw-registration-missing.

export function SwRegistration() {
  return <SerwistProvider swUrl="/sw.js" />;
}
