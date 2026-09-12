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

    let path = PathBuf::from("/tmp/test_checkpoint.json");
    checkpoint.save(&path).unwrap();

    let loaded = Checkpoint::load(&path).unwrap();
    assert_eq!(loaded.task_id, "test_task");
    assert_eq!(loaded.segments.len(), 1);
    assert_eq!(loaded.segments[0].status, SegmentStatus::Completed);
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
