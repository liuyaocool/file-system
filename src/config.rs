use std::sync::OnceLock;

// static mut HOME_PATH :&str = "/home/liuyao";
pub static HOME_PATH: OnceLock<String> = OnceLock::new();