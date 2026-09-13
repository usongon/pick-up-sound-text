//! File-mode pipeline state machine.
//!
//! Orchestrates audio source -> ASR -> translation -> subtitle entries.
//! Also owns overlap de-duplication between consecutive ASR results
//! (Ruling: implemented here, not in `FileAudioSource`).

use std::sync::Arc;
use tokio::sync::Mutex;

use crate::asr::{AsrConfig, AsrEvent, AsrProvider};
use crate::audio::AudioSource;
use crate::checkpoint::{Checkpoint, SegmentProgress, SegmentStatus};
use crate::config::AppConfig;
use crate::error::Error;
use crate::subtitle::{SubtitleEntry, SubtitleStatus};
use crate::translate::{TranslateProvider, TranslateRequest};
use crate::Result;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq)]
pub enum PipelineState {
    Idle,
    Processing,
    Completed,
    Exported,
    Failed,
}

pub struct FilePipeline {
    state: Arc<Mutex<PipelineState>>,
    audio_source: Box<dyn AudioSource>,
    asr_provider: Box<dyn AsrProvider>,
    translate_provider: Box<dyn TranslateProvider>,
    entries: Arc<Mutex<Vec<SubtitleEntry>>>,
    config: AppConfig,
    source_language: String,
    checkpoint: Option<Checkpoint>,
    checkpoint_path: Option<PathBuf>,
    total_segments: usize,
    completed_segments: usize,
    progress: Arc<Mutex<f64>>,
}

impl FilePipeline {
    pub fn new(
        audio_source: Box<dyn AudioSource>,
        asr_provider: Box<dyn AsrProvider>,
        translate_provider: Box<dyn TranslateProvider>,
        config: AppConfig,
        source_language: String,
    ) -> Self {
        Self {
            state: Arc::new(Mutex::new(PipelineState::Idle)),
            audio_source,
            asr_provider,
            translate_provider,
            entries: Arc::new(Mutex::new(Vec::new())),
            config,
            source_language,
            checkpoint: None,
            checkpoint_path: None,
            total_segments: 0,
            completed_segments: 0,
            progress: Arc::new(Mutex::new(0.0)),
        }
    }
    
    /// Initialize checkpoint for resume from breakpoint
    pub fn init_checkpoint(&mut self, task_id: String, video_path: PathBuf) -> Result<()> {
        let checkpoint_dir = dirs::home_dir()
            .ok_or_else(|| Error::Config("Cannot find home directory".to_string()))?
            .join("Library/Application Support/pick-up-sound-text/tasks")
            .join(&task_id);
        
        std::fs::create_dir_all(&checkpoint_dir)?;
        let checkpoint_path = checkpoint_dir.join("progress.jsonl");
        
        let checkpoint = if checkpoint_path.exists() {
            Checkpoint::load(&checkpoint_path)?
        } else {
            Checkpoint::new(task_id, video_path)
        };
        
        self.checkpoint = Some(checkpoint);
        self.checkpoint_path = Some(checkpoint_path);
        
        Ok(())
    }
    
    /// Get real progress based on completed segments
    pub async fn get_progress(&self) -> f64 {
        *self.progress.lock().await
    }

    /// Shared progress handle for external polling without locking the pipeline.
    pub fn progress_handle(&self) -> Arc<Mutex<f64>> {
        self.progress.clone()
    }

    pub async fn process(&mut self) -> Result<()> {
        let mut state = self.state.lock().await;
        *state = PipelineState::Processing;
        drop(state);

        // Calculate total segments
        let segment_duration = 600.0; // 10 minutes
        if let Some(total_duration) = self.audio_source.total_duration() {
            self.total_segments = (total_duration.as_secs_f64() / segment_duration).ceil() as usize;
        }

        // Resume from checkpoint: seek past completed segments
        if let Some(checkpoint) = &self.checkpoint {
            let completed = checkpoint
                .segments
                .iter()
                .filter(|s| s.status == SegmentStatus::Completed)
                .count();
            if completed > 0 && self.audio_source.supports_seek() {
                let resume_pos = std::time::Duration::from_secs_f64(completed as f64 * segment_duration);
                self.audio_source.seek(resume_pos).await?;
                self.completed_segments = completed;
                if self.total_segments > 0 {
                    let mut p = self.progress.lock().await;
                    *p = completed as f64 / self.total_segments as f64;
                }
                tracing::info!("Resuming from segment {} ({}s)", completed, resume_pos.as_secs_f64());
            }
        }

        let mut previous_entries: Vec<SubtitleEntry> = Vec::new();

        loop {
            // Get next audio chunk
            let chunk = match self.audio_source.next_chunk().await {
                Ok(chunk) => chunk,
                Err(Error::AudioSource(msg)) if msg == "End of file" => break,
                Err(e) => {
                    let mut state = self.state.lock().await;
                    *state = PipelineState::Failed;
                    return Err(e);
                }
            };

            // Start ASR stream
            let asr_config = AsrConfig {
                provider: self.config.asr.provider.clone(),
                model: self.config.asr.model.clone(),
                api_key: self.config.asr.api_key.clone(),
                language: self.source_language.clone(),
            };
            let mut asr_stream = self.asr_provider.start_stream(&asr_config).await?;

            // Send audio in 100ms frames (3200 samples at 16kHz) to stay
            // within WebSocket message size limits and let the server
            // process incrementally.
            const SAMPLES_PER_FRAME: usize = 3200;
            for frame in chunk.pcm.chunks(SAMPLES_PER_FRAME) {
                asr_stream.send_audio(frame).await?;
            }
            asr_stream.finish().await?;

            // Process ASR events
            let mut segment_entries = Vec::new();
            loop {
                match asr_stream.next_event().await {
                    Ok(AsrEvent::Partial { .. }) => {
                        // Skip partial results for file processing
                        continue;
                    }
                    Ok(AsrEvent::Final { text, ts_start, ts_end }) => {
                        // Translate the final text
                        let translate_req = TranslateRequest {
                            text: text.clone(),
                            source_lang: "auto".to_string(),
                            target_lang: self.config.translate.target_lang.clone(),
                            context: previous_entries.iter()
                                .rev()
                                .take(10)
                                .map(|e| e.source.clone())
                                .collect(),
                            glossary: None,
                        };
                        let translate_resp = self.translate_provider.translate(translate_req).await?;

                        // Create subtitle entry
                        let entry = SubtitleEntry {
                            content_start: chunk.content_time_ms as f64 / 1000.0 + ts_start,
                            content_end: chunk.content_time_ms as f64 / 1000.0 + ts_end,
                            wall_start: chunk.wall_time_ms + (ts_start * 1000.0) as i64,
                            wall_end: chunk.wall_time_ms + (ts_end * 1000.0) as i64,
                            source: text,
                            translated: translate_resp.translated_text,
                            status: SubtitleStatus::Final,
                        };
                        segment_entries.push(entry);
                    }
                    Ok(AsrEvent::Error { code, message }) => {
                        let mut state = self.state.lock().await;
                        *state = PipelineState::Failed;
                        return Err(Error::Asr(format!("{}: {}", code, message)));
                    }
                    Ok(AsrEvent::EndOfStream) => {
                        // End of ASR stream for this chunk
                        break;
                    }
                    Err(e) => {
                        // Real ASR error (network, quota, auth, etc.)
                        let mut state = self.state.lock().await;
                        *state = PipelineState::Failed;
                        return Err(e);
                    }
                }
            }

            // De-duplicate overlap with previous segment
            if !previous_entries.is_empty() && !segment_entries.is_empty() {
                let last_prev = previous_entries.last().unwrap();
                let first_curr = segment_entries.first().unwrap();
                let deduped_text = dedup_overlap(&last_prev.source, &first_curr.source, 50);
                if !deduped_text.is_empty() && deduped_text != first_curr.source {
                    // Calculate overlap ratio for timestamp adjustment
                    let overlap_chars = first_curr.source.chars().count() - deduped_text.chars().count();
                    let total_chars = first_curr.source.chars().count();
                    let overlap_ratio = overlap_chars as f64 / total_chars as f64;
                    
                    // Adjust first entry of current segment
                    let first_entry = &mut segment_entries[0];
                    first_entry.source = deduped_text.clone();
                    
                    // Proportionally adjust timestamps
                    let duration = first_entry.content_end - first_entry.content_start;
                    first_entry.content_start += duration * overlap_ratio;
                    
                    let wall_duration = first_entry.wall_end - first_entry.wall_start;
                    first_entry.wall_start += (wall_duration as f64 * overlap_ratio) as i64;
                    
                    // Re-translate the deduped text to keep source and translated consistent
                    let translate_req = TranslateRequest {
                        text: deduped_text,
                        source_lang: "auto".to_string(),
                        target_lang: self.config.translate.target_lang.clone(),
                        context: previous_entries.iter()
                            .rev()
                            .take(10)
                            .map(|e| e.source.clone())
                            .collect(),
                        glossary: None,
                    };
                    let translate_resp = self.translate_provider.translate(translate_req).await?;
                    first_entry.translated = translate_resp.translated_text;
                }
            }

            // Add segment entries to entries
            let mut entries = self.entries.lock().await;
            entries.extend(segment_entries.iter().cloned());
            drop(entries);

            // Save checkpoint after each segment
            if let (Some(checkpoint), Some(checkpoint_path)) = (&mut self.checkpoint, &self.checkpoint_path) {
                let segment_id = self.completed_segments;
                let chunk_duration_secs = chunk.pcm.len() as f64 / 16000.0;
                checkpoint.segments.push(SegmentProgress {
                    segment_id,
                    start_time: chunk.content_time_ms as f64 / 1000.0,
                    end_time: chunk.content_time_ms as f64 / 1000.0 + chunk_duration_secs,
                    status: SegmentStatus::Completed,
                    subtitle_file: format!("segment_{}.srt", segment_id),
                });
                checkpoint.save(checkpoint_path)?;
            }

            self.completed_segments += 1;
            if self.total_segments > 0 {
                let mut p = self.progress.lock().await;
                *p = self.completed_segments as f64 / self.total_segments as f64;
            }
            previous_entries = segment_entries;
        }

        let mut state = self.state.lock().await;
        *state = PipelineState::Completed;

        Ok(())
    }

    pub async fn get_state(&self) -> PipelineState {
        self.state.lock().await.clone()
    }

    pub async fn get_entries(&self) -> Vec<SubtitleEntry> {
        self.entries.lock().await.clone()
    }

    /// Get a clone of the shared state Arc for external monitoring.
    pub fn state_handle(&self) -> Arc<Mutex<PipelineState>> {
        self.state.clone()
    }

    /// Get a clone of the shared entries Arc for external access.
    pub fn entries_handle(&self) -> Arc<Mutex<Vec<SubtitleEntry>>> {
        self.entries.clone()
    }
}

/// De-duplicate overlap between two consecutive ASR text segments.
///
/// Finds the longest suffix of `prev` that is also a prefix of `next`
/// (bounded by `max_overlap` chars) and returns `next` with that overlap
/// stripped. Comparison is done on trimmed lowercase text to be robust
/// against minor ASR whitespace/case jitter.
pub fn dedup_overlap(prev: &str, next: &str, max_overlap: usize) -> String {
    if prev.is_empty() || next.is_empty() || max_overlap == 0 {
        return next.to_string();
    }

    let prev_chars: Vec<char> = prev.trim_end().chars().collect();
    let next_chars: Vec<char> = next.chars().collect();

    let upper = max_overlap.min(prev_chars.len()).min(next_chars.len());
    let mut best = 0;
    for k in 1..=upper {
        let prev_suffix = &prev_chars[prev_chars.len() - k..];
        let next_prefix = &next_chars[..k];
        if prev_suffix
            .iter()
            .zip(next_prefix.iter())
            .all(|(a, b)| a.eq_ignore_ascii_case(b))
        {
            best = k;
        }
    }

    next_chars[best..].iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dedup_no_overlap() {
        assert_eq!(dedup_overlap("hello", "world", 10), "world");
    }

    #[test]
    fn dedup_with_overlap() {
        assert_eq!(dedup_overlap("hello world", "world again", 10), " again");
    }

    #[test]
    fn dedup_respects_max_overlap() {
        // overlap is 5 ("world"), but max_overlap=3 -> no dedup
        assert_eq!(
            dedup_overlap("hello world", "world again", 3),
            "world again"
        );
    }

    #[test]
    fn dedup_empty_inputs() {
        assert_eq!(dedup_overlap("", "abc", 10), "abc");
        assert_eq!(dedup_overlap("abc", "", 10), "");
    }

    #[test]
    fn dedup_case_insensitive() {
        assert_eq!(dedup_overlap("Hello World", "world again", 10), " again");
    }
}
