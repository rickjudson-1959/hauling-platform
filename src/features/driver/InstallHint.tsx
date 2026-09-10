import { useEffect, useState } from 'react'
import {
  detectInstallPlatform,
  installHintCopy,
  isStandaloneDisplay,
  shouldShowInstallHint,
} from './installHint'

const DISMISS_KEY = 'driver-install-hint-dismissed'

export default function InstallHint() {
  const [visible, setVisible] = useState(false)
  const [copy, setCopy] = useState(installHintCopy('other'))

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return

    const platform = detectInstallPlatform(window.navigator.userAgent)
    const standalone = isStandaloneDisplay(window)
    if (!shouldShowInstallHint({ standalone, platform })) return

    setCopy(installHintCopy(platform))
    setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-base font-semibold text-blue-900">{copy.title}</p>
        <p className="text-sm text-blue-800 mt-1 leading-snug">{copy.body}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1')
          setVisible(false)
        }}
        className="w-full min-h-12 py-3 rounded-xl bg-white border border-blue-200 text-base font-semibold text-blue-800 active:bg-blue-100"
      >
        Dismiss
      </button>
    </div>
  )
}
