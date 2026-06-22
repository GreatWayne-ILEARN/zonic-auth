// ZonicMe SSO client — drop this into any app and call:
//   adoptSessionFromUrl(supabase)   once on app start (picks up the session on return)
//   loginViaCentral()               to start sign-in (sends user to auth.zonicme.com.ng)
//
// Requires the app's Supabase client to point at the SAME ZonicMe Supabase project
// as auth.zonicme.com. Configure the central URL with VITE_ZONICME_AUTH_URL.
import type { SupabaseClient } from "@supabase/supabase-js";

const CENTRAL =
  (import.meta as any).env?.VITE_ZONICME_AUTH_URL || "http://localhost:5173";

/** Send the user to the central login, asking it to return them to `returnTo`. */
export function loginViaCentral(returnTo: string = window.location.href) {
  const url = new URL(CENTRAL);
  url.searchParams.set("redirect", returnTo);
  window.location.href = url.toString();
}

/**
 * On app load, if the central page returned us with tokens in the URL fragment,
 * adopt the session and clean the URL. Returns true if a session was adopted.
 */
export async function adoptSessionFromUrl(supabase: SupabaseClient): Promise<boolean> {
  if (!window.location.hash) return false;
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const access_token = h.get("zm_at");
  const refresh_token = h.get("zm_rt");
  if (!access_token || !refresh_token) return false;
  try {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    // strip the tokens from the URL so they aren't left in history
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return !error;
  } catch {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return false;
  }
}
