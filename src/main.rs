use axum::{Router, routing::{get, post}};

mod entity;
mod controller;
mod config;

#[tokio::main]
async fn main() {

    let args: Vec<String> = std::env::args().collect();
    if args.len() < 1 {
        println!("Usage: {} <port> <home: default is home(/home/xxx)>", args[0]);
        std::process::exit(1);
    }
    // 写成一行时是临时生命周期， 在行结束后就回收了, 但port或许需要持有引用
    let def_port = String::from("3000");
    let port = args.get(1).unwrap_or(&def_port);
    let def_home = home::home_dir().unwrap().to_string_lossy().to_string();
    let home_path = args.get(2).unwrap_or(&def_home);
    let _ = config::HOME_PATH.set(home_path.to_string());

    println!("server running in port({}), home({})", port, home_path);

    // 创建路由
    let app = Router::new()
        .route("/tree", get(controller::list_root))
        .route("/tree/{path}", get(controller::list_file))
        .route("/list_file", get(controller::list_root))
        .route("/list_file/{path}", get(controller::list_file))
        .route("/video_pic/{path}", get(controller::video_pic))
        .route("/upload", post(controller::upload))
    ;
    let listener = tokio::net::TcpListener::bind(String::from("0.0.0.0:") + port).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}