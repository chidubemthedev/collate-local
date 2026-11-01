import "server-only";

export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const forwarded = request.headers.get("x-forwarded-for");

  if (trustProxy && forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return "unknown";
}

export function assertSameOrigin(request: Request): void {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    throw new Error("Missing Origin header");
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== originHeader) {
    throw new Error("Origin mismatch");
  }
}
