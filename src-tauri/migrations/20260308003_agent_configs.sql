CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL UNIQUE,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  model_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_agent_type ON agent_configs(agent_type);

ALTER TABLE agent_runs ADD COLUMN parent_agent_run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE;
ALTER TABLE agent_runs ADD COLUMN project_path TEXT;
