use pick_up_sound_text::asr::DashScopeAsrProvider;
use pick_up_sound_text::audio::FileAudioSource;
use pick_up_sound_text::pipeline::{FilePipeline, PipelineState};
use pick_up_sound_text::subtitle::generate_srt;
use pick_up_sound_text::translate::OpenAiCompatibleProvider;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct AppState {
    pub pipeline: Arc<Mutex<Option<FilePipeline>>>,
}

#[tauri::command]
pub async fn start_file_processing(
    video_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let video_path = PathBuf::from(video_path);

    // Create audio source
    let audio_source = FileAudioSource::new(video_path.clone())
        .await
        .map_err(|e| e.to_string())?;

    // Create ASR provider
    let asr_provider = DashScopeAsrProvider;

    // Create translate provider
    let translate_provider = OpenAiCompatibleProvider {
        base_url: "https://api.openai.com/v1".to_string(),
        model: "gpt-3.5-turbo".to_string(),
        api_key: "".to_string(), // TODO: Get from config
    };

    // Create pipeline
    let pipeline = FilePipeline::new(
        Box::new(audio_source),
        Box::new(asr_provider),
        Box::new(translate_provider),
    );

    // Store pipeline in state
    let mut pipeline_guard = state.pipeline.lock().await;
    *pipeline_guard = Some(pipeline);
    drop(pipeline_guard);

    // Start processing in background
    let pipeline_clone = state.pipeline.clone();
    tokio::spawn(async move {
        let mut pipeline_guard = pipeline_clone.lock().await;
        if let Some(pipeline) = pipeline_guard.as_mut() {
            if let Err(e) = pipeline.process().await {
                eprintln!("Pipeline error: {}", e);
            }
        }
    });

    Ok("Processing started".to_string())
}

#[tauri::command]
pub async fn get_processing_progress(state: State<'_, AppState>) -> Result<f64, String> {
    let pipeline_guard = state.pipeline.lock().await;

    if let Some(pipeline) = pipeline_guard.as_ref() {
        let state = pipeline.get_state().await;
        match state {
            PipelineState::Idle => Ok(0.0),
            PipelineState::Processing => {
                // TODO: Calculate actual progress based on segments
                Ok(0.5)
            }
            PipelineState::Completed => Ok(1.0),
            PipelineState::Exported => Ok(1.0),
            PipelineState::Failed => Ok(0.0),
        }
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
pub async fn export_subtitle(format: String, state: State<'_, AppState>) -> Result<String, String> {
    let pipeline_guard = state.pipeline.lock().await;

    if let Some(pipeline) = pipeline_guard.as_ref() {
        let entries = pipeline.get_entries().await;

        match format.as_str() {
            "srt" => {
                let srt = generate_srt(&entries);
                let output_path = "output.srt";
                std::fs::write(output_path, srt)
                    .map_err(|e| e.to_string())?;
                Ok(output_path.to_string())
            }
            "vtt" => {
                // TODO: Implement VTT generation
                Err("VTT export not yet implemented".to_string())
            }
            _ => Err(format!("Unsupported format: {}", format)),
        }
    } else {
        Err("No pipeline available".to_string())
    }
}
