use serde::Serialize;

#[derive(Serialize)]
pub struct FileMeta {
    pub dir: bool,
    pub link: bool,
    pub name: String,
    pub size: u64,
    pub time: u64,
    pub err: String,
    pub child: Vec<FileMeta>,
}

impl FileMeta {
    pub fn from_name(name: String) -> Self {
        Self { dir: false, link: false, name, size: 0, time: 0, err: String::new(),  child: Vec::new() }
    }
}