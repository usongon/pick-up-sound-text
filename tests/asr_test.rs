use pick_up_sound_text::asr::AsrProvider;
use pick_up_sound_text::asr::{AsrConfig, AsrEvent};
use pick_up_sound_text::asr_dashscope::DashScopeAsrProvider;

#[tokio::test]
async fn test_dashscope_provider_creation() {
    let provider = DashScopeAsrProvider;
    let config = AsrConfig {
        provider: "dashscope".to_string(),
        model: "paraformer-realtime-v2".to_string(),
        api_key: "test_key".to_string(),
        language: "auto".to_string(),
    };

    let stream = provider.start_stream(&config).await;
    assert!(stream.is_ok());
}

#[tokio::test]
async fn test_dashscope_stream_placeholder_event() {
    let provider = DashScopeAsrProvider;
    let config = AsrConfig {
        provider: "dashscope".to_string(),
        model: "paraformer-realtime-v2".to_string(),
        api_key: "test_key".to_string(),
        language: "auto".to_string(),
    };

    let mut stream = provider.start_stream(&config).await.expect("start_stream");
    stream.send_audio(&[0i16; 160]).await.expect("send_audio");
    let event = stream.next_event().await.expect("next_event");
    match event {
        AsrEvent::Final { text, .. } => assert_eq!(text, "placeholder"),
        other => panic!("expected Final placeholder, got {:?}", other),
    }
}
