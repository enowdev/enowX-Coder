import { useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  type NodeTypes,
  type Node,
  type Edge,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Key } from '@phosphor-icons/react'
import type { ERD as ERDType } from '@/types/plan'

interface Props {
  erd: ERDType
}

function EntityNode({ data }: { data: { name: string; fields: Array<{ name: string; type: string; primaryKey?: boolean }> } }) {
  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      minWidth: '180px',
      overflow: 'hidden',
      boxShadow: '0 4px 24px #0006',
    }}>
      <div style={{ background: 'var(--accent)', padding: '8px 12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{data.name}</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {data.fields.map((f) => (
          <div key={f.name} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 12px', gap: '12px',
            background: f.primaryKey ? '#7c3aed11' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {f.primaryKey && <Key size={10} weight="fill" color="var(--accent-light)" />}
              <span style={{ fontSize: '12px', color: f.primaryKey ? 'var(--accent-light)' : 'var(--text)', fontWeight: f.primaryKey ? 600 : 400 }}>
                {f.name}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{f.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { entity: EntityNode }

const POSITIONS: Record<string, { x: number; y: number }> = {
  user: { x: 0, y: 100 },
  project: { x: 280, y: 0 },
  session: { x: 560, y: 100 },
  message: { x: 840, y: 200 },
}

export function ERD({ erd }: Props) {
  const initialNodes: Node[] = erd.entities.map(entity => ({
    id: entity.id,
    type: 'entity',
    position: POSITIONS[entity.id] ?? { x: Math.random() * 600, y: Math.random() * 400 },
    data: { name: entity.name, fields: entity.fields },
  }))

  const initialEdges: Edge[] = erd.relations.map((rel, i) => ({
    id: `e${i}`,
    source: rel.from,
    target: rel.to,
    label: rel.label,
    type: 'smoothstep',
    style: { stroke: 'var(--border)', strokeWidth: 1.5 },
    labelStyle: { fill: 'var(--text-muted)', fontSize: 11 },
    labelBgStyle: { fill: 'var(--surface-elevated)' },
    markerEnd: { type: 'arrowclosed' as const, color: 'var(--border)' },
  }))

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView()
  }, [])

  return (
    <div style={{ height: '520px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--border)" gap={20} size={1} />
        <Controls style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px' }} />
      </ReactFlow>
    </div>
  )
}
