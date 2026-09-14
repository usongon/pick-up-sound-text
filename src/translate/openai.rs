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
            format!("Previous context:\n{}\n\n", req.context.join("\n"))
        };
        
        // Build messages with system prompt and few-shot examples
        let messages = vec![
            json!({
                "role": "system",
                "content": "You are a professional subtitle translator. Translate the given text naturally and accurately, preserving the tone, style, and context. Avoid literal word-for-word translation. Focus on conveying the meaning in fluent, idiomatic target language."
            }),
            json!({
                "role": "user",
                "content": "Translate from en to zh:\n\nWe have main engine start, 4, 3, 2, 1."
            }),
            json!({
                "role": "assistant",
                "content": "主发动机启动，4、3、2、1。"
            }),
            json!({
                "role": "user",
                "content": "Translate from en to zh:\n\nYou have your robotics, and I just want to be awesome in space."
            }),
            json!({
                "role": "assistant",
                "content": "你有你的机器人技术，而我只想在太空中大显身手。"
            }),
            json!({
                "role": "user",
                "content": format!("{}Translate from {} to {}:\n\n{}", context_text, req.source_lang, req.target_lang, req.text)
            })
        ];
        
        // Build request body (OpenAI Chat Completions format)
        let body = json!({
            "model": self.model,
            "messages": messages,
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
