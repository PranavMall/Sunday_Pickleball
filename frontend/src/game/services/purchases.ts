// RevenueCat setup only (no paywall, no products, no UI in Release 11).
// Configured once at start-up, native Android builds only.
import { isNativeBuild, loadPurchases, platformOS } from "./native";

export const REVENUECAT_ANDROID_KEY = "goog_DEmqFOojLoheubHfAbgmxIpbyDQ"; // public SDK key
export const REVENUECAT_IOS_KEY = ""; // iOS comes later: skipped while empty

let configured = false;

export function initPurchases(): boolean {
  if (configured) return true;
  try {
    if (!isNativeBuild()) return false;
    const os = platformOS();
    const apiKey = os === "android" ? REVENUECAT_ANDROID_KEY : os === "ios" ? REVENUECAT_IOS_KEY : "";
    if (!apiKey || os !== "android") return false;
    const mod = loadPurchases();
    const Purchases = mod?.default;
    if (!Purchases) return false;
    Purchases.setLogLevel?.(mod.LOG_LEVEL?.WARN ?? "WARN");
    Purchases.configure({ apiKey });
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}
