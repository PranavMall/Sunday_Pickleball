// NATIVE SDK LOADER. Firebase and RevenueCat run only in Pranav's EAS builds.
// In Expo Go, on web and in the headless tsx tests every loader returns null
// and the wrappers become no-ops. Modules are required lazily inside try/catch.

declare const require: (id: string) => any;

let nativeBuild: boolean | null = null;

// A real native build: React Native runtime and not Expo Go ("storeClient").
export function isNativeBuild(): boolean {
  if (nativeBuild !== null) return nativeBuild;
  nativeBuild = false;
  try {
    if (typeof navigator === "undefined" || (navigator as { product?: string }).product !== "ReactNative") return false;
    const Constants = require("expo-constants").default;
    nativeBuild = Constants?.executionEnvironment !== "storeClient";
  } catch {
    nativeBuild = false;
  }
  return nativeBuild;
}

export function platformOS(): string {
  try {
    return require("react-native").Platform.OS;
  } catch {
    return "node";
  }
}

// internal (development / preview builds) or store (production); Expo Go / web: "dev".
// Plain dotted form: Expo inlines process.env.EXPO_PUBLIC_* only when written exactly like this.
export const BUILD_TYPE: string = process.env.EXPO_PUBLIC_BUILD_TYPE || "dev";

function load<T>(get: () => T): T | null {
  if (!isNativeBuild()) return null;
  try {
    return get() ?? null;
  } catch {
    return null;
  }
}

// Static require strings so Metro bundles them; only evaluated in native builds.
export const loadFirebaseAnalytics = () => load(() => require("@react-native-firebase/analytics"));
export const loadCrashlytics = () => load(() => require("@react-native-firebase/crashlytics"));
export const loadPurchases = () => load(() => require("react-native-purchases"));
