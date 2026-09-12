use pick_up_sound_text::subtitle::{generate_srt, SubtitleEntry, SubtitleStatus};

#[test]
fn test_srt_generation() {
    let entries = vec![
        SubtitleEntry {
            content_start: 0.0,
            content_end: 2.5,
            wall_start: 0,
            wall_end: 2500,
            source: "Hello".to_string(),
            translated: "你好".to_string(),
            status: SubtitleStatus::Final,
        },
        SubtitleEntry {
            content_start: 2.5,
            content_end: 5.0,
            wall_start: 2500,
            wall_end: 5000,
            source: "World".to_string(),
            translated: "世界".to_string(),
            status: SubtitleStatus::Final,
        },
    ];

    let srt = generate_srt(&entries);
    assert!(srt.contains("00:00:00,000 --> 00:00:02,500"));
    assert!(srt.contains("Hello"));
    assert!(srt.contains("你好"));
}
