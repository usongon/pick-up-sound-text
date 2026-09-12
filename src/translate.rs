use crate::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateRequest {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub context: Vec<String>,
    pub glossary: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateResponse {
    pub translated_text: String,
}

#[async_trait]
pub trait TranslateProvider: Send + Sync {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResponse>;
    async fn test_connection(&self) -> Result<()>;
}
