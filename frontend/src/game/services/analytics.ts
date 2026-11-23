// ANALYTICS + CRASH REPORTING wrappers. API: analytics.track / trace / recent /
// setEnabled; crashReporting.capture. In a native build track forwards to
// Firebase Analytics (logEvent) and capture to Crashlytics (recordError); in
// Expo Go, web and the tsx tests they only buffer / log (no network).
// The SDKs are loaded lazily (services/native.ts); nothing here can throw.
import { BUILD_TYPE, loadCrashlytics, loadFirebaseAnalytics } from "./native";

type Props = Record<string, string | number | boolean | null | undefined>;

// The forwarding sink (Firebase in a native build; a mock in tests).
export interface AnalyticsForwarder {
  logEvent(name: string, params: Record<string, string | number>): void;
  setEnabled(on: boolean): void;
  setUserProperty(name: string, value: string): void;
  logScreenView(name: string): void;
}

function firebaseForwarder(): AnalyticsForwarder | null {
  const m = loadFirebaseAnalytics();
  if (!m?.getAnalytics) return null;
  const a = m.getAnalytics();
  const safe = (f: () => unknown) => {
    try {
      const r = f() as Promise<unknown> | undefined;
      r?.catch?.(() => {});
    } catch {
      // never throw from analytics
    }
  };
  return {
    logEvent: (n, p) => safe(() => m.logEvent(a, n, p)),
    setEnabled: (on) => safe(() => m.setAnalyticsCollectionEnabled(a, on)),
    setUserProperty: (n, v) => safe(() => m.setUserProperty(a, n, v)),
    logScreenView: (name) => safe(() => m.logScreenView(a, { screen_name: name, screen_class: name })),
  };
}

// Firebase limits: ≤ 25 params, string values ≤ 100 chars; booleans → 0/1.
export function cleanParams(props?: Props): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!props) return out;
  let n = 0;
  for (const k of Object.keys(props)) {
    if (n >= 25) break;
    const v = props[k];
    if (v === null || v === undefined) continue;
    out[k] = typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "string" ? v.slice(0, 100) : v;
    n++;
  }
  return out;
}

class Analytics {
  private deepTelemetry = false;
  private enabled = true;
  private buffer: { event: string; props?: Props; t: number }[] = [];
  private forwarder: AnalyticsForwarder | null | undefined = undefined;

  // Tests inject a mock; native builds resolve Firebase on first use.
  setForwarder(f: AnalyticsForwarder | null) {
    this.forwarder = f;
  }
  private fw(): AnalyticsForwarder | null {
    if (this.forwarder === undefined) this.forwarder = firebaseForwarder();
    return this.forwarder;
  }

  // Start-up: collection follows Settings → Usage data; build_type user property.
  init(usageData: boolean) {
    this.enabled = usageData;
    const f = this.fw();
    f?.setEnabled(usageData);
    f?.setUserProperty("build_type", BUILD_TYPE);
  }

  // The Usage data toggle. Turning it off sends usage_data { on: 0 } first.
  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    if (!on) {
      this.track("usage_data", { on: 0 });
      this.enabled = false;
      this.fw()?.setEnabled(false);
    } else {
      this.enabled = true;
      this.fw()?.setEnabled(true);
      this.track("usage_data", { on: 1 });
    }
  }
  isEnabled() {
    return this.enabled;
  }

  setDeepTelemetry(on: boolean) {
    this.deepTelemetry = on;
  }

  track(event: string, props?: Props) {
    if (!this.enabled) return;
    this.buffer.push({ event, props, t: Date.now() });
    if (this.buffer.length > 200) this.buffer.splice(0, this.buffer.length - 200);
    this.fw()?.logEvent(event, cleanParams(props));
    if (__DEV__) console.log("[analytics]", event, props ?? {});
  }

  screen(name: string) {
    if (!this.enabled) return;
    this.fw()?.logScreenView(name);
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

// CRASH REPORTING: Crashlytics in native builds (always on); console in DEV.
class Crash {
  private mod: any = undefined;
  private attrs: Record<string, string> = { build_type: BUILD_TYPE };
  private c() {
    if (this.mod === undefined) {
      const m = loadCrashlytics();
      this.mod = m?.getCrashlytics ? { m, c: m.getCrashlytics() } : null;
      if (this.mod) for (const k of Object.keys(this.attrs)) this.setAttribute(k, this.attrs[k]);
    }
    return this.mod as { m: any; c: any } | null;
  }
  setAttribute(key: "screen" | "mode" | "build_type" | string, value: string) {
    this.attrs[key] = value;
    try {
      const x = this.mod;
      x?.m.setAttribute(x.c, key, value)?.catch?.(() => {});
    } catch {
      // ignore
    }
  }
  capture(err: unknown, context?: Props) {
    if (__DEV__) console.warn("[crash]", err, context ?? {});
    try {
      const x = this.c();
      if (!x) return;
      if (context) x.m.log(x.c, JSON.stringify(cleanParams(context)));
      x.m.recordError(x.c, err instanceof Error ? err : new Error(String(err)));
    } catch {
      // never throw from crash reporting
    }
  }
}
export const crashReporting = new Crash();
