import { createClient, SupabaseClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const hasBackend = Boolean(url && key);
export const supabase: SupabaseClient | null = hasBackend ? createClient(url!, key!) : null;

// Apps allowed to receive a session — blocks open-redirect attacks.
const allowed = (import.meta.env.VITE_ALLOWED_REDIRECTS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
export function isAllowedRedirect(target: string): boolean {
  try {
    const o = new URL(target).origin;
    if (o === window.location.origin) return true;            // self is fine
    return allowed.some((a) => { try { return new URL(a).origin === o; } catch { return false; } });
  } catch { return false; }
}
