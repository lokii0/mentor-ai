// Dev-only QA mode (localStorage 'mentor.qa' = '1'): background tabs pause
// requestAnimationFrame, which freezes Motion mid-entrance and makes screenshots lie.
// Must be imported before anything that loads Motion — its frame loop captures rAF at init.
export const QA = import.meta.env.DEV && typeof localStorage !== 'undefined' && localStorage.getItem('mentor.qa') === '1'

if (QA) {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 0)) as typeof requestAnimationFrame
  window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof cancelAnimationFrame
}
