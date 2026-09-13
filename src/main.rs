mod commands;

use commands::{export_subtitle, get_processing_progress, start_file_processing, AppState};
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tracing_subscriber::fmt::init();

    let app_state = AppState {
        pipeline_state: Arc::new(Mutex::new(None)),
        pipeline_entries: Arc::new(Mutex::new(None)),
        processing_task: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            start_file_processing,
            get_processing_progress,
            export_subtitle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
