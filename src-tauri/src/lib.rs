mod pdf;
mod commands;

use commands::{open_file_dialog, save_pdf, load_file, load_files, read_text_file, list_folder_entries};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_file_dialog,
            save_pdf,
            load_file,
            load_files,
            read_text_file,
            list_folder_entries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
