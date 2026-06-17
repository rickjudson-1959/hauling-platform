import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const VALID_ROLES = ['admin', 'dispatcher', 'driver']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

  const url        = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the caller's identity from their JWT
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return json({ error: 'Unauthorized' }, 401)

  // Verify caller is an admin of their org
  const { data: callerMem, error: memError } = await admin
    .from('memberships')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()
  if (memError || !callerMem) return json({ error: 'Membership not found' }, 403)
  if (callerMem.role !== 'admin') return json({ error: 'Only admins can invite members' }, 403)

  let email: string, role: string, redirectTo: string | undefined
  try {
    ;({ email, role, redirectTo } = await req.json())
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (!email || !role) return json({ error: 'email and role are required' }, 400)
  if (!VALID_ROLES.includes(role)) return json({ error: 'Invalid role' }, 400)

  // Look for an existing auth user with this email
  // listUsers returns up to 1000 users — sufficient for this scale
  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = usersPage?.users?.find((u: { email?: string }) => u.email === email)

  let inviteeId: string
  let isNew = false
  let inviteLink: string | undefined

  if (existing) {
    inviteeId = existing.id
  } else {
    // New user — generate an invite link they can use to set their password
    const linkOpts: { type: 'invite'; email: string; options?: { redirectTo: string } } = {
      type: 'invite',
      email,
    }
    if (redirectTo) linkOpts.options = { redirectTo }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink(linkOpts)
    if (linkError) return json({ error: linkError.message }, 500)

    inviteeId = linkData.user.id
    inviteLink = linkData.properties.action_link
    isNew = true
  }

  // Guard against duplicate membership in this org
  const { data: existingMem } = await admin
    .from('memberships')
    .select('id')
    .eq('org_id', callerMem.org_id)
    .eq('user_id', inviteeId)
    .maybeSingle()
  if (existingMem) return json({ error: `${email} is already a member of this org` }, 409)

  // Create the membership
  const { error: insertError } = await admin.from('memberships').insert({
    org_id: callerMem.org_id,
    user_id: inviteeId,
    role,
  })
  if (insertError) return json({ error: insertError.message }, 500)

  return json({ success: true, isNew, inviteLink })
})
