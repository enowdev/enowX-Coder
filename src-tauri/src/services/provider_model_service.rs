use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::ProviderModelConfig,
};

use super::now_rfc3339;

pub async fn list_provider_models(
    db: &SqlitePool,
    provider_id: &str,
) -> AppResult<Vec<ProviderModelConfig>> {
    let configs = sqlx::query_as::<_, ProviderModelConfig>(
        "SELECT id, provider_id, model_id, enabled, max_tokens, temperature, created_at, updated_at \
         FROM provider_models WHERE provider_id = ?1 ORDER BY model_id ASC",
    )
    .bind(provider_id)
    .fetch_all(db)
    .await?;

    Ok(configs)
}

pub async fn upsert_provider_model(
    db: &SqlitePool,
    provider_id: &str,
    model_id: &str,
    enabled: bool,
    max_tokens: i64,
    temperature: f64,
) -> AppResult<ProviderModelConfig> {
    if model_id.trim().is_empty() {
        return Err(AppError::Validation("model_id cannot be empty".to_string()));
    }
    if max_tokens < 1 {
        return Err(AppError::Validation(
            "max_tokens must be at least 1".to_string(),
        ));
    }
    if !(0.0..=2.0).contains(&temperature) {
        return Err(AppError::Validation(
            "temperature must be between 0.0 and 2.0".to_string(),
        ));
    }

    let now = now_rfc3339();

    let existing = sqlx::query_as::<_, ProviderModelConfig>(
        "SELECT id, provider_id, model_id, enabled, max_tokens, temperature, created_at, updated_at \
         FROM provider_models WHERE provider_id = ?1 AND model_id = ?2",
    )
    .bind(provider_id)
    .bind(model_id)
    .fetch_optional(db)
    .await?;

    if let Some(mut config) = existing {
        sqlx::query(
            "UPDATE provider_models SET enabled = ?1, max_tokens = ?2, temperature = ?3, updated_at = ?4 \
             WHERE provider_id = ?5 AND model_id = ?6",
        )
        .bind(enabled)
        .bind(max_tokens)
        .bind(temperature)
        .bind(&now)
        .bind(provider_id)
        .bind(model_id)
        .execute(db)
        .await?;

        config.enabled = enabled;
        config.max_tokens = max_tokens;
        config.temperature = temperature;
        config.updated_at = now;
        Ok(config)
    } else {
        let config = ProviderModelConfig {
            id: Uuid::new_v4().to_string(),
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            enabled,
            max_tokens,
            temperature,
            created_at: now.clone(),
            updated_at: now,
        };

        sqlx::query(
            "INSERT INTO provider_models (id, provider_id, model_id, enabled, max_tokens, temperature, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(&config.id)
        .bind(&config.provider_id)
        .bind(&config.model_id)
        .bind(config.enabled)
        .bind(config.max_tokens)
        .bind(config.temperature)
        .bind(&config.created_at)
        .bind(&config.updated_at)
        .execute(db)
        .await?;

        Ok(config)
    }
}

pub async fn delete_provider_model(
    db: &SqlitePool,
    provider_id: &str,
    model_id: &str,
) -> AppResult<()> {
    let result =
        sqlx::query("DELETE FROM provider_models WHERE provider_id = ?1 AND model_id = ?2")
            .bind(provider_id)
            .bind(model_id)
            .execute(db)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Model config not found: {provider_id}/{model_id}"
        )));
    }

    Ok(())
}
