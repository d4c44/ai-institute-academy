// Liveness probe for the Next.js server (Docker healthcheck). The API has its own /healthz.
export function GET() {
  return Response.json({ status: "ok" });
}
