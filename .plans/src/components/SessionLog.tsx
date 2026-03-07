import { format } from 'date-fns'
import type { SessionLogEntry } from '@/types/plan'

interface Props {
  sessionLog: SessionLogEntry[]
}

const agentColor: Record<string, { color: string; bg: string }> = {
  brainstorming:  { color: '#a78bfa', bg: '#7c3aed22' },
  mnemosyne:      { color: '#3b82f6', bg: '#3b82f622' },
  'skill-creator':{ color: '#22c55e', bg: '#22c55e22' },
  'git-master':   { color: '#f59e0b', bg: '#f59e0b22' },
}

function agentStyle(agent: string) {
  return agentColor[agent] ?? { color: '#8888aa', bg: '#8888aa22' }
}

export function SessionLog({ sessionLog }: Props) {
  const sorted = [...sessionLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {sorted.map((entry, idx) => {
        const s = agentStyle(entry.agent)
        const date = new Date(entry.timestamp)
        return (
          <div key={entry.id} style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12px', flexShrink: 0, paddingTop: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {idx < sorted.length - 1 && (
                <div style={{ width: '1px', flex: 1, minHeight: '20px', background: 'var(--border)', margin: '4px 0' }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: idx < sorted.length - 1 ? '16px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{entry.action}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 8px', borderRadius: '999px', background: s.bg, color: s.color, border: `1px solid ${s.color}44` }}>
                  {entry.agent}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {format(date, 'MMM d, yyyy · h:mm a')}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{entry.details}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
