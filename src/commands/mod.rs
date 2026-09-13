use pick_up_sound_text::asr::DashScopeAsrProvider;
use pick_up_sound_text::audio::FileAudioSource;
use pick_up_sound_text::config::AppConfig;
use pick_up_sound_text::pipeline::{FilePipeline, PipelineState};
use pick_up_sound_text::subtitle::{generate_srt, generate_vtt, SubtitleEntry};
use pick_up_sound_text::translate::OpenAiCompatibleProvider;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

pub struct AppState {
    pub pipeline_state: Arc<Mutex<Option<Arc<Mutex<PipelineState>>>>>,
    pub pipeline_entries: Arc<Mutex<Option<Arc<Mutex<Vec<SubtitleEntry>>>>>>,
    pub processing_task: Arc<Mutex<Option<JoinHandle<()>>>>,
    pub config: Arc<Mutex<AppConfig>>,
    pub pipeline: Arc<Mutex<Option<FilePipeline>>>,
    pub pipeline_progress: Arc<Mutex<Option<Arc<Mutex<f64>>>>>,
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
    let mut pipeline = FilePipeline::new(
        Box::new(audio_source),
        Box::new(asr_provider),
        Box::new(translate_provider),
        config.clone(),
    );

    // Stable task_id from video path so re-processing the same file resumes
    let task_id = format!("{:x}", md5ish(video_path.to_string_lossy().as_bytes()));
    pipeline
        .init_checkpoint(task_id.clone(), video_path.clone())
        .map_err(|e| e.to_string())?;

    // Get shared state handles
    let state_handle = pipeline.state_handle();
    let entries_handle = pipeline.entries_handle();
    let progress_handle = pipeline.progress_handle();

    // Store handles in app state
    let mut pipeline_state_guard = state.pipeline_state.lock().await;
    *pipeline_state_guard = Some(state_handle.clone());
    drop(pipeline_state_guard);

    let mut pipeline_entries_guard = state.pipeline_entries.lock().await;
    *pipeline_entries_guard = Some(entries_handle.clone());
    drop(pipeline_entries_guard);

    let mut pipeline_progress_guard = state.pipeline_progress.lock().await;
    *pipeline_progress_guard = Some(progress_handle);
    drop(pipeline_progress_guard);

    // Store pipeline reference
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

    Ok(task_id)
}

/// Simple non-cryptographic hash for task_id derivation (FNV-1a).
fn md5ish(data: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &b in data {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

#[tauri::command]
pub async fn get_processing_progress(state: State<'_, AppState>) -> Result<f64, String> {
    let pipeline_state_guard = state.pipeline_state.lock().await;

    if let Some(state_handle) = pipeline_state_guard.as_ref() {
        let pipeline_state = state_handle.lock().await.clone();
        match pipeline_state {
            PipelineState::Completed | PipelineState::Exported => Ok(1.0),
            PipelineState::Failed => Ok(0.0),
            _ => {
                let progress_guard = state.pipeline_progress.lock().await;
                if let Some(progress_handle) = progress_guard.as_ref() {
                    let p = *progress_handle.lock().await;
                    Ok(p)
                } else {
                    Ok(0.0)
                }
            }
        }
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
pub async fn export_subtitle(
    format: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let entries = {
        let guard = state.pipeline_entries.lock().await;
        match guard.as_ref() {
            Some(handle) => handle.lock().await.clone(),
            None => return Err("No pipeline available".to_string()),
        }
    };

    let (content, ext, title) = match format.as_str() {
        "srt" => (generate_srt(&entries), "srt", "Save SRT subtitle"),
        "vtt" => (generate_vtt(&entries), "vtt", "Save VTT subtitle"),
        _ => return Err(format!("Unsupported format: {}", format)),
    };

    let file_path = app.dialog()
        .file()
        .set_title(title)
        .set_file_name(format!("output.{}", ext))
        .add_filter(format!("{} Subtitle", ext.to_uppercase()), &[ext])
        .blocking_save_file();

    if let Some(path) = file_path {
        let path_buf = path.into_path().map_err(|e| e.to_string())?;
        std::fs::write(&path_buf, content).map_err(|e| e.to_string())?;
        Ok(path_buf.to_string_lossy().to_string())
    } else {
        Err("Save cancelled".to_string())
    }
}
