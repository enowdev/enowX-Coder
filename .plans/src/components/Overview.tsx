import { ArrowSquareOut, GitBranch, CheckCircle, Sparkle, Lightbulb, Tag } from '@phosphor-icons/react'
import type { Plan } from '@/types/plan'

interface Props {
  plan: Plan
}

export function Overview({ plan }: Props) {
  const { meta, roadmap, kanban, features, suggestions } = plan

  const allTasks = kanban.columns.flatMap(c => c.tasks)
  const doneTasks = kanban.columns.find(c => c.id === 'done')?.tasks ?? []
  const shippedFeatures = features.filter(f => f.status === 'shipped')
  const completedPhases = roadmap.phases.filter(p => p.status === 'completed')
  const avgProgress = Math.round(roadmap.phases.reduce((s, p) => s + p.progress, 0) / roadmap.phases.length)

  const statusColor: Record<string, string> = {
    in_progress: '#3b82f6',
    completed: '#22c55e',
    planned: '#8888aa',
    on_hold: '#f59e0b',
  }

  const stats = [
    { label: 'Total Tasks', value: allTasks.length, icon: <CheckCircle size={18} />, color: '#a78bfa' },
    { label: 'Done', value: doneTasks.length, icon: <CheckCircle size={18} weight="fill" />, color: '#22c55e' },
    { label: 'Features Shipped', value: shippedFeatures.length, icon: <Sparkle size={18} weight="fill" />, color: '#3b82f6' },
    { label: 'Phases Complete', value: completedPhases.length, icon: <GitBranch size={18} />, color: '#f59e0b' },
    { label: 'Suggestions', value: suggestions.length, icon: <Lightbulb size={18} />, color: '#ec4899' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>{meta.projectName}</h1>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>v{meta.version}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: statusColor[meta.status] + '22', color: statusColor[meta.status], border: `1px solid ${statusColor[meta.status]}44` }}>{meta.status.replace('_', ' ')}</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>{meta.description}</p>
          </div>
          <a href={meta.repository} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--accent-light)', textDecoration: 'none', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-elevated)', whiteSpace: 'nowrap' }}>
            <ArrowSquareOut size={14} />Repository
          </a>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {meta.techStack.map(tech => (
            <span key={tech} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 10px', borderRadius: '6px', background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <Tag size={11} />{tech}
            </span>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Overall Progress</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-light)' }}>{avgProgress}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${avgProgress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-light))', borderRadius: '999px' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {stats.map(stat => (
          <div key={stat.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: stat.color }}>{stat.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phase Overview</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {roadmap.phases.map(phase => (
            <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: phase.status === 'completed' ? '#22c55e' : phase.status === 'in_progress' ? '#3b82f6' : 'var(--border)' }} />
              <span style={{ fontSize: '14px', color: 'var(--text)', minWidth: '120px' }}>{phase.name}</span>
              <div style={{ flex: 1, height: '4px', background: 'var(--surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${phase.progress}%`, background: phase.status === 'completed' ? '#22c55e' : phase.status === 'in_progress' ? '#3b82f6' : 'var(--border)', borderRadius: '999px' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>{phase.progress}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
