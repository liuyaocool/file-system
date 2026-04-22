use axum::{Router, routing::{get, post}};

mod entity;
mod controller;
mod config;

#[tokio::main]
async fn main() {

    let args: Vec<String> = std::env::args().collect();
    // 写一行时是临时生命周期， 在行结束后就回收了
    let def_port = String::from("3000");
    let port = args.get(1).unwrap_or(&def_port); 
    let def_home = home::home_dir().unwrap().to_string_lossy().to_string();
    let home_path = args.get(2).unwrap_or(&def_home);
    let _ = config::HOME_PATH.set(home_path.to_string());

    println!("Usage: {} <port> <home: same as nginx open> \nserver running in port({}), home({})", args[0], port, home_path);

    // 创建路由
    let app = Router::new()
        .route("/tree/", get(controller::list_root))
        .route("/tree/{path}", get(controller::list_file))
        .route("/list_file/", get(controller::list_root))
        .route("/list_file/{path}", get(controller::list_file))
        .route("/upload/", post(controller::upload))
    ;
    let listener = tokio::net::TcpListener::bind(String::from("0.0.0.0:") + port).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}