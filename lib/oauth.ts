import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "./supabase";

/**
 * Google sign-in (v1.2) via Supabase's OAuth flow in a browser session.
 *
 * Why the browser flow instead of the native Google sheet: it needs no
 * native module or Android SHA-1 credentials, so it works identically in
 * Expo Go and dev builds. The dance:
 *
 *  1. Ask Supabase for Google's consent URL (skipBrowserRedirect: we open
 *     it ourselves).
 *  2. Open it in an auth browser session. After consent, Supabase's
 *     /auth/v1/callback redirects to our app's deep link (exp:// in Expo
 *     Go, lumenz:// in builds) with tokens in the URL fragment.
 *  3. Parse the tokens and hand them to setSession — from there the
 *     existing onAuthStateChange listener takes over and the route guard
 *     flips to the app. The phase1 DB trigger creates the profile row,
 *     using Google's `name` from the user metadata.
 *
 * The redirect URI must be allow-listed in Supabase → Auth → URL
 * Configuration, and Google needs a web OAuth client in the dashboard's
 * Google provider settings (see the setup notes in the session/README).
 */

// Completes any pending auth session if the app was reopened mid-flow (web).
WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

export type OAuthResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

export async function signInWithGoogle(): Promise<OAuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { ok: false, error: error.message };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      // User closed the browser sheet — not an error worth showing.
      return { ok: false, cancelled: true };
    }

    const { params, errorCode } = QueryParams.getQueryParams(result.url);
    if (errorCode) return { ok: false, error: errorCode };

    const { access_token, refresh_token } = params;
    if (!access_token || !refresh_token) {
      return { ok: false, error: "Google sign-in returned no session" };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError) return { ok: false, error: sessionError.message };

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Google sign-in failed",
    };
  }
}
