use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentProgress {
    pub segment_id: usize,
    pub start_time: f64,
    pub end_time: f64,
    pub status: SegmentStatus,
    pub subtitle_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SegmentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub task_id: String,
    pub video_path: PathBuf,
    #[serde(skip)]
    pub segments: Vec<SegmentProgress>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CheckpointMeta {
    task_id: String,
    video_path: PathBuf,
}

impl Checkpoint {
    pub fn new(task_id: String, video_path: PathBuf) -> Self {
        Self {
            task_id,
            video_path,
            segments: Vec::new(),
        }
    }

    /// Save checkpoint in JSONL format:
    /// - Line 1: metadata `{"task_id":"...","video_path":"..."}`
    /// - Line 2..N: one `SegmentProgress` JSON object per line
    pub fn save(&self, path: &PathBuf) -> Result<()> {
        let mut file = std::fs::File::create(path)?;

        let meta = CheckpointMeta {
            task_id: self.task_id.clone(),
            video_path: self.video_path.clone(),
        };
        let meta_line = serde_json::to_string(&meta)?;
        writeln!(file, "{}", meta_line)?;

        for seg in &self.segments {
            let line = serde_json::to_string(seg)?;
            writeln!(file, "{}", line)?;
        }
        Ok(())
    }

    /// Load checkpoint from JSONL format. First line is metadata, subsequent
    /// lines are `SegmentProgress` entries. Empty lines are skipped.
    pub fn load(path: &PathBuf) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let mut lines = content.lines().filter(|l| !l.trim().is_empty());

        let meta_line = lines.next().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "checkpoint file is empty",
            )
        })?;
        let meta: CheckpointMeta = serde_json::from_str(meta_line)?;

        let mut segments = Vec::new();
        for line in lines {
            let seg: SegmentProgress = serde_json::from_str(line)?;
            segments.push(seg);
        }

        Ok(Self {
            task_id: meta.task_id,
            video_path: meta.video_path,
            segments,
        })
    }

    pub fn next_pending_segment(&self) -> Option<usize> {
        self.segments
            .iter()
            .find(|s| s.status == SegmentStatus::Pending)
            .map(|s| s.segment_id)
    }
}
