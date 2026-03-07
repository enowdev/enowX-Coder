import type { Suggestion } from '@/types/plan'

interface Props {
  suggestions: Suggestion[]
}

const impactEffortLabel: Record<string, Record<string, string>> = {
  high:   { high: 'Major Projects', low: 'Quick Wins' },
  medium: { high: 'Major Projects', medium: 'Consider', low: 'Quick Wins' },
  low:    { high: 'Thankless Tasks', medium: 'Fill-ins', low: 'Fill-ins' },
}

const quadrants = [
  { impact: 'high',   effort: 'low',  label: 'Quick Wins',      color: '#22c55e', desc: 'High impact, low effort' },
  { impact: 'high',   effort: 'high', label: 'Major Projects',  color: '#3b82f6', desc: 'High impact, high effort' },
  { impact: 'low',    effort: 'low',  label: 'Fill-ins',        color: '#8888aa', desc: 'Low impact, low effort' },
  { impact: 'low',    effort: 'high', label: 'Thankless Tasks', color: '#ef4444', desc: 'Low impact, high effort' },
]

const levelColor: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }

export function Suggestions({ suggestions }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impact / Effort Matrix</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {quadrants.map(q => {
            const items = suggestions.filter(s => s.impact === q.impact && s.effort === q.effort)
            return (
              <div key={q.label} style={{ background: 'var(--surface-elevated)', border: `1px solid ${q.color}33`, borderRadius: '8px', padding: '14px', minHeight: '100px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: q.color }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: q.color }}>{q.label}</span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)' }}>{q.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {items.map(s => (
                    <span key={s.id} style={{ fontSize: '12px', color: 'var(--text)', padding: '3px 8px', background: q.color + '11', borderRadius: '4px', border: `1px solid ${q.color}22` }}>
                      {s.title}
                    </span>
                  ))}
                  {items.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {suggestions.map(s => (
          <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{s.title}</h3>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: levelColor[s.impact] + '22', color: levelColor[s.impact], border: `1px solid ${levelColor[s.impact]}44` }}>
                  {s.impact} impact
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {s.effort} effort
                </span>
              </div>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{s.description}</p>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {s.category}
            </span>
            <span style={{ marginLeft: '6px', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent)22', color: 'var(--accent-light)', border: '1px solid var(--accent)44' }}>
              {impactEffortLabel[s.impact]?.[s.effort] ?? 'Consider'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
