use crate::translate::{TranslateProvider, TranslateRequest, TranslateResponse};
use crate::{Error, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;

pub struct OpenAiCompatibleProvider {
    pub base_url: String,
    pub model: String,
    pub api_key: String,
}

#[async_trait]
impl TranslateProvider for OpenAiCompatibleProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResponse> {
        let client = Client::new();
        
        // Build context from previous sentences
        let context_text = if req.context.is_empty() {
            String::new()
        } else {
            format!("Context:\n{}\n\n", req.context.join("\n"))
        };
        
        // Build prompt
        let prompt = format!(
            "{}Translate the following text from {} to {}:\n\n{}",
            context_text,
            req.source_lang,
            req.target_lang,
            req.text
        );
        
        // Build request body (OpenAI Chat Completions format)
        let body = json!({
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 500
        });
        
        // Send request
        let response = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| Error::Translate(format!("HTTP request failed: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::Translate(format!("API error {}: {}", status, error_text)));
        }
        
        // Parse response
        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| Error::Translate(format!("Failed to parse response: {}", e)))?;
        
        let translated_text = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| Error::Translate("Invalid response format".to_string()))?
            .to_string();
        
        Ok(TranslateResponse {
            translated_text,
        })
    }
    
    async fn test_connection(&self) -> Result<()> {
        let client = Client::new();
        
        // Send minimal test request
        let body = json!({
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": "hi"
                }
            ],
            "max_tokens": 1
        });
        
        let response = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| Error::Translate(format!("Connection test failed: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::Translate(format!("API error {}: {}", status, error_text)));
        }
        
        Ok(())
    }
}
