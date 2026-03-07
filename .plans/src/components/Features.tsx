import { useState } from 'react'
import type { Feature } from '@/types/plan'

interface Props {
  features: Feature[]
}

type StatusFilter = 'all' | 'shipped' | 'in_progress' | 'planned'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  shipped:     { label: 'Shipped',      color: '#22c55e', bg: '#22c55e22' },
  in_progress: { label: 'In Progress',  color: '#3b82f6', bg: '#3b82f622' },
  planned:     { label: 'Planned',      color: '#8888aa', bg: '#8888aa22' },
}

const priorityColor: Record<string, string> = {
  high: '#ef4444', medium: '#f59e0b', low: '#22c55e',
}

export function Features({ features }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('all')

  const filtered = filter === 'all' ? features : features.filter(f => f.status === filter)

  const tabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: `All (${features.length})` },
    { id: 'shipped', label: `Shipped (${features.filter(f => f.status === 'shipped').length})` },
    { id: 'in_progress', label: `In Progress (${features.filter(f => f.status === 'in_progress').length})` },
    { id: 'planned', label: `Planned (${features.filter(f => f.status === 'planned').length})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', width: 'fit-content' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              background: filter === tab.id ? 'var(--accent)' : 'transparent',
              color: filter === tab.id ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {filtered.map(feature => {
          const s = statusConfig[feature.status]
          return (
            <div key={feature.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{feature.name}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: s.bg, color: s.color, border: `1px solid ${s.color}44`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {s.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{feature.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: priorityColor[feature.priority] }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{feature.priority} priority</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', padding: '1px 7px', borderRadius: '4px', background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {feature.category}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
