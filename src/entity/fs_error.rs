use base64::{DecodeError};
use std::{str::Utf8Error};
use axum::{http::{StatusCode}, response::{IntoResponse}};

// 自定义错误类型
pub struct FsError(StatusCode, String);
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
    fn into_response(self) -> axum::response::Response {
        (self.0, self.1).into_response()
    }
}
