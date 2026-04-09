mod pdf;
mod commands;

use commands::{
    open_file_dialog, get_file_size, check_disk_space, save_pdf, save_pdf_v2, load_file, load_files, read_text_file, list_folder_entries,
    load_file_metadata, load_files_metadata, load_page_image, print_pdf,
    get_proofreading_check_base_path, list_proofreading_check_directory, read_proofreading_check_file,
    open_proofreading_viewer, save_drawing_json, load_drawing_json, list_system_fonts
};

use tauri::Manager;
use tauri::Emitter;
use std::sync::Mutex;

/// 起動時にCLI引数で渡されたファイルパスを保持する
struct PendingFiles(Mutex<Vec<String>>);

/// サポートされているファイル拡張子かどうかを判定する
fn is_supported_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".pdf") || lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png")
}

/// CLI引数からファイルパスを抽出する
fn extract_file_paths_from_args() -> Vec<String> {
    let args: Vec<String> = std::env::args().collect();
    let mut files = Vec::new();
    // 最初の引数はアプリ自体のパス、2番目以降がファイルパス
    for arg in args.iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        if is_supported_file(arg) && std::path::Path::new(arg).exists() {
            files.push(arg.clone());
        }
    }
    files
}

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

    // 起動時に渡されたファイルがあればフロントエンドに通知する
    let pending = app.state::<PendingFiles>();
    let files: Vec<String> = {
        let mut lock = pending.0.lock().unwrap();
        std::mem::take(&mut *lock)
    };
    if !files.is_empty() {
        // 少し待ってフロントエンドの初期化完了を確実にする
        tokio::time::sleep(delay(300)).await;
        let _ = app.emit("file-open-request", files);
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingFiles(Mutex::new(extract_file_paths_from_args())))
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
