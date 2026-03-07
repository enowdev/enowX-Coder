export interface ProjectMeta {
  projectName: string
  description: string
  techStack: string[]
  status: 'planned' | 'in_progress' | 'completed' | 'on_hold'
  createdAt: string
  updatedAt: string
  version: string
  repository: string
}

export interface Milestone {
  id: string
  title: string
  done: boolean
}

export interface Phase {
  id: string
  name: string
  description: string
  status: 'planned' | 'in_progress' | 'completed'
  startDate: string
  endDate: string
  progress: number
  milestones: Milestone[]
}

export interface Roadmap {
  phases: Phase[]
}

export interface Task {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  tags: string[]
  assignee: string | null
  createdAt: string
}

export interface KanbanColumn {
  id: string
  title: string
  tasks: Task[]
}

export interface Kanban {
  columns: KanbanColumn[]
}

export interface EntityField {
  name: string
  type: string
  primaryKey?: boolean
  nullable?: boolean
}

export interface Entity {
  id: string
  name: string
  fields: EntityField[]
}

export interface Relation {
  from: string
  to: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
  label: string
}

export interface ERD {
  entities: Entity[]
  relations: Relation[]
}

export interface Feature {
  id: string
  name: string
  description: string
  status: 'planned' | 'in_progress' | 'shipped'
  priority: 'high' | 'medium' | 'low'
  category: string
}

export interface Suggestion {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  category: string
}

export interface ArchDecision {
  id: string
  title: string
  rationale: string
  date: string
  status: 'accepted' | 'proposed' | 'rejected'
}

export interface ArchPattern {
  name: string
  description: string
}

export interface Architecture {
  decisions: ArchDecision[]
  patterns: ArchPattern[]
}

export interface SessionLogEntry {
  id: string
  timestamp: string
  action: string
  details: string
  agent: string
}

export interface Plan {
  meta: ProjectMeta
  roadmap: Roadmap
  kanban: Kanban
  erd: ERD
  features: Feature[]
  suggestions: Suggestion[]
  architecture: Architecture
  sessionLog: SessionLogEntry[]
}
