use async_trait::async_trait;
use crate::asr::{AsrProvider, AsrStream, AsrConfig, AsrEvent};
use crate::Result;

pub struct DashScopeAsrProvider;

#[async_trait]
impl AsrProvider for DashScopeAsrProvider {
    async fn start_stream(&self, config: &AsrConfig) -> Result<Box<dyn AsrStream>> {
        Ok(Box::new(DashScopeAsrStream {
            config: config.clone(),
        }))
    }
}

struct DashScopeAsrStream {
    #[allow(dead_code)]
    config: AsrConfig,
}

#[async_trait]
impl AsrStream for DashScopeAsrStream {
    async fn send_audio(&mut self, _pcm: &[i16]) -> Result<()> {
        // TODO: Implement WebSocket audio streaming
        Ok(())
    }

    async fn next_event(&mut self) -> Result<AsrEvent> {
        // TODO: Implement WebSocket event receiving
        Ok(AsrEvent::Final {
            text: "placeholder".to_string(),
            ts_start: 0.0,
            ts_end: 1.0,
        })
    }
}
