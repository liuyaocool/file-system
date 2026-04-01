use std::{fs::{self}, str::Utf8Error, time::UNIX_EPOCH};
use axum::{Json, 
    Router, 
    extract::Path, 
    http::StatusCode, 
    response::{IntoResponse, Response}, 
    routing::{get, post}};
use base64::{DecodeError, Engine, engine::general_purpose};
use serde::Serialize;

#[derive(Serialize)]
struct FileMeta {
    dir: bool,
    name: String,
    size: u64,
    time: u64,
}

// 自定义错误类型
struct FsError(StatusCode);
// From: trait 自动转换功能
impl From<std::io::Error> for FsError {
    fn from(e: std::io::Error) -> Self {
        let status = match e.kind() {
            std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
            std::io::ErrorKind::PermissionDenied => StatusCode::FORBIDDEN,
            std::io::ErrorKind::InvalidInput => StatusCode::BAD_REQUEST,
            std::io::ErrorKind::AlreadyExists => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        FsError(status)
    }
}
impl From<DecodeError> for FsError {
    fn from(e: DecodeError) -> Self {
        FsError(StatusCode::BAD_REQUEST)
    }
}
impl From<Utf8Error> for FsError {
    fn from(e: Utf8Error) -> Self {
        FsError(StatusCode::BAD_REQUEST)
    }
}
impl IntoResponse for FsError {
    fn into_response(self) -> Response {
        self.0.into_response()
    }
}

#[tokio::main]
async fn main() {
    // 创建路由
    let app = Router::new()
        .route("/list_file/{path}", get(list_file))
        .route("/{id}", post(hello_handler_post))
    ;
    
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("server running in port 3000");
    axum::serve(listener, app).await.unwrap();
}

async fn hello_handler() -> &'static str {
    "Hello, World!"
}
async fn hello_handler_post(Path(id): Path<String>) -> String {
    String::from("Post Hello, World! ") + &id
}

async fn list_file(Path(path): Path<String>) -> Result<Json<Vec<FileMeta>>, FsError> {
    let path_bytes = general_purpose::URL_SAFE_NO_PAD.decode(&path)?;
    let path_str = str::from_utf8(&path_bytes)?;
    let mut v = Vec::<FileMeta>::new();
    // flatten 包装器 返回一个迭代器， 跳过Error值
    for et in fs::read_dir(path_str)?.flatten() {
        let meta = et.metadata()?;
        v.push(FileMeta {
            dir: meta.is_dir(),
            name: et.file_name().to_string_lossy().to_string(),
            size: meta.len(), // len通用 跨平台， size: unix特有
            time: meta.modified()?.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs(),
        });
    }
    Ok(Json(v))
}
