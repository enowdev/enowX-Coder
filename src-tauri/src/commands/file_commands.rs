use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub children: Option<Vec<FileNode>>,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

#[command]
pub async fn read_directory(path: String, recursive: bool) -> Result<Vec<FileNode>, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }
    
    read_dir_recursive(path, recursive)
}

fn read_dir_recursive(path: &Path, recursive: bool) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    
    let entries = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files and common ignore patterns
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        
        let metadata = entry.metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        
        let node_type = if metadata.is_dir() {
            "directory"
        } else {
            "file"
        };
        
        let size = if metadata.is_file() {
            Some(metadata.len())
        } else {
            None
        };
        
        let modified = metadata.modified()
            .ok()
            .and_then(|time| {
                time.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|d| d.as_secs().to_string())
            });
        
        let children = if metadata.is_dir() && recursive {
            Some(read_dir_recursive(&path, recursive).unwrap_or_default())
        } else {
            None
        };
        
        nodes.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            node_type: node_type.to_string(),
            children,
            size,
            modified,
        });
    }
    
    // Sort: directories first, then files, alphabetically
    nodes.sort_by(|a, b| {
        match (a.node_type.as_str(), b.node_type.as_str()) {
            ("directory", "file") => std::cmp::Ordering::Less,
            ("file", "directory") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(nodes)
}

#[command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[command]
pub async fn write_file_content(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[command]
pub async fn create_file(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err("File already exists".to_string());
    }
    
    fs::write(&path, "")
        .map_err(|e| format!("Failed to create file: {}", e))
}

#[command]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))
}

#[command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    
    if path.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to delete file: {}", e))
    }
}

#[command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename file: {}", e))
}
