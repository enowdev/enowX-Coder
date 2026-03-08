use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::Project,
};

use super::now_rfc3339;

pub async fn create_project(db: &SqlitePool, name: &str, path: Option<&str>) -> AppResult<Project> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err(AppError::Validation(
            "Project name cannot be empty".to_string(),
        ));
    }

    let now = now_rfc3339();
    let project = Project {
        id: Uuid::new_v4().to_string(),
        name: trimmed_name.to_string(),
        path: path.map(std::string::ToString::to_string),
        created_at: now.clone(),
        updated_at: now,
    };

    sqlx::query(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&project.id)
    .bind(&project.name)
    .bind(&project.path)
    .bind(&project.created_at)
    .bind(&project.updated_at)
    .execute(db)
    .await?;

    Ok(project)
}

pub async fn list_projects(db: &SqlitePool) -> AppResult<Vec<Project>> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT id, name, path, created_at, updated_at FROM projects ORDER BY updated_at DESC",
    )
    .fetch_all(db)
    .await?;

    Ok(projects)
}

pub async fn delete_project(db: &SqlitePool, id: &str) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM projects WHERE id = ?1")
        .bind(id)
        .execute(db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Project not found: {id}")));
    }

    Ok(())
}
