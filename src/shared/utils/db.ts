import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type PublicTables = Database['public']['Tables']
export type OrgScopedTable = {
  [K in keyof PublicTables]: 'org_id' extends keyof PublicTables[K]['Row'] ? K : never
}[keyof PublicTables]

export function orgQuery<Table extends OrgScopedTable, Query extends string = '*'>(
  table: Table,
  orgId: string,
  columns?: Query,
) {
  // Generic table names lose row-key mapping inside supabase-js, so `org_id`
  // cannot be proven even though OrgScopedTable requires it.
  return supabase.from(table).select((columns ?? '*') as Query).eq('org_id' as never, orgId)
}
