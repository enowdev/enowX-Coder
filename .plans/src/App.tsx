import { useState } from 'react'
import {
  House, MapTrifold, SquaresFour, Graph,
  Sparkle, Lightbulb, Blueprint, ClockCounterClockwise,
  ChartBar,
} from '@phosphor-icons/react'
import { usePlan } from '@/hooks/usePlan'
import { Overview } from '@/components/Overview'
import { Roadmap } from '@/components/Roadmap'
import { Kanban } from '@/components/Kanban'
import { ERD } from '@/components/ERD'
import { Features } from '@/components/Features'
import { Suggestions } from '@/components/Suggestions'
import { Architecture } from '@/components/Architecture'
import { SessionLog } from '@/components/SessionLog'

type Section = 'overview' | 'roadmap' | 'kanban' | 'erd' | 'features' | 'suggestions' | 'architecture' | 'session-log'

const navItems: { id: Section; label: string; Icon: React.ElementType }[] = [
  { id: 'overview',     label: 'Overview',     Icon: House },
  { id: 'roadmap',      label: 'Roadmap',      Icon: MapTrifold },
  { id: 'kanban',       label: 'Kanban',       Icon: SquaresFour },
  { id: 'erd',          label: 'ERD',          Icon: Graph },
  { id: 'features',     label: 'Features',     Icon: Sparkle },
  { id: 'suggestions',  label: 'Suggestions',  Icon: Lightbulb },
  { id: 'architecture', label: 'Architecture', Icon: Blueprint },
  { id: 'session-log',  label: 'Session Log',  Icon: ClockCounterClockwise },
]

export default function App() {
  const [active, setActive] = useState<Section>('overview')
  const plan = usePlan()

  const sectionTitles: Record<Section, string> = {
    overview: 'Overview',
    roadmap: 'Roadmap',
    kanban: 'Kanban Board',
    erd: 'Entity Relationship Diagram',
    features: 'Features',
    suggestions: 'Suggestions',
    architecture: 'Architecture',
    'session-log': 'Session Log',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: '220px', flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChartBar size={16} weight="fill" color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>enowX Plans</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{plan.meta.projectName}</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {navItems.map(({ id, label, Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: isActive ? 600 : 400,
                  marginBottom: '2px', textAlign: 'left',
                  transition: 'all 0.12s',
                }}
              >
                <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                {label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Last updated<br />
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>
              {new Date(plan.meta.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
            {sectionTitles[active]}
          </h1>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {active === 'overview'     && <Overview plan={plan} />}
          {active === 'roadmap'      && <Roadmap roadmap={plan.roadmap} />}
          {active === 'kanban'       && <Kanban kanban={plan.kanban} />}
          {active === 'erd'          && <ERD erd={plan.erd} />}
          {active === 'features'     && <Features features={plan.features} />}
          {active === 'suggestions'  && <Suggestions suggestions={plan.suggestions} />}
          {active === 'architecture' && <Architecture architecture={plan.architecture} />}
          {active === 'session-log'  && <SessionLog sessionLog={plan.sessionLog} />}
        </div>
      </main>
    </div>
  )
}
