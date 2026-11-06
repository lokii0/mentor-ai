// Haptics where the platform allows it.
// Android: Vibration API. iOS Safari (18+) has no Vibration API, but toggling a native
// <input type="checkbox" switch> through its <label> plays the system "selection" tick.
// Fire on the same frame as the visual change (causality + harmony).

type Kind = 'tap' | 'select' | 'success' | 'warning' | 'error'

const PATTERNS: Record<Kind, number | number[]> = {
  tap: 8,
  select: 6,
  success: [10, 40, 14],
  warning: [16, 60, 16],
  error: [24, 50, 24, 50, 24],
}

let label: HTMLLabelElement | null = null

function iosTick() {
  if (!label) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.id = '__haptic'
    input.style.display = 'none'
    label = document.createElement('label')
    label.htmlFor = '__haptic'
    label.style.display = 'none'
    document.body.append(input, label)
  }
  label.click()
}

export function haptic(kind: Kind = 'tap') {
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind])
      return
    }
    if (/iP(hone|ad|od)/.test(navigator.userAgent)) {
      iosTick()
      if (kind === 'success' || kind === 'warning' || kind === 'error') setTimeout(iosTick, 90)
    }
  } catch {
    /* haptics are a nicety */
  }
}
