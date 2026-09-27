import { createClient } from '@supabase/supabase-js'

// These are your database keys
const supabaseUrl = 'https://yuvactpnkkahdnaengcs.supabase.co'
const supabaseAnonKey = 'sb_publishable_selULx-pzX5sE-JWCpwTjA_6cMvuINW'

// This creates the connection
export const supabase = createClient(supabaseUrl, supabaseAnonKey)