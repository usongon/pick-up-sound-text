mod commands;

use commands::{export_subtitle, get_config, get_processing_progress, save_config, start_file_processing, AppState};
use pick_up_sound_text::config::AppConfig;
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tracing_subscriber::fmt::init();

    let config = AppConfig::load().unwrap_or_default();

    let app_state = AppState {
        pipeline_state: Arc::new(Mutex::new(None)),
        pipeline_entries: Arc::new(Mutex::new(None)),
        processing_task: Arc::new(Mutex::new(None)),
        config: Arc::new(Mutex::new(config)),
        pipeline: Arc::new(Mutex::new(None)),
        pipeline_progress: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            start_file_processing,
            get_processing_progress,
            export_subtitle,
            get_config,
            save_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
