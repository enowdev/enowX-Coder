import type { Architecture as ArchType } from '@/types/plan'

interface Props {
  architecture: ArchType
}

const decisionStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  accepted: { label: 'Accepted', color: '#22c55e', bg: '#22c55e22' },
  proposed: { label: 'Proposed', color: '#f59e0b', bg: '#f59e0b22' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: '#ef444422' },
}

export function Architecture({ architecture }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Architecture Decision Records
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {architecture.decisions.map(d => {
            const s = decisionStatusConfig[d.status]
            return (
              <div key={d.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: d.status === 'rejected' ? 'var(--text-muted)' : 'var(--text)', textDecoration: d.status === 'rejected' ? 'line-through' : 'none' }}>
                    {d.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.date}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: s.bg, color: s.color, border: `1px solid ${s.color}44` }}>
                      {s.label}
                    </span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{d.rationale}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Patterns
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {architecture.patterns.map((p, i) => (
            <div key={i} style={{ background: 'var(--surface)', padding: '14px 16px', display: 'flex', gap: '12px' }}>
              <div style={{ width: '3px', borderRadius: '2px', background: 'var(--accent)', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>{p.name}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
