use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::Drawing,
};

use super::now_rfc3339;

pub async fn get_drawing(db: &SqlitePool, project_id: &str) -> AppResult<Option<Drawing>> {
    let drawing = sqlx::query_as::<_, Drawing>(
        "SELECT id, project_id, data, created_at, updated_at FROM drawings WHERE project_id = ?1",
    )
    .bind(project_id)
    .fetch_optional(db)
    .await?;

    Ok(drawing)
}

pub async fn save_drawing(db: &SqlitePool, project_id: &str, data: &str) -> AppResult<Drawing> {
    let now = now_rfc3339();

    // Upsert: update if exists, insert if not
    let existing = get_drawing(db, project_id).await?;

    if let Some(mut drawing) = existing {
        sqlx::query("UPDATE drawings SET data = ?1, updated_at = ?2 WHERE project_id = ?3")
            .bind(data)
            .bind(&now)
            .bind(project_id)
            .execute(db)
            .await?;
        drawing.data = data.to_string();
        drawing.updated_at = now;
        Ok(drawing)
    } else {
        let drawing = Drawing {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            data: data.to_string(),
            created_at: now.clone(),
            updated_at: now,
        };

        sqlx::query(
            "INSERT INTO drawings (id, project_id, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(&drawing.id)
        .bind(&drawing.project_id)
        .bind(&drawing.data)
        .bind(&drawing.created_at)
        .bind(&drawing.updated_at)
        .execute(db)
        .await?;

        Ok(drawing)
    }
}
