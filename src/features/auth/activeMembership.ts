export const INACTIVE_MEMBERSHIP_MESSAGE =
  'Your account is not active on a team. Ask your office admin to reactivate you or invite you again.'

export const MEMBERSHIP_LOAD_ERROR_FALLBACK =
  'Could not load your team membership. Try again, or ask your office if this keeps happening.'

export type ActiveMembership = {
  role: string
  orgId: string
  orgName: string
}

export type ActiveMembershipResult =
  | { status: 'active'; membership: ActiveMembership }
  | { status: 'inactive' }
  | { status: 'error'; message: string }

type RpcError = { message?: string; code?: string } | null

type RpcResponse = { data: unknown; error: RpcError }

export interface MembershipClient {
  rpc: (fn: string) => Promise<RpcResponse>
  from?: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        maybeSingle: () => Promise<{ data: { name?: string } | null; error: RpcError }>
      }
    }
  }
}

function rpcErrorMessage(error: RpcError, fallback: string): string {
  const raw = (error?.message ?? fallback).split('\n')[0] ?? fallback
  return raw.replace(/^ERROR:\s*/i, '')
}

function isMissingRpc(error: RpcError): boolean {
  const code = error?.code ?? ''
  const message = error?.message ?? ''
  return code === 'PGRST202' || /could not find the function/i.test(message)
}

function firstMembershipRow(data: unknown): { role?: string; org_id?: string; org_name?: string } | null {
  if (Array.isArray(data)) {
    const row = data[0]
    return row && typeof row === 'object' ? row as { role?: string; org_id?: string; org_name?: string } : null
  }
  if (data && typeof data === 'object') {
    return data as { role?: string; org_id?: string; org_name?: string }
  }
  return null
}

function parseDedicated(data: unknown): ActiveMembershipResult {
  const row = firstMembershipRow(data)
  if (!row?.role || !row.org_id) return { status: 'inactive' }
  return {
    status: 'active',
    membership: {
      role: row.role,
      orgId: row.org_id,
      orgName: row.org_name ?? '',
    },
  }
}

async function fetchViaExistingHelpers(client: MembershipClient): Promise<ActiveMembershipResult> {
  const [roleResult, orgResult] = await Promise.all([
    client.rpc('my_role'),
    client.rpc('my_org_id'),
  ])

  if (roleResult.error) {
    return { status: 'error', message: formatMembershipLoadError(roleResult.error) }
  }
  if (orgResult.error) {
    return { status: 'error', message: formatMembershipLoadError(orgResult.error) }
  }

  const role = typeof roleResult.data === 'string' ? roleResult.data : null
  const orgId = typeof orgResult.data === 'string' ? orgResult.data : null
  if (!role || !orgId) return { status: 'inactive' }

  let orgName = ''
  if (client.from) {
    const { data } = await client.from('orgs').select('name').eq('id', orgId).maybeSingle()
    orgName = data?.name ?? ''
  }

  return {
    status: 'active',
    membership: { role, orgId, orgName },
  }
}

export function formatMembershipLoadError(error: RpcError): string {
  const detail = rpcErrorMessage(error, MEMBERSHIP_LOAD_ERROR_FALLBACK)
  if (!detail || detail === MEMBERSHIP_LOAD_ERROR_FALLBACK) return MEMBERSHIP_LOAD_ERROR_FALLBACK
  return `${MEMBERSHIP_LOAD_ERROR_FALLBACK} (${detail})`
}

export async function fetchActiveMembership(client: MembershipClient): Promise<ActiveMembershipResult> {
  const dedicated = await client.rpc('my_active_membership')
  if (!dedicated.error) return parseDedicated(dedicated.data)
  if (isMissingRpc(dedicated.error)) return fetchViaExistingHelpers(client)
  return { status: 'error', message: formatMembershipLoadError(dedicated.error) }
}
