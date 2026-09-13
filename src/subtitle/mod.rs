use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SubtitleStatus {
    Partial,
    Final,
    Refined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleEntry {
    pub content_start: f64,
    pub content_end: f64,
    pub wall_start: i64,
    pub wall_end: i64,
    pub source: String,
    pub translated: String,
    pub status: SubtitleStatus,
}

impl SubtitleEntry {
    pub fn to_srt_format(&self, index: usize) -> String {
        format!(
            "{}\n{} --> {}\n{}\n{}\n",
            index,
            Self::format_timestamp_srt(self.content_start),
            Self::format_timestamp_srt(self.content_end),
            self.source,
            self.translated
        )
    }
    
    pub fn to_vtt_format(&self) -> String {
        format!(
            "{} --> {}\n{}\n{}\n",
            Self::format_timestamp_vtt(self.content_start),
            Self::format_timestamp_vtt(self.content_end),
            self.source,
            self.translated
        )
    }

    fn format_timestamp_srt(seconds: f64) -> String {
        let hours = (seconds / 3600.0) as u32;
        let minutes = ((seconds % 3600.0) / 60.0) as u32;
        let secs = (seconds % 60.0) as u32;
        let millis = ((seconds % 1.0) * 1000.0) as u32;
        format!("{:02}:{:02}:{:02},{:03}", hours, minutes, secs, millis)
    }
    
    fn format_timestamp_vtt(seconds: f64) -> String {
        let hours = (seconds / 3600.0) as u32;
        let minutes = ((seconds % 3600.0) / 60.0) as u32;
        let secs = (seconds % 60.0) as u32;
        let millis = ((seconds % 1.0) * 1000.0) as u32;
        format!("{:02}:{:02}:{:02}.{:03}", hours, minutes, secs, millis)
    }
}

pub fn generate_srt(entries: &[SubtitleEntry]) -> String {
    entries
        .iter()
        .enumerate()
        .map(|(i, entry)| entry.to_srt_format(i + 1))
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn generate_vtt(entries: &[SubtitleEntry]) -> String {
    let mut vtt = String::from("WEBVTT\n\n");
    vtt.push_str(
        &entries
            .iter()
            .map(|entry| entry.to_vtt_format())
            .collect::<Vec<_>>()
            .join("\n")
    );
    vtt
}
