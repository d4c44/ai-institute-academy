import { DEMO, demoFetch } from "@/demo/server";

// Demo mode only: the site answers its own /api/v1/* from memory. Without DEMO_MODE the
// beforeFiles rewrite in next.config.ts forwards these URLs to the Go API before this route runs.
async function handle(request: Request) {
  if (!DEMO) return Response.json({ error: "not_found" }, { status: 404 });
  const url = new URL(request.url);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return demoFetch(url.pathname + url.search, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.text() : null,
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
