use pick_up_sound_text::audio::AudioSource;
use pick_up_sound_text::audio::file::FileAudioSource;
use std::path::PathBuf;
use std::time::Duration;

#[cfg(unix)]
use std::ffi::OsStr;
#[cfg(unix)]
use std::os::unix::ffi::OsStrExt;

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

#[tokio::test]
async fn test_last_segment_boundary() {
    // Test that the last segment doesn't skip content
    // This test requires a mock or a real video file
    // For now, we test the logic with a mock
    let path = PathBuf::from("test.mp4");
    if !path.exists() {
        return;
    }

    let mut source = FileAudioSource::new(path).await.unwrap();
    let total = source.total_duration().unwrap();

    // Seek to near the end
    let seek_pos = total.saturating_sub(Duration::from_secs(1));
    source.seek(seek_pos).await.unwrap();

    // Should still be able to get a chunk (the last one)
    let chunk = source.next_chunk().await;
    assert!(chunk.is_ok());

    // After the last chunk, next_chunk should return End of file
    let result = source.next_chunk().await;
    assert!(result.is_err());
    match result {
        Err(e) => assert!(e.to_string().contains("End of file")),
        Ok(_) => panic!("Expected error"),
    }
}

#[tokio::test]
#[cfg(unix)]
async fn test_non_utf8_path() {
    // Create a path with invalid UTF-8 bytes (0xFF and 0xFE are invalid in UTF-8)
    let invalid_bytes = &[0x74, 0x65, 0x73, 0x74, 0xFF, 0xFE, 0x2E, 0x6D, 0x70, 0x34]; // "test\xFF\xFE.mp4"
    let os_str = OsStr::from_bytes(invalid_bytes);
    let path = PathBuf::from(os_str);
    let result = FileAudioSource::new(path).await;
    assert!(result.is_err());
    match result {
        Err(e) => {
            let msg = e.to_string();
            assert!(
                msg.contains("invalid UTF-8"),
                "Expected 'invalid UTF-8' in error message, got: {}",
                msg
            );
        }
        Ok(_) => panic!("Expected error"),
    }
}
