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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let email: string, password: string, companyName: string
  try {
    ;({ email, password, companyName } = await req.json())
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (!email || !password || !companyName) {
    return json({ error: 'email, password, and companyName are required' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1. Create the auth user (email auto-confirmed so login works immediately)
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (userError) return json({ error: userError.message }, 400)
  const userId = userData.user.id

  // 2. Create the org
  const { data: orgData, error: orgError } = await admin
    .from('orgs')
    .insert({ name: companyName })
    .select('id')
    .single()
  if (orgError) {
    await admin.auth.admin.deleteUser(userId)
    return json({ error: orgError.message }, 500)
  }

  // 3. Create the membership linking user to org as admin
  const { error: memberError } = await admin
    .from('memberships')
    .insert({ org_id: orgData.id, user_id: userId, role: 'admin' })
  if (memberError) {
    await admin.from('orgs').delete().eq('id', orgData.id)
    await admin.auth.admin.deleteUser(userId)
    return json({ error: memberError.message }, 500)
  }

  return json({ success: true })
})
