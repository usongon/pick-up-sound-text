use serde::{Deserialize, Serialize};
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
    pub segments: Vec<SegmentProgress>,
}

impl Checkpoint {
    pub fn new(task_id: String, video_path: PathBuf) -> Self {
        Self {
            task_id,
            video_path,
            segments: Vec::new(),
        }
    }

    pub fn save(&self, path: &PathBuf) -> Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn load(path: &PathBuf) -> Result<Self> {
        let json = std::fs::read_to_string(path)?;
        let checkpoint = serde_json::from_str(&json)?;
        Ok(checkpoint)
    }

    pub fn next_pending_segment(&self) -> Option<usize> {
        self.segments
            .iter()
            .find(|s| s.status == SegmentStatus::Pending)
            .map(|s| s.segment_id)
    }
}
