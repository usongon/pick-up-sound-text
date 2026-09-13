use crate::asr::{AsrConfig, AsrEvent, AsrProvider, AsrStream};
use crate::Result;
use async_trait::async_trait;

pub struct DashScopeAsrProvider;

#[async_trait]
impl AsrProvider for DashScopeAsrProvider {
    async fn start_stream(&self, config: &AsrConfig) -> Result<Box<dyn AsrStream>> {
        Ok(Box::new(DashScopeAsrStream {
            config: config.clone(),
            event_count: 0,
        }))
    }
}

struct DashScopeAsrStream {
    #[allow(dead_code)]
    config: AsrConfig,
    event_count: usize,
}

#[async_trait]
impl AsrStream for DashScopeAsrStream {
    async fn send_audio(&mut self, _pcm: &[i16]) -> Result<()> {
        // TODO: Implement WebSocket audio streaming
        Ok(())
    }

    async fn next_event(&mut self) -> Result<AsrEvent> {
        // TODO: Implement WebSocket event receiving
        // For placeholder, return one Final event then EndOfStream
        if self.event_count == 0 {
            self.event_count += 1;
            Ok(AsrEvent::Final {
                text: "placeholder".to_string(),
                ts_start: 0.0,
                ts_end: 1.0,
            })
        } else {
            Ok(AsrEvent::EndOfStream)
        }
    }
}
