import type { Kanban as KanbanType, Task } from '@/types/plan'

interface Props {
  kanban: KanbanType
}

function priorityStyle(priority: string): { bg: string; color: string } {
  if (priority === 'high') return { bg: '#ef444422', color: '#ef4444' }
  if (priority === 'medium') return { bg: '#f59e0b22', color: '#f59e0b' }
  return { bg: '#22c55e22', color: '#22c55e' }
}

function TaskCard({ task, done }: { task: Task; done: boolean }) {
  const p = priorityStyle(task.priority)
  const initials = task.assignee ? task.assignee.slice(0, 2).toUpperCase() : null

  return (
    <div style={{
      background: done ? 'var(--surface)' : 'var(--surface-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '12px',
      opacity: done ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, textDecoration: done ? 'line-through' : 'none' }}>
          {task.title}
        </span>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: p.bg, color: p.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {task.priority}
        </span>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {task.description}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {task.tags.map(tag => (
            <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {tag}
            </span>
          ))}
        </div>
        {initials && (
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
        )}
      </div>
    </div>
  )
}

export function Kanban({ kanban }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', minWidth: 0 }}>
      {kanban.columns.map(col => (
        <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {col.title}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px', background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {col.tasks.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {col.tasks.map(task => (
              <TaskCard key={task.id} task={task} done={col.id === 'done'} />
            ))}
            {col.tasks.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                Empty
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
