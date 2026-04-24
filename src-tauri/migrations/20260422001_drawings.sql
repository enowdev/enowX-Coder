-- Drawings table: one drawing per project, stores Excalidraw JSON
CREATE TABLE IF NOT EXISTS drawings (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drawings_project ON drawings(project_id);
