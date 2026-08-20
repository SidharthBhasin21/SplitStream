import AsyncStorage from "@react-native-async-storage/async-storage";
import * as aesjs from "aes-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Encrypted session storage for Supabase auth (security audit #13).
 *
 * Plain AsyncStorage is unencrypted on Android — a rooted device could read
 * the refresh token and impersonate the user. The obvious fix (put the
 * session straight into expo-secure-store) doesn't work: SecureStore values
 * are capped at 2048 bytes and OAuth sessions exceed that. So this is the
 * Supabase-recommended split (their "Use Expo SecureStore" guide):
 *
 *   - a fresh random AES-256 key lives in SecureStore (small, hardware-backed)
 *   - the session itself lives in AsyncStorage, AES-CTR-encrypted with it
 *
 * Stealing AsyncStorage alone now yields ciphertext; the key never leaves
 * the device keystore. A fixed CTR counter is safe here because every
 * setItem generates a brand-new key — no key/counter pair is ever reused.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    );
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey),
    );
    return aesjs.utils.hex.fromBytes(encrypted);
  }

  private decrypt(keyHex: string, value: string): string {
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(keyHex),
      new aesjs.Counter(1),
    );
    return aesjs.utils.utf8.fromBytes(
      cipher.decrypt(aesjs.utils.hex.toBytes(value)),
    );
  }

  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    let keyHex: string | null = null;
    try {
      keyHex = await SecureStore.getItemAsync(key);
    } catch {
      keyHex = null; // treated as "unencrypted" below
    }

    if (!keyHex) {
      // No key for this value means one of two things, and both are handled
      // the same way: either a PLAINTEXT session persisted before v1.5, or
      // SecureStore is unavailable so setItem already fell back to
      // plaintext. Adopt the value (re-encrypting if we now can) rather than
      // dropping it, so nobody gets logged out.
      try {
        await this.setItem(key, stored);
      } catch {
        // Keep the value as-is; returning it still restores the session.
      }
      return stored;
    }

    try {
      return this.decrypt(keyHex, stored);
    } catch {
      // Corrupt or mismatched ciphertext — treat as no session rather than
      // handing supabase-js garbage. Worst case the user logs in again.
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const encrypted = await this.encrypt(key, value);
      await AsyncStorage.setItem(key, encrypted);
    } catch {
      // SecureStore/Crypto unavailable — a runtime missing those native
      // modules, or an Android device with a damaged keystore. Degrade to
      // the pre-v1.5 behaviour (plain AsyncStorage) instead of taking the
      // whole app down at boot: an auth-storage adapter must never be able
      // to prevent the app from starting.
      console.warn(
        "[auth] Secure storage unavailable — persisting session unencrypted.",
      );
      await SecureStore.deleteItemAsync(key).catch(() => {});
      await AsyncStorage.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
}

export const secureSessionStorage = new LargeSecureStore();
