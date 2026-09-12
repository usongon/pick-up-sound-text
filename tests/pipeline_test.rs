use pick_up_sound_text::pipeline::{FilePipeline, PipelineState};

#[tokio::test]
async fn test_pipeline_state_transitions() {
    // This test requires mock implementations
    // For now, just test the state enum
    assert_eq!(PipelineState::Idle, PipelineState::Idle);
    assert_ne!(PipelineState::Idle, PipelineState::Processing);
}
