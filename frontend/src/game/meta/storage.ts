// AsyncStorage adapter for the MetaStore (kept separate so the store itself
// stays pure and testable in Node with an in-memory adapter).
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { StorageAdapter } from "./metaStore";

export const asyncStorageAdapter: StorageAdapter = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
};
