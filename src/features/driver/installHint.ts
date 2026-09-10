export type InstallPlatform = 'ios' | 'android' | 'other'

export interface InstallHintState {
  standalone: boolean
  platform: InstallPlatform
}

export function detectInstallPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'other'
}

export function isStandaloneDisplay(win: {
  matchMedia?: (query: string) => { matches: boolean }
  navigator?: { standalone?: boolean } | Navigator
}): boolean {
  const media = win.matchMedia?.('(display-mode: standalone)')
  if (media?.matches) return true
  return Boolean((win.navigator as { standalone?: boolean } | undefined)?.standalone)
}

export function shouldShowInstallHint(state: InstallHintState): boolean {
  return !state.standalone
}

export function installHintCopy(platform: InstallPlatform): { title: string; body: string } {
  if (platform === 'ios') {
    return {
      title: 'Add to Home Screen',
      body: 'In Safari, tap Share, then Add to Home Screen. The app opens on My Jobs next time.',
    }
  }
  if (platform === 'android') {
    return {
      title: 'Add to Home Screen',
      body: 'Open the browser menu and tap Add to Home Screen or Install app. The app opens on My Jobs next time.',
    }
  }
  return {
    title: 'Add to Home Screen',
    body: 'Use your browser menu to install or add this site to your home screen. The app opens on My Jobs next time.',
  }
}
