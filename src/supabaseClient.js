import { createClient } from "@supabase/supabase-js";

const defaultSupabaseUrl = "https://didwxihufueqbpfnfdmm.supabase.co";
const defaultSupabasePublishableKey = "sb_publishable_H7yADg-SknzplinsNyr5xA_VFW7a57X";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || defaultSupabasePublishableKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
