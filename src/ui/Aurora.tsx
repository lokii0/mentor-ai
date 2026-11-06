import './aurora.css'

export type Scene = 'mentor' | 'today' | 'habits' | 'finance' | 'plan' | 'notes' | 'reviews' | 'settings' | 'alert' | 'calm'

export function Aurora({ scene }: { scene: Scene }) {
  return (
    <div className="aurora" data-scene={scene} aria-hidden="true">
      <div className="aurora__pos p4"><div className="aurora__blob aurora__blob--ice" /></div>
      <div className="aurora__pos p1"><div className="aurora__blob aurora__blob--sky" /></div>
      <div className="aurora__pos p2"><div className="aurora__blob aurora__blob--deep" /></div>
      <div className="aurora__pos p3"><div className="aurora__blob aurora__blob--pink" /></div>
      <div className="aurora__grain" />
    </div>
  )
}
