import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://vymxicqitddocazvmpbr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_a67bHY2v6IowOXGlQ6jmGQ_HV2h7dMA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);