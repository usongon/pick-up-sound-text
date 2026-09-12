mod commands;

use commands::{AppState, start_file_processing, get_processing_progress, export_subtitle};
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tracing_subscriber::fmt::init();

    let app_state = AppState {
        pipeline: Arc::new(Mutex::new(None)),
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
