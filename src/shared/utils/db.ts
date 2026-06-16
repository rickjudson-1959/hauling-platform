import { supabase } from '../lib/supabase'

export function orgQuery(table: string, orgId: string, columns = '*') {
  return supabase.from(table).select(columns).eq('org_id', orgId)
}
