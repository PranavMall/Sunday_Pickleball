// App-wide MetaStore singleton, loaded once at app start.
import { MetaStore } from "./metaStore";
import { asyncStorageAdapter } from "./storage";

export const meta = new MetaStore(asyncStorageAdapter);
let loading: Promise<void> | null = null;

export function initMeta(): Promise<void> {
  if (!loading) loading = meta.load(Date.now());
  return loading;
}
