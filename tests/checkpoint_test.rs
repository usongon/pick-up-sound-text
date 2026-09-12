use pick_up_sound_text::checkpoint::{Checkpoint, SegmentProgress, SegmentStatus};
use std::path::PathBuf;

#[test]
fn test_checkpoint_save_load() {
    let mut checkpoint = Checkpoint::new(
        "test_task".to_string(),
        PathBuf::from("test.mp4"),
    );

    checkpoint.segments.push(SegmentProgress {
        segment_id: 0,
        start_time: 0.0,
        end_time: 600.0,
        status: SegmentStatus::Completed,
        subtitle_file: "segment_0.srt".to_string(),
    });

    let path = PathBuf::from("/tmp/test_checkpoint.jsonl");
    checkpoint.save(&path).unwrap();

    let loaded = Checkpoint::load(&path).unwrap();
    assert_eq!(loaded.task_id, "test_task");
    assert_eq!(loaded.video_path, PathBuf::from("test.mp4"));
    assert_eq!(loaded.segments.len(), 1);
    assert_eq!(loaded.segments[0].status, SegmentStatus::Completed);
}

#[test]
fn test_checkpoint_jsonl_format() {
    let mut checkpoint = Checkpoint::new(
        "xxx".to_string(),
        PathBuf::from("/path/to/video.mp4"),
    );

    checkpoint.segments.push(SegmentProgress {
        segment_id: 0,
        start_time: 0.0,
        end_time: 600.0,
        status: SegmentStatus::Completed,
        subtitle_file: "segment_0.srt".to_string(),
    });
    checkpoint.segments.push(SegmentProgress {
        segment_id: 1,
        start_time: 595.0,
        end_time: 1200.0,
        status: SegmentStatus::Pending,
        subtitle_file: "segment_1.srt".to_string(),
    });

    let path = PathBuf::from("/tmp/test_checkpoint_format.jsonl");
    checkpoint.save(&path).unwrap();

    // Verify the on-disk format is JSONL: first line is metadata, then one
    // segment per line.
    let content = std::fs::read_to_string(&path).unwrap();
    let lines: Vec<&str> = content.lines().collect();
    assert_eq!(lines.len(), 3);
    assert!(lines[0].contains("\"task_id\":\"xxx\""));
    assert!(lines[0].contains("\"video_path\":\"/path/to/video.mp4\""));
    assert!(lines[1].contains("\"segment_id\":0"));
    assert!(lines[1].contains("\"status\":\"Completed\""));
    assert!(lines[2].contains("\"segment_id\":1"));
    assert!(lines[2].contains("\"status\":\"Pending\""));

    // Round-trip via load.
    let loaded = Checkpoint::load(&path).unwrap();
    assert_eq!(loaded.task_id, "xxx");
    assert_eq!(loaded.segments.len(), 2);
    assert_eq!(loaded.segments[1].segment_id, 1);
    assert_eq!(loaded.segments[1].status, SegmentStatus::Pending);
}

#[test]
fn test_next_pending_segment() {
    let mut checkpoint = Checkpoint::new(
        "test_task".to_string(),
        PathBuf::from("test.mp4"),
    );

    checkpoint.segments.push(SegmentProgress {
        segment_id: 0,
        start_time: 0.0,
        end_time: 600.0,
        status: SegmentStatus::Completed,
        subtitle_file: "segment_0.srt".to_string(),
    });

    checkpoint.segments.push(SegmentProgress {
        segment_id: 1,
        start_time: 595.0,
        end_time: 1200.0,
        status: SegmentStatus::Pending,
        subtitle_file: "segment_1.srt".to_string(),
    });

    assert_eq!(checkpoint.next_pending_segment(), Some(1));
}
