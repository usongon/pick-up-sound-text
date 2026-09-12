use pick_up_sound_text::file_audio_source::FileAudioSource;
use pick_up_sound_text::audio_source::AudioSource;
use std::path::PathBuf;
use std::time::Duration;

#[tokio::test]
async fn test_file_audio_source_creation() {
    // This test requires a sample video file
    // For now, we'll just test the structure
    let path = PathBuf::from("test.mp4");
    // Skip actual test if file doesn't exist
    if !path.exists() {
        return;
    }

    let source = FileAudioSource::new(path).await;
    assert!(source.is_ok());
}

#[tokio::test]
async fn test_seek_support() {
    let path = PathBuf::from("test.mp4");
    if !path.exists() {
        return;
    }

    let mut source = FileAudioSource::new(path).await.unwrap();
    assert!(source.supports_seek());
    assert!(source.total_duration().is_some());

    let seek_result = source.seek(Duration::from_secs(10)).await;
    assert!(seek_result.is_ok());
}
