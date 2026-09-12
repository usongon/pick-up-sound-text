use async_trait::async_trait;
use std::time::Duration;
use crate::Result;

#[derive(Debug, Clone)]
pub struct AudioChunk {
    pub pcm: Vec<i16>,
    pub content_time_ms: i64,
    pub wall_time_ms: i64,
}

#[async_trait]
pub trait AudioSource: Send + Sync {
    async fn next_chunk(&mut self) -> Result<AudioChunk>;
    async fn seek(&mut self, pos: Duration) -> Result<()>;
    fn supports_seek(&self) -> bool;
    fn total_duration(&self) -> Option<Duration>;
}
