use std::sync::OnceLock;

// static mut HOME_PATH :&str = "/home/liuyao";
pub static HOME_PATH: OnceLock<String> = OnceLock::new();
pub static VIDEO_PIC_PATH: &str = ".vpr/";
pub static VIDEO_PIC_SUFFIX: &str = ".jpg";