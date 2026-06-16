import { supabase } from '../lib/supabase'

export function orgQuery(table: string, orgId: string) {
  return supabase.from(table).eq('org_id', orgId)
}
