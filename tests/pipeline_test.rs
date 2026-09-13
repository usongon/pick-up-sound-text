use pick_up_sound_text::asr::{AsrConfig, AsrEvent, AsrProvider, AsrStream};
use pick_up_sound_text::audio::{AudioChunk, AudioSource};
use pick_up_sound_text::config::AppConfig;
use pick_up_sound_text::pipeline::{FilePipeline, PipelineState};
use pick_up_sound_text::subtitle::SubtitleStatus;
use pick_up_sound_text::translate::{TranslateProvider, TranslateRequest, TranslateResponse};
use pick_up_sound_text::{Error, Result};
use async_trait::async_trait;
use std::time::Duration;

// Mock AudioSource that returns a single chunk then EOF
struct MockAudioSource {
    chunks: Vec<AudioChunk>,
    index: usize,
}

impl MockAudioSource {
    fn new(chunks: Vec<AudioChunk>) -> Self {
        Self { chunks, index: 0 }
    }
}

#[async_trait]
impl AudioSource for MockAudioSource {
    async fn next_chunk(&mut self) -> Result<AudioChunk> {
        if self.index >= self.chunks.len() {
            return Err(Error::AudioSource("End of file".to_string()));
        }
        let chunk = self.chunks[self.index].clone();
        self.index += 1;
        Ok(chunk)
    }

    async fn seek(&mut self, _pos: Duration) -> Result<()> {
        Ok(())
    }

    fn supports_seek(&self) -> bool {
        true
    }

    fn total_duration(&self) -> Option<Duration> {
        Some(Duration::from_secs(10))
    }
}

// Mock ASR Provider
struct MockAsrProvider;

#[async_trait]
impl AsrProvider for MockAsrProvider {
    async fn start_stream(&self, _config: &AsrConfig) -> Result<Box<dyn AsrStream>> {
        Ok(Box::new(MockAsrStream {
            events: vec![
                AsrEvent::Final {
                    text: "hello world".to_string(),
                    ts_start: 0.0,
                    ts_end: 1.0,
                },
            ],
            index: 0,
        }))
    }
}

struct MockAsrStream {
    events: Vec<AsrEvent>,
    index: usize,
}

#[async_trait]
impl AsrStream for MockAsrStream {
    async fn send_audio(&mut self, _pcm: &[i16]) -> Result<()> {
        Ok(())
    }

    async fn next_event(&mut self) -> Result<AsrEvent> {
        if self.index >= self.events.len() {
            // Return EndOfStream to signal end of ASR stream
            return Ok(AsrEvent::EndOfStream);
        }
        let event = self.events[self.index].clone();
        self.index += 1;
        Ok(event)
    }
}

// Mock Translate Provider
struct MockTranslateProvider;

#[async_trait]
impl TranslateProvider for MockTranslateProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResponse> {
        Ok(TranslateResponse {
            translated_text: format!("[Translated] {}", req.text),
        })
    }

    async fn test_connection(&self) -> Result<()> {
        Ok(())
    }
}

#[tokio::test]
async fn test_pipeline_state_transitions() {
    // Test the state enum
    assert_eq!(PipelineState::Idle, PipelineState::Idle);
    assert_ne!(PipelineState::Idle, PipelineState::Processing);
}

#[tokio::test]
async fn test_pipeline_process_with_mock() {
    let chunks = vec![
        AudioChunk {
            pcm: vec![0i16; 1600],
            content_time_ms: 0,
            wall_time_ms: 1000,
        },
    ];

    let mut pipeline = FilePipeline::new(
        Box::new(MockAudioSource::new(chunks)),
        Box::new(MockAsrProvider),
        Box::new(MockTranslateProvider),
        AppConfig::default(),
    );

    assert_eq!(pipeline.get_state().await, PipelineState::Idle);

    // Actually call process() and verify results
    let result = pipeline.process().await;
    assert!(result.is_ok());
    assert_eq!(pipeline.get_state().await, PipelineState::Completed);

    // Verify entries were created
    let entries = pipeline.get_entries().await;
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].source, "hello world");
    assert_eq!(entries[0].translated, "[Translated] hello world");
    assert_eq!(entries[0].status, SubtitleStatus::Final);
    assert_eq!(entries[0].content_start, 0.0);
    assert_eq!(entries[0].content_end, 1.0);
}
