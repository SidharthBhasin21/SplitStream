import { useMutation } from "@tanstack/react-query";

import { supabase } from "./supabase";

/**
 * Permanent account deletion (v1.7) — required by Google Play for any app
 * with account creation.
 *
 * The server does the real work in the delete_account RPC (supabase/
 * phase14.sql): it destroys the login identity and scrubs the display name,
 * while deliberately KEEPING the person's expenses and settlements so the
 * groups they were part of keep balancing correctly. See the migration's
 * header for the full reasoning.
 */
export function useDeleteAccount() {
  return useMutation({
    // Fail fast when offline rather than pausing: the UI awaits this to
    // navigate away, and a half-applied deletion must never look like it
    // succeeded.
    networkMode: "always",
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;

      // Local-only sign-out: the auth user no longer exists, so a normal
      // server-side revoke would fail against a deleted account. This just
      // clears the persisted session, which is all that's left to clean up.
      await supabase.auth.signOut({ scope: "local" });
    },
  });
}
