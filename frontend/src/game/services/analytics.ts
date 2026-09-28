// AnalyticsService — LEAN wrapper. In M3 this is backed by PostHog (preferred)
// or Firebase Analytics for built-in day-1 / day-7 retention. For M1 it is a
// no-op sink with a toggle for temporary deep telemetry (so we can later turn
// on per-issue tracing, e.g. "players cannot lob", without shipping it on).
//
// NEVER embed analytics admin/API secrets in the client. Remote data deletion
// (for "Delete my data") must go through a secure backend endpoint (M3).

type Props = Record<string, string | number | boolean | null | undefined>;

class Analytics {
  private deepTelemetry = false;
  private buffer: { event: string; props?: Props; t: number }[] = [];

  setDeepTelemetry(on: boolean) {
    this.deepTelemetry = on;
  }

  track(event: string, props?: Props) {
    // M1: buffer only (no network). M3: forward to PostHog/Firebase.
    this.buffer.push({ event, props, t: Date.now() });
    if (__DEV__) console.log("[analytics]", event, props ?? {});
  }

  // High-frequency traces (per-swipe, per-ball) are gated behind the toggle.
  trace(event: string, props?: Props) {
    if (!this.deepTelemetry) return;
    this.track("trace_" + event, props);
  }

  recent() {
    return this.buffer.slice(-50);
  }
}

export const analytics = new Analytics();

// CrashReporting — Sentry (or equivalent) in M3. M1 logs to console. The debug
// overlay reads game state directly; it is disabled in production builds.
class Crash {
  capture(err: unknown, context?: Props) {
    if (__DEV__) console.warn("[crash]", err, context ?? {});
  }
}
export const crashReporting = new Crash();
