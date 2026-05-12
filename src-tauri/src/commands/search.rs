use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub text: String,
    #[serde(rename = "match")]
    pub match_text: String,
}

#[command]
pub async fn search_in_files(
    root_path: String,
    query: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();
    
    let pattern = if use_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };
    
    let pattern = if whole_word {
        format!(r"\b{}\b", pattern)
    } else {
        pattern
    };
    
    let regex = if case_sensitive {
        Regex::new(&pattern)
    } else {
        Regex::new(&format!("(?i){}", pattern))
    }.map_err(|e| format!("Invalid regex: {}", e))?;
    
    search_directory(Path::new(&root_path), &regex, &mut results)?;
    
    Ok(results)
}

fn search_directory(
    dir: &Path,
    regex: &Regex,
    results: &mut Vec<SearchResult>,
) -> Result<(), String> {
    if !dir.is_dir() {
        return Ok(());
    }
    
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        // Skip hidden files and common ignore patterns
        if file_name.starts_with('.') 
            || file_name == "node_modules" 
            || file_name == "target"
            || file_name == "dist"
            || file_name == "build" {
            continue;
        }
        
        if path.is_dir() {
            search_directory(&path, regex, results)?;
        } else if path.is_file() {
            // Only search text files
            if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy().to_lowercase();
                if is_text_file(&ext) {
                    search_file(&path, regex, results)?;
                }
            }
        }
    }
    
    Ok(())
}

fn is_text_file(ext: &str) -> bool {
    matches!(
        ext,
        "txt" | "md" | "rs" | "js" | "ts" | "jsx" | "tsx" | "json" | "yaml" | "yml" 
        | "toml" | "html" | "css" | "scss" | "py" | "go" | "java" | "c" | "cpp" | "h"
        | "sh" | "bash" | "xml" | "sql" | "graphql" | "vue" | "svelte"
    )
}

fn search_file(
    path: &Path,
    regex: &Regex,
    results: &mut Vec<SearchResult>,
) -> Result<(), String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    for (line_num, line) in content.lines().enumerate() {
        for mat in regex.find_iter(line) {
            results.push(SearchResult {
                path: path.to_string_lossy().to_string(),
                line: line_num + 1,
                column: mat.start() + 1,
                text: line.to_string(),
                match_text: mat.as_str().to_string(),
            });
        }
    }
    
    Ok(())
}

#[command]
pub async fn replace_in_file(
    path: String,
    search: String,
    replace: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<usize, String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let pattern = if use_regex {
        search.clone()
    } else {
        regex::escape(&search)
    };
    
    let pattern = if whole_word {
        format!(r"\b{}\b", pattern)
    } else {
        pattern
    };
    
    let regex = if case_sensitive {
        Regex::new(&pattern)
    } else {
        Regex::new(&format!("(?i){}", pattern))
    }.map_err(|e| format!("Invalid regex: {}", e))?;
    
    let count = regex.find_iter(&content).count();
    let new_content = regex.replace_all(&content, replace.as_str()).to_string();
    
    fs::write(&path, new_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(count)
}
