use pick_up_sound_text::asr::DashScopeAsrProvider;
use pick_up_sound_text::audio::FileAudioSource;
use pick_up_sound_text::config::AppConfig;
use pick_up_sound_text::pipeline::{FilePipeline, PipelineState};
use pick_up_sound_text::subtitle::{generate_srt, SubtitleEntry};
use pick_up_sound_text::translate::OpenAiCompatibleProvider;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

pub struct AppState {
    pub pipeline_state: Arc<Mutex<Option<Arc<Mutex<PipelineState>>>>>,
    pub pipeline_entries: Arc<Mutex<Option<Arc<Mutex<Vec<SubtitleEntry>>>>>>,
    pub processing_task: Arc<Mutex<Option<JoinHandle<()>>>>,
    pub config: Arc<Mutex<AppConfig>>,
    pub pipeline: Arc<Mutex<Option<FilePipeline>>>,
}

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().await;
    Ok(config.clone())
}

#[tauri::command]
pub async fn save_config(config: AppConfig, state: State<'_, AppState>) -> Result<(), String> {
    let mut config_guard = state.config.lock().await;
    *config_guard = config.clone();
    config.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn start_file_processing(
    video_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let video_path = PathBuf::from(video_path);

    // Get config
    let config = state.config.lock().await.clone();

    // Create audio source
    let audio_source = FileAudioSource::new(video_path.clone())
        .await
        .map_err(|e| e.to_string())?;

    // Create ASR provider
    let asr_provider = DashScopeAsrProvider;

    // Create translate provider
    let translate_provider = OpenAiCompatibleProvider {
        base_url: config.translate.base_url.clone(),
        model: config.translate.model.clone(),
        api_key: config.translate.api_key.clone(),
    };

    // Create pipeline
    let pipeline = FilePipeline::new(
        Box::new(audio_source),
        Box::new(asr_provider),
        Box::new(translate_provider),
        config.clone(),
    );

    // Get shared state handles
    let state_handle = pipeline.state_handle();
    let entries_handle = pipeline.entries_handle();

    // Store handles in app state
    let mut pipeline_state_guard = state.pipeline_state.lock().await;
    *pipeline_state_guard = Some(state_handle.clone());
    drop(pipeline_state_guard);

    let mut pipeline_entries_guard = state.pipeline_entries.lock().await;
    *pipeline_entries_guard = Some(entries_handle.clone());
    drop(pipeline_entries_guard);

    // Store pipeline reference for progress calculation
    let mut pipeline_guard = state.pipeline.lock().await;
    *pipeline_guard = Some(pipeline);
    drop(pipeline_guard);

    // Start processing in background
    let pipeline_clone = state.pipeline.clone();
    let processing_task = tokio::spawn(async move {
        let mut pipeline_guard = pipeline_clone.lock().await;
        if let Some(pipeline) = pipeline_guard.as_mut() {
            if let Err(e) = pipeline.process().await {
                tracing::error!("Pipeline error: {}", e);
            }
        }
    });

    // Store task handle
    let mut task_guard = state.processing_task.lock().await;
    *task_guard = Some(processing_task);
    drop(task_guard);

    Ok("Processing started".to_string())
}

#[tauri::command]
pub async fn get_processing_progress(state: State<'_, AppState>) -> Result<f64, String> {
    let pipeline_state_guard = state.pipeline_state.lock().await;

    if let Some(state_handle) = pipeline_state_guard.as_ref() {
        let pipeline_state = state_handle.lock().await.clone();
        match pipeline_state {
            PipelineState::Idle => Ok(0.0),
            PipelineState::Processing => {
                // Get real progress from pipeline
                let pipeline_guard = state.pipeline.lock().await;
                if let Some(pipeline) = pipeline_guard.as_ref() {
                    Ok(pipeline.get_progress().await)
                } else {
                    Ok(0.0)
                }
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
    let pipeline_entries_guard = state.pipeline_entries.lock().await;

    if let Some(entries_handle) = pipeline_entries_guard.as_ref() {
        let entries = entries_handle.lock().await.clone();

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
