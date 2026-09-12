use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;
use pick_up_sound_text::pipeline::FilePipeline;

pub struct AppState {
    pub pipeline: Arc<Mutex<Option<FilePipeline>>>,
}

#[tauri::command]
pub async fn start_file_processing(
    video_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // TODO: Implement file processing start
    // 1. Create FileAudioSource from video_path
    // 2. Create ASR provider
    // 3. Create Translate provider
    // 4. Create FilePipeline
    // 5. Store in state.pipeline
    // 6. Spawn async task to run pipeline.process()
    Ok("Processing started".to_string())
}

#[tauri::command]
pub async fn get_processing_progress(
    state: State<'_, AppState>,
) -> Result<f64, String> {
    // TODO: Implement progress query
    // Get pipeline from state and return progress percentage
    Ok(0.0)
}

#[tauri::command]
pub async fn export_subtitle(
    format: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // TODO: Implement subtitle export
    // 1. Get entries from pipeline
    // 2. Format as SRT/VTT/etc based on format param
    // 3. Save to file
    // 4. Return file path
    Ok("subtitle.srt".to_string())
}
