mod pdf;
mod commands;

use commands::{
    open_file_dialog, get_file_size, check_disk_space, save_pdf, save_pdf_v2, load_file, load_files, read_text_file, list_folder_entries,
    load_file_metadata, load_files_metadata, load_page_image, print_pdf,
    get_proofreading_check_base_path, list_proofreading_check_directory, read_proofreading_check_file,
    open_proofreading_viewer, save_drawing_json, load_drawing_json, list_system_fonts
};

use tauri::Manager;

/// スプラッシュのプログレスを指定値に更新する
fn update_splash_progress(app: &tauri::AppHandle, value: u32) {
    if let Some(splash_window) = app.get_webview_window("splash") {
        let _ = splash_window.eval(&format!(
            "if(window.__splashSetProgress)window.__splashSetProgress({});",
            value
        ));
    }
}

/// スプラッシュウィンドウのプログレスを100%まで進めてから閉じ、メインウィンドウを表示する
#[tauri::command]
async fn close_splash(window: tauri::Window) -> Result<(), String> {
    let app = window.app_handle();
    let delay = std::time::Duration::from_millis;

    // 段階的にプログレスを進める
    update_splash_progress(&app, 60);
    tokio::time::sleep(delay(200)).await;

    update_splash_progress(&app, 80);
    tokio::time::sleep(delay(200)).await;

    update_splash_progress(&app, 90);
    tokio::time::sleep(delay(150)).await;

    update_splash_progress(&app, 100);
    tokio::time::sleep(delay(500)).await;

    // メインウィンドウを表示
    if let Some(main_window) = app.get_webview_window("main") {
        main_window.show().map_err(|e| e.to_string())?;
    }

    // スプラッシュウィンドウを閉じる
    if let Some(splash_window) = app.get_webview_window("splash") {
        splash_window.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // スプラッシュウィンドウを作成
            let splash_url = tauri::WebviewUrl::App("splash.html".into());
            tauri::WebviewWindowBuilder::new(app, "splash", splash_url)
                .title("MojiQ Pro")
                .inner_size(660.0, 500.0)
                .resizable(false)
                .decorations(false)
                .center()
                .always_on_top(true)
                .skip_taskbar(true)
                .build()
                .map_err(|e| e.to_string())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            close_splash,
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
            load_drawing_json,
            list_system_fonts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
