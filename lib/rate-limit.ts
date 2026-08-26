// ponytail: simple in-memory rate limiter. Use Redis if scaling to stateless multi-instance serverless clusters.
const tracker = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(ip: string, limit = 10, windowMs = 60 * 1000) {
  const now = Date.now();
  const record = tracker.get(ip);

  if (!record || now > record.resetTime) {
    tracker.set(ip, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count };
}
