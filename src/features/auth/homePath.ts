/** Where a signed-in user should land after login or invite. */
export function homePath(role: string | null | undefined): string {
  return role === 'driver' ? '/driver' : '/dashboard'
}
