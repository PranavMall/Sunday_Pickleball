// APP START services (after the save loads): analytics collection + build_type,
// Crashlytics attributes + the global JS error handler, the one-time
// crashlytics_check non-fatal (internal builds), RevenueCat. All no-ops outside
// native builds; nothing here throws.
import { analytics, crashReporting } from "./analytics";
import { BUILD_TYPE, isNativeBuild } from "./native";
import { initPurchases } from "./purchases";

declare const require: (id: string) => any;
const CHECK_KEY = "pb.crashlyticsCheck";

let started = false;

export function initServices(usageData: boolean) {
  if (started) return;
  started = true;
  analytics.init(usageData);
  crashReporting.setAttribute("build_type", BUILD_TYPE);
  installGlobalHandler();
  initPurchases();
  if (isNativeBuild() && BUILD_TYPE === "internal") crashlyticsCheckOnce();
}

function installGlobalHandler() {
  try {
    const EU = (globalThis as any).ErrorUtils;
    if (!EU?.setGlobalHandler) return;
    const prev = EU.getGlobalHandler?.();
    EU.setGlobalHandler((err: unknown, isFatal?: boolean) => {
      crashReporting.capture(err, { fatal: !!isFatal });
      prev?.(err, isFatal);
    });
  } catch {
    // ignore
  }
}

// First launch of each install: one non-fatal so the Crashlytics console switches on.
async function crashlyticsCheckOnce() {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    if (await AsyncStorage.getItem(CHECK_KEY)) return;
    crashReporting.capture(new Error("crashlytics_check"), { check: 1 });
    await AsyncStorage.setItem(CHECK_KEY, "1");
  } catch {
    // ignore
  }
}
