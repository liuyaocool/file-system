use axum::{Json, http::{StatusCode}, response::{IntoResponse, Response}};
use serde::Serialize;

#[derive(Serialize)]
pub struct ResBody<T> {
    #[serde(skip_serializing)]  // 序列化时跳过此字段
    status_code: StatusCode,
    code: u16,
    msg: &'static str,
    data: T
}
impl <T: Serialize> IntoResponse for ResBody<T> {
    fn into_response(self) -> Response<axum::body::Body> {
        (
            self.status_code, 
            [ ("Content-Type", "application/json")], 
            Json(self)
        ).into_response()
    }
}
// impl <T> ResBody<T> {
//     pub fn json(status_code: StatusCode, code: u16, msg: &'static str, data: T) -> Self {
//         ResBody {status_code, code, msg, data}
//     }
// }
impl ResBody<()> {
    pub fn json_400(code: u16, msg: &'static str) -> Self {
        ResBody {status_code: StatusCode::BAD_REQUEST, code, msg, data: ()}
    }
    pub fn json_ok() -> Self {
        ResBody { status_code: StatusCode::OK, code: 200, msg: "ok", data: () }
    }
}

#[macro_export]  // 加上这个，才能在其他模块使用
macro_rules! empty_return_400 {
    ($field:expr, $code:expr, $msg:expr) => {
        if $field.is_empty() {
            return $crate::entity::ResBody::json_400($code, $msg);
        }
    };
}