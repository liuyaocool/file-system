use std::ffi::OsString;
use std::fs;
use std::time::UNIX_EPOCH;
use axum::{Json, Router, routing::get, http::StatusCode, response::{IntoResponse, Response}};
use serde::Serialize;

#[derive(Serialize)]
struct FileMeta {
    dir: bool,
    name: String,
    size: u64,
    modified: u64,
}

// 自定义错误类型
struct AppError(StatusCode, String);

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError(StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.0, self.1).into_response()
    }
}

async fn list_file() -> Result<Json<Vec<FileMeta>>, AppError> {
    let mut v = Vec::new();
    
    let entries = fs::read_dir("/home/liuyao/")?;
    
    for entry in entries {
        let entry = entry?;
        let metadata = entry.metadata()?;
        
        let modified = metadata.modified()?
            .duration_since(UNIX_EPOCH)
            .map_err(|e| AppError(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .as_millis() as u64;
        
        v.push(FileMeta {
            dir: metadata.is_dir(),
            name: entry.file_name().to_string_lossy().to_string(),
            size: metadata.len(),
            modified,
        });
    }
    
    Ok(Json(v))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/list_file", get(list_file));
    
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Server running on http://localhost:3000");
    axum::serve(listener, app).await.unwrap();
}