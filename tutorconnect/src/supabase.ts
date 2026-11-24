import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const configuredUrl = url && !/your-project\.supabase\.co/i.test(url) ? url : null;

export const supabase = configuredUrl && anonKey ? createClient(configuredUrl, anonKey) : null;
