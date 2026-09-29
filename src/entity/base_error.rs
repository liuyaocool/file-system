use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

// pub type ApiResult<T> = anyhow::Result<T, ApiError>;
pub type ApiResult<T> = core::result::Result<T, ApiError>;

// Rust 的 std::error::Error trait 要求实现 Display。 
// 如果不用 thiserror(#[error(xxx)])， 得手写： impl std::fmt::Display for ApiError
#[derive(Debug)] // Debug 也是必须的
pub enum ApiError {
    NotFound(String),
    /// 参数异常 0被替换成了String
    Validation(String),
    /// 业务逻辑异常
    Unprocess(u16, String),
    // 把 Display 和 source 直接透传给 anyhow::Error
    Other(anyhow::Error), // 自动生成 From<anyhow::Error>
}

impl ApiError {
    pub fn err_400(str: &str) -> Self{
        Self::Validation(String::from(str))
    }
}

// From: 转换任意支持类型为ApiError
impl<E> From<E> for ApiError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        // let error = err.into();
        ApiError::Other(err.into())
        // Self { status: StatusCode::INTERNAL_SERVER_ERROR, error }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (mut code, status, msg) = match self {
            ApiError::Unprocess(code, msg) => (code, StatusCode::UNPROCESSABLE_ENTITY, format!("Unprocessable error: {}", msg)),
            ApiError::Other(err)       => (0, StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            ApiError::Validation(msg) => (0, StatusCode::BAD_REQUEST, format!("Validation error: {}", msg)),
            ApiError::NotFound(p)     => (0, StatusCode::NOT_FOUND,   format!("Not found: {}", p))
        };
        if code == 0 {
            code = status.as_u16();
        }
        let body = serde_json::json!({"code": code, "msg": msg});
        (status, Json(body)).into_response()
    }
}

// 判断并返回异常
#[macro_export]  // 加上这个，才能在其他模块使用
macro_rules! api_assert_400 {
    ($field:expr, $p:expr) => {
        if $field.is_empty() {
            return Err($crate::entity::base_error::ApiError::err_400($p));
        }
    };
}