/** Keeps `next` redirects on-site: a local path made of safe characters, nothing else. */
export function safeNextPath(next: string | string[] | null | undefined): string | undefined {
  const value = Array.isArray(next) ? next[0] : (next ?? undefined);
  return value && /^\/[A-Za-z0-9\-_/]*$/.test(value) && !value.startsWith("//") ? value : undefined;
}
