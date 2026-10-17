// The GitHub Pages build (STATIC_EXPORT=1, see next.config.ts and scripts/build-static.mjs): no server,
// the API is answered in the browser by src/static. Both values are inlined at build time, so the
// branches that test them disappear from the other build.
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
