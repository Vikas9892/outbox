import { redisConnection } from '../config/redis';
import { env } from '../config/env';

export class RateLimiterService {
  /**
   * Atomic check and increment for hourly limit per sender using a Redis Lua script.
   * Prevents race conditions across multiple worker processes.
   *
   * @param senderId Sender UUID
   * @param hourlyLimit Maximum emails allowed per hour (defaults to MAX_EMAILS_PER_HOUR)
   * @returns { allowed: boolean; nextWindowDate: Date; currentCount: number }
   */
  static async checkAndIncrementHourlyLimit(
    senderId: string,
    hourlyLimit: number = env.MAX_EMAILS_PER_HOUR,
  ): Promise<{ allowed: boolean; nextWindowDate: Date }> {
    const now = new Date();
    // Window key: YYYY-MM-DD-HH
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');
    const windowKey = `${year}-${month}-${day}-${hour}`;

    const redisKey = `ratelimit:sender:${senderId}:hour:${windowKey}`;

    // Calculate start of next hour window
    const nextWindowDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 0, 0),
    );
    const ttlSeconds = Math.max(60, Math.ceil((nextWindowDate.getTime() - now.getTime()) / 1000) + 3600);

    // Redis Lua script: check current count vs limit atomically
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return 0
      end
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[2])
      end
      return 1
    `;

    const result = (await redisConnection.eval(
      luaScript,
      1,
      redisKey,
      hourlyLimit.toString(),
      ttlSeconds.toString(),
    )) as number;

    return {
      allowed: result === 1,
      nextWindowDate,
    };
  }

  /**
   * Atomic per-sender minimum delay check.
   * Returns milliseconds remaining if the sender sent an email too recently.
   */
  static async checkSenderMinDelay(
    senderId: string,
    minDelayMs: number = env.MIN_EMAIL_DELAY_MS,
  ): Promise<{ waitMs: number }> {
    const now = Date.now();
    const redisKey = `ratelimit:sender:${senderId}:last_send`;

    const luaScript = `
      local last = redis.call('GET', KEYS[1])
      if last then
        local diff = tonumber(ARGV[1]) - tonumber(last)
        if diff < tonumber(ARGV[2]) then
          return tonumber(ARGV[2]) - diff
        end
      end
      redis.call('SET', KEYS[1], ARGV[1], 'EX', 120)
      return 0
    `;

    const waitMs = (await redisConnection.eval(
      luaScript,
      1,
      redisKey,
      now.toString(),
      minDelayMs.toString(),
    )) as number;

    return {
      waitMs: Math.max(0, waitMs),
    };
  }
}

export default RateLimiterService;
