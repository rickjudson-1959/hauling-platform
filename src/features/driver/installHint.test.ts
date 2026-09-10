import { describe, expect, it } from 'vitest'
import {
  detectInstallPlatform,
  installHintCopy,
  isStandaloneDisplay,
  shouldShowInstallHint,
} from './installHint'

describe('install hint', () => {
  it('detects iOS and Android user agents', () => {
    expect(detectInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(detectInstallPlatform('Mozilla/5.0 (Linux; Android 14)')).toBe('android')
    expect(detectInstallPlatform('Mozilla/5.0 (Macintosh)')).toBe('other')
  })

  it('hides the hint when the app is already installed', () => {
    expect(shouldShowInstallHint({ standalone: true, platform: 'ios' })).toBe(false)
    expect(shouldShowInstallHint({ standalone: false, platform: 'android' })).toBe(true)
  })

  it('treats display-mode standalone or iOS navigator.standalone as installed', () => {
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: true }) })).toBe(true)
    expect(isStandaloneDisplay({ navigator: { standalone: true } })).toBe(true)
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: false }) })).toBe(false)
  })

  it('uses platform-specific home screen copy without em dashes', () => {
    const ios = installHintCopy('ios')
    const android = installHintCopy('android')
    expect(ios.body).toMatch(/Safari/)
    expect(android.body).toMatch(/Add to Home Screen/)
    expect(ios.body).not.toMatch(/—/)
    expect(android.body).not.toMatch(/—/)
  })
})
