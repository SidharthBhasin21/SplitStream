import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "zustand/middleware";

/**
 * AsyncStorage for zustand `persist`, with a one-time read-through migration
 * from a previous key name.
 *
 * The app's storage keys were renamed when SplitStream became Lumenz (v1.6).
 * zustand's own `migrate` only handles version bumps *within* one key, so
 * without this the rename would silently reset every existing user's saved
 * theme and home currency to defaults. On the first read we adopt the legacy
 * value under the new key and delete the old one; every read after that is a
 * plain AsyncStorage hit.
 */
export function persistedStorage(legacyName: string) {
  return createJSONStorage(() => ({
    getItem: async (name: string) => {
      const current = await AsyncStorage.getItem(name);
      if (current !== null) return current;

      const legacy = await AsyncStorage.getItem(legacyName);
      if (legacy === null) return null;

      await AsyncStorage.setItem(name, legacy);
      await AsyncStorage.removeItem(legacyName);
      return legacy;
    },
    setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
    removeItem: (name: string) => AsyncStorage.removeItem(name),
  }));
}
