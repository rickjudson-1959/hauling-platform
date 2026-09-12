export const OPEN_JOB_STATUSES = ['scheduled', 'assigned', 'en_route', 'on_site'] as const

export interface TeamMember {
  membership_id: string
  user_id: string
  role: string
  email: string
  active: boolean
}

export function normalizeActive(active: boolean | null | undefined): boolean {
  return active !== false
}

export function isActiveMember(member: Pick<TeamMember, 'active'>): boolean {
  return normalizeActive(member.active)
}

/** True when this member is an active admin and no other active admin exists. */
export function isLastActiveAdmin(
  member: Pick<TeamMember, 'membership_id' | 'role' | 'active'>,
  members: Array<Pick<TeamMember, 'membership_id' | 'role' | 'active'>>,
): boolean {
  if (member.role !== 'admin' || !isActiveMember(member)) return false
  return !members.some(other =>
    other.membership_id !== member.membership_id
    && other.role === 'admin'
    && isActiveMember(other),
  )
}

export function canDeactivateOrRemove(
  member: Pick<TeamMember, 'membership_id' | 'role' | 'active'>,
  members: Array<Pick<TeamMember, 'membership_id' | 'role' | 'active'>>,
): boolean {
  return !isLastActiveAdmin(member, members)
}

export const LAST_ADMIN_MESSAGE =
  'You need another admin before you can deactivate or remove this person.'

export const REMOVE_CONFIRM_COPY =
  'This removes them from the team. Open jobs assigned to them will be unassigned. Their login account stays so you can invite them again later.'
