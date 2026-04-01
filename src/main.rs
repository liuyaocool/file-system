use std::{fs::{self}, str::Utf8Error, sync::OnceLock, time::UNIX_EPOCH};
use axum::{Json, 
    Router, 
    extract::Path, 
    http::StatusCode, 
    response::{IntoResponse, Response}, 
    routing::{get}};
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
struct FsError(StatusCode, String);
impl From<DecodeError> for FsError {
    fn from(e: DecodeError) -> Self {
        FsError(StatusCode::BAD_REQUEST, e.to_string())
    }
}
impl From<Utf8Error> for FsError {
    fn from(e: Utf8Error) -> Self {
        FsError(StatusCode::BAD_REQUEST, e.to_string())
    }
}
impl IntoResponse for FsError {
    fn into_response(self) -> Response {
        (self.0, self.1).into_response()
    }
}

// static mut HOME_PATH :&str = "/home/liuyao";
static HOME_PATH: OnceLock<String> = OnceLock::new();

#[tokio::main]
async fn main() {

    let args: Vec<String> = std::env::args().collect();
    // 写一行时是临时生命周期， 在行结束后就回收了
    let def_port = String::from("3000");
    let port = args.get(1).unwrap_or(&def_port); 
    let def_home = home::home_dir().unwrap().to_string_lossy().to_string();
    let home_path = args.get(2).unwrap_or(&def_home);
    let _ = HOME_PATH.set(home_path.to_string());

    println!("Usage: {} <port> <home> \nserver running in port({}), home({})", args[0], port, home_path);

    // 创建路由
    let app = Router::new()
        .route("/list_file/", get(list_root))
        .route("/list_file/{path}", get(list_file))
    ;
    let listener = tokio::net::TcpListener::bind(String::from("0.0.0.0:") + port).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn list_root() -> Json<Vec<FileMeta>> {
    _list_file(HOME_PATH.get().unwrap().to_string())
}

async fn list_file(Path(path): Path<String>) -> Result<Json<Vec<FileMeta>>, FsError> {
    let path_bytes = general_purpose::URL_SAFE_NO_PAD.decode(&path)?;
    let path_str = str::from_utf8(&path_bytes)?;

    let h = HOME_PATH.get().unwrap();
    let mut p = String::with_capacity(h.len() + path_str.len());
    p.push_str(h); // h 自动解引用为&str
    p.push_str(path_str);

    Ok(_list_file(p))
}

fn _list_file(path: String) -> Json<Vec<FileMeta>> {
    println!("path : {}", path);
    let mut v = Vec::<FileMeta>::new();
    match fs::read_dir(path) {
        Ok(entries) => {
            for et in entries.flatten() {
                let mut meta :FileMeta = FileMeta { dir: false, size: 0, time: 0,
                    name: et.file_name().to_string_lossy().to_string()};
                if let Ok(me) = et.metadata() {
                    meta.dir = me.is_dir();
                    meta.size = me.len(); // len通用 跨平台， size: unix特有
                    if let Ok(t) = me.modified() {
                        meta.time = t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
                    }
                }
                v.push(meta);
            }
        }
        Err(e) => {
            v.push(FileMeta { dir: false, name: e.to_string() + " / " + &e.kind().to_string(), size: 0, time: 0 });
        }
    }
    Json(v)
}
