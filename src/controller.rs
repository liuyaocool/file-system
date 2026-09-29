use std::{fs::{self}, process::Command, time::UNIX_EPOCH};
use axum::{Json, extract::Path, http::{StatusCode}};
use axum_extra::extract::Multipart;
use base64::{Engine, engine::general_purpose};

use crate::{api_assert_400, entity::{base_error::ApiError, *}};
use crate::config;

use base_error::ApiResult;

pub async fn video_pic(Path(path): Path<String>) -> ApiResult<String> {
    let path = decode_and_full_path(&path)?;
    // 替换最后一个 /, 拼接view链接
    let pos = path.rfind("/").expect("路径异常： 缺失/");
    let mut view_path = String::with_capacity(path.len() + config::VIDEO_PIC_PATH.len() + config::VIDEO_PIC_SUFFIX.len());
    view_path.push_str(&path[..(pos + 1)]);
    view_path.push_str(config::VIDEO_PIC_PATH);
    let view_folder = view_path.clone();
    view_path.push_str(&path[pos + 1..]);
    view_path.push_str(".jpg");

    if fs::exists(&view_path)? {
        return Ok(String::from("exist"));
    } else {
        fs::create_dir_all(&view_folder)?;
    }
    
    let output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &path,
        ])
        .output()?;
    if !output.status.success() {
        return Err(ApiError::Other(anyhow::anyhow!( "ffprobe 执行失败: {}", String::from_utf8_lossy(&output.stderr))));
    }
    let duration: f64 = String::from_utf8_lossy(&output.stdout).trim().parse()?;
    let seek_time = (duration * 0.33) as i64;

    let status = Command::new("ffmpeg")
        .args([
            "-ss", &seek_time.to_string(),  // 跳到 33% 位置
            "-i", &path,
            "-loglevel", "quiet", // 完全静默
            "-frames:v", "1",     // 只截一帧
            "-c:v", "mjpeg",      // 使用 MJPEG 编码
            "-q:v", "23",         // 质量（1-31，越小越好）
            "-y",                 // 覆盖已存在文件
            &view_path
        ])
        .status()?;
    if !status.success() {
        return Err(ApiError::Other(anyhow::anyhow!( "ffmpeg 截图失败: {}", String::from_utf8_lossy(&output.stderr))));
    }
    Ok(String::from("ok"))
}

pub async fn list_root() -> ApiResult<Json<Vec<FileMeta>>> {
    list(config::HOME_PATH.get().unwrap().to_string())
}

pub async fn list_file(Path(path): Path<String>) -> ApiResult<Json<Vec<FileMeta>>> {
    list(decode_and_full_path(&path)?)
}

fn list(path: String) -> ApiResult<Json<Vec<FileMeta>>> {
    // println!("path : {}", path);
    let mut v = Vec::<FileMeta>::new();
    let entries = fs::read_dir(path)?;
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
    Ok(Json(v))
}
 
pub async fn upload(mut multipart: Multipart) -> ApiResult<()> {
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
    
    api_assert_400!(id, "参数id为空");
    api_assert_400!(folder, "参数folder为空");
    api_assert_400!(filename, "参数filename为空");
    api_assert_400!(last, "参数last为空");
    println!("param: {:?}", multipart);
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

    Ok(())
    // ResBody::from_ok()
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

fn decode_path(path: &String) -> anyhow::Result<String> {
    Ok(String::from_utf8(general_purpose::URL_SAFE_NO_PAD.decode(path)?)?)
}

fn decode_and_full_path(path: &String) -> anyhow::Result<String> {
    let path_vec = general_purpose::URL_SAFE_NO_PAD.decode(path)?;
    let path_str = String::from_utf8(path_vec)?;
    let h = config::HOME_PATH.get().unwrap();
    let mut p = String::with_capacity(h.len() + path_str.len());
    p.push_str(h); // h 自动解引用为&str
    p.push_str(&path_str);
    Ok(p)
}