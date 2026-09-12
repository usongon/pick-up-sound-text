use crate::audio_source::{AudioChunk, AudioSource};
use crate::{Error, Result};
use async_trait::async_trait;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

/// Audio source that extracts audio from a video file using ffmpeg.
///
/// Segments the file into 10-minute chunks with 5-second overlap.
/// Timestamps are based on the video file's own timeline.
pub struct FileAudioSource {
    video_path: PathBuf,
    current_position: Duration,
    total_duration: Duration,
    segment_duration: Duration,
    overlap_duration: Duration,
}

impl FileAudioSource {
    /// Create a new `FileAudioSource` for the given video file.
    ///
    /// Uses `ffprobe` to determine the total duration of the file.
    pub async fn new(video_path: PathBuf) -> Result<Self> {
        let total_duration = Self::get_video_duration(&video_path).await?;
        Ok(Self {
            video_path,
            current_position: Duration::ZERO,
            total_duration,
            segment_duration: Duration::from_secs(600), // 10 minutes
            overlap_duration: Duration::from_secs(5),
        })
    }

    async fn get_video_duration(path: &PathBuf) -> Result<Duration> {
        let output = Command::new("ffprobe")
            .args(&[
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path.to_str().unwrap(),
            ])
            .output()
            .await?;

        if !output.status.success() {
            return Err(Error::AudioSource(format!(
                "ffprobe failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        let duration_str = String::from_utf8_lossy(&output.stdout);
        let duration_secs: f64 = duration_str
            .trim()
            .parse()
            .map_err(|e| Error::AudioSource(format!("Failed to parse duration: {}", e)))?;

        Ok(Duration::from_secs_f64(duration_secs))
    }

    async fn extract_audio_segment(&self, start: Duration, duration: Duration) -> Result<Vec<i16>> {
        let output = Command::new("ffmpeg")
            .args(&[
                "-i",
                self.video_path.to_str().unwrap(),
                "-ss",
                &format!("{:.3}", start.as_secs_f64()),
                "-t",
                &format!("{:.3}", duration.as_secs_f64()),
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                "-f",
                "s16le",
                "-",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await?;

        if !output.status.success() {
            return Err(Error::AudioSource("ffmpeg extraction failed".to_string()));
        }

        // Convert bytes to i16 samples
        let pcm: Vec<i16> = output
            .stdout
            .chunks_exact(2)
            .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();

        Ok(pcm)
    }
}

#[async_trait]
impl AudioSource for FileAudioSource {
    async fn next_chunk(&mut self) -> Result<AudioChunk> {
        if self.current_position >= self.total_duration {
            return Err(Error::AudioSource("End of file".to_string()));
        }

        let remaining = self.total_duration - self.current_position;
        let chunk_duration =
            std::cmp::min(self.segment_duration + self.overlap_duration, remaining);

        let pcm = self
            .extract_audio_segment(self.current_position, chunk_duration)
            .await?;

        let chunk = AudioChunk {
            pcm,
            content_time_ms: self.current_position.as_millis() as i64,
            wall_time_ms: self.current_position.as_millis() as i64,
        };

        // Move position forward by segment_duration (not including overlap)
        self.current_position += self.segment_duration;

        Ok(chunk)
    }

    async fn seek(&mut self, pos: Duration) -> Result<()> {
        if pos > self.total_duration {
            return Err(Error::AudioSource(
                "Seek position beyond file duration".to_string(),
            ));
        }
        self.current_position = pos;
        Ok(())
    }

    fn supports_seek(&self) -> bool {
        true
    }

    fn total_duration(&self) -> Option<Duration> {
        Some(self.total_duration)
    }
}
