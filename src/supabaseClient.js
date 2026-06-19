import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cjdcmpwjqolplkkcgoaq.supabase.co'
const supabaseKey = 'sb_publishable_zQ1P_0edq3WC3PxiiolGkQ_chRl90r2'

export const supabase = createClient(supabaseUrl, supabaseKey)
