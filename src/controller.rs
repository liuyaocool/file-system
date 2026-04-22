use std::{fs::{self}, time::UNIX_EPOCH};
use axum::{Json, extract::Path, http::{StatusCode}};
use axum_extra::extract::Multipart;
use base64::{Engine, engine::general_purpose};

use crate::{empty_return_400, entity::*};
use crate::config;

pub async fn list_root() -> Json<Vec<FileMeta>> {
    list(config::HOME_PATH.get().unwrap().to_string())
}

pub async fn list_file(Path(path): Path<String>) -> Result<Json<Vec<FileMeta>>, FsError> {
    let path_bytes = general_purpose::URL_SAFE_NO_PAD.decode(&path)?;
    let path_str = str::from_utf8(&path_bytes)?;

    let h = config::HOME_PATH.get().unwrap();
    let mut p = String::with_capacity(h.len() + path_str.len());
    p.push_str(h); // h 自动解引用为&str
    p.push_str(path_str);

    Ok(list(p))
}

fn list(path: String) -> Json<Vec<FileMeta>> {
    // println!("path : {}", path);
    let mut v = Vec::<FileMeta>::new();
    match fs::read_dir(path) {
        Ok(entries) => {
            for et in entries.flatten() {
                let mut meta: FileMeta = FileMeta::from_name(et.file_name().to_string_lossy().to_string());
                if let Ok(me) = et.metadata() {
                    if me.is_dir() {
                        meta.dir = true;    
                    } else if me.is_symlink() {
                        meta.link = true;
                        // fs::canonicalize(et.path()); // real link
                        match fs::metadata(et.path()) {
                            Ok(meta_link) => {
                                meta.dir = meta_link.is_dir();
                            }
                            Err(e) => {
                                meta.err.push_str("get symlink");
                                meta.err.push_str(&e.to_string());
                            }
                        }
                    }
                    meta.size = me.len(); // len通用 跨平台， size: unix特有
                    if let Ok(t) = me.modified() {
                        meta.time = t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
                    }
                }
                v.push(meta);
            }
        }
        Err(e) => {
            v.push(FileMeta::from_name(e.to_string() + " / " + &e.kind().to_string()));
        }
    }
    Json(v)
}


pub async fn upload(mut multipart: Multipart) -> ResBody<()> {
    let mut folder: String = String::new();
    let mut id: String = String::new();
    let mut filename: String = String::new();
    let mut last: String = String::new();
    let mut data;
    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("file") => if let Ok(val) = field.bytes().await { data = val }
            Some("dir") => if let Ok(val) = field.text().await { folder = val },
            Some("filename") => if let Ok(val) = field.text().await { filename = val },
            Some("id") => if let Ok(val) = field.text().await { id = val },
            Some("isLastPart") => if let Ok(val) = field.text().await { last = val },
            _ => {},
        }
    }
    empty_return_400!(id, 400, "参数id为空");
    empty_return_400!(folder, 400, "参数folder为空");
    empty_return_400!(filename, 400, "参数filename为空");
    empty_return_400!(last, 400, "参数last为空");
    // if id.is_empty() {
    //     return ResBody::json_400(400, "");
    // }

    let is_last = last.parse::<bool>();
    // .unwrap_or(false);
    
    //             return ResBody::json_400(400, "参数file(上传文件)为空");

    // folder = std::path::PathBuf::from(val);
    //                 if !folder.exists() {
    //                     return ResBody::json_400(404, "文件夹不存在");
                        
    //                 }

    // 保存文件
    let n = tokio::fs::create_dir_all(&folder).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR);
    // let file_path = upload_dir.join(&filename);
    // tokio::fs::write(&file_path, &data).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // result.filename = Some(filename);

    ResBody::json_ok()
//     let f = multipart.next_field().await;
    // while let Ok(Some(mut field)) = multipart.next_field().await {
//         let n = field.name();
//         match field.name() {
//             Some("file") => {

//             }
//             None => {

//             }
//         }
    // }
}