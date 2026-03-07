import { CheckCircle, CircleHalf, Circle } from '@phosphor-icons/react'
import type { Roadmap as RoadmapType } from '@/types/plan'

interface Props {
  roadmap: RoadmapType
}

export function Roadmap({ roadmap }: Props) {
  const phaseColor = (status: string) => {
    if (status === 'completed') return '#22c55e'
    if (status === 'in_progress') return '#3b82f6'
    return 'var(--border)'
  }

  const PhaseIcon = ({ status }: { status: string }) => {
    if (status === 'completed') return <CheckCircle size={20} weight="fill" color="#22c55e" />
    if (status === 'in_progress') return <CircleHalf size={20} weight="fill" color="#3b82f6" />
    return <Circle size={20} color="var(--border)" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {roadmap.phases.map((phase, idx) => (
        <div key={phase.id} style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px', flexShrink: 0 }}>
            <PhaseIcon status={phase.status} />
            {idx < roadmap.phases.length - 1 && (
              <div style={{ width: '2px', flex: 1, minHeight: '24px', background: phaseColor(phase.status), opacity: 0.3, margin: '4px 0' }} />
            )}
          </div>

          <div style={{
            flex: 1,
            background: 'var(--surface)',
            border: `1px solid ${phase.status === 'in_progress' ? '#3b82f644' : 'var(--border)'}`,
            borderRadius: '10px',
            padding: '18px',
            marginBottom: idx < roadmap.phases.length - 1 ? '12px' : '0',
            boxShadow: phase.status === 'in_progress' ? '0 0 0 1px #3b82f622' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{phase.name}</h3>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
                    background: phaseColor(phase.status) + '22', color: phaseColor(phase.status),
                    border: `1px solid ${phaseColor(phase.status)}44`,
                  }}>{phase.status.replace('_', ' ')}</span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{phase.description}</p>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                {phase.startDate} → {phase.endDate}
              </span>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progress</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: phaseColor(phase.status) }}>{phase.progress}%</span>
              </div>
              <div style={{ height: '5px', background: 'var(--surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${phase.progress}%`, background: phaseColor(phase.status), borderRadius: '999px', transition: 'width 0.5s ease' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {phase.milestones.map(ms => (
                <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                    background: ms.done ? '#22c55e22' : 'var(--surface-elevated)',
                    border: `1px solid ${ms.done ? '#22c55e44' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {ms.done && <CheckCircle size={10} weight="fill" color="#22c55e" />}
                  </div>
                  <span style={{ fontSize: '13px', color: ms.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: ms.done ? 'line-through' : 'none' }}>
                    {ms.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
