mod pdf;
mod commands;

use commands::{
    open_file_dialog, get_file_size, check_disk_space, save_pdf, save_pdf_v2, load_file, load_files, read_text_file, list_folder_entries,
    load_file_metadata, load_files_metadata, load_page_image, print_pdf,
    get_proofreading_check_base_path, list_proofreading_check_directory, read_proofreading_check_file,
    open_proofreading_viewer, save_drawing_json, load_drawing_json
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_file_dialog,
            get_file_size,
            check_disk_space,
            save_pdf,
            save_pdf_v2,
            load_file,
            load_files,
            read_text_file,
            list_folder_entries,
            load_file_metadata,
            load_files_metadata,
            load_page_image,
            print_pdf,
            get_proofreading_check_base_path,
            list_proofreading_check_directory,
            read_proofreading_check_file,
            open_proofreading_viewer,
            save_drawing_json,
            load_drawing_json
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
