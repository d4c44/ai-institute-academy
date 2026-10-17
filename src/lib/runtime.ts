import "server-only";
import { connection } from "next/server";
import { STATIC } from "@/lib/static";

/**
 * Marks the code after it as request-time work, so `next build` does not run it. The static build has
 * no requests: everything is rendered at build time, from the bundled course content.
 */
export async function atRequestTime() {
  if (!STATIC) await connection();
}
