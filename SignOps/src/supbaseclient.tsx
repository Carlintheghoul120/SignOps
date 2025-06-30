import { createClient } from "@supabase/supabase-js"

const supabaseURl = "https://lcatsbtvhavmmtjacjqk.supabase.co"
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_KEY as string

export const supabase = createClient(supabaseURl,supabaseAnonKey)