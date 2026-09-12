use async_trait::async_trait;
use crate::Result;

#[derive(Debug, Clone, PartialEq)]
pub enum AsrEvent {
    Partial { text: String, ts_start: f64, ts_end: f64 },
    Final { text: String, ts_start: f64, ts_end: f64 },
    Error { code: String, message: String },
}

#[derive(Debug, Clone)]
pub struct AsrConfig {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub language: String,
}

#[async_trait]
pub trait AsrProvider: Send + Sync {
    async fn start_stream(&self, config: &AsrConfig) -> Result<Box<dyn AsrStream>>;
}

#[async_trait]
pub trait AsrStream: Send + Sync {
    async fn send_audio(&mut self, pcm: &[i16]) -> Result<()>;
    async fn next_event(&mut self) -> Result<AsrEvent>;
}
