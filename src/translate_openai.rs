use crate::translate::{TranslateProvider, TranslateRequest, TranslateResponse};
use crate::Result;
use async_trait::async_trait;

pub struct OpenAiCompatibleProvider {
    pub base_url: String,
    pub model: String,
    pub api_key: String,
}

#[async_trait]
impl TranslateProvider for OpenAiCompatibleProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResponse> {
        // TODO: Implement HTTP request to OpenAI-compatible API
        Ok(TranslateResponse {
            translated_text: format!("[Translated] {}", req.text),
        })
    }

    async fn test_connection(&self) -> Result<()> {
        // TODO: Implement minimal test request
        Ok(())
    }
}
