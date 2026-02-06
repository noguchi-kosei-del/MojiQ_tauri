use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

use crate::pdf::create_pdf_with_drawings;

#[derive(Debug, Serialize, Deserialize)]
pub struct PageData {
    pub page_number: usize,
    pub image_data: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadedDocument {
    pub file_type: String,
    pub file_name: String,
    pub file_path: String,
    pub pages: Vec<PageData>,
    pub pdf_data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DrawingStroke {
    pub points: Vec<(f64, f64)>,
    pub color: String,
    pub width: f64,
    pub pressure: Vec<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageDrawings {
    pub page_number: usize,
    pub strokes: Vec<DrawingStroke>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveRequest {
    pub original_path: Option<String>,
    pub pages: Vec<PageDrawings>,
    pub background_images: Vec<String>,
}

#[tauri::command]
pub async fn open_file_dialog() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
pub async fn load_file(path: String) -> Result<LoadedDocument, String> {
    let path_buf = PathBuf::from(&path);

    let extension = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let file_name = path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();

    match extension.as_str() {
        "pdf" => {
            // Read PDF file and convert to base64 for frontend rendering
            let pdf_bytes = fs::read(&path).map_err(|e| e.to_string())?;
            let pdf_base64 = BASE64.encode(&pdf_bytes);

            Ok(LoadedDocument {
                file_type: "pdf".to_string(),
                file_name,
                file_path: path,
                pages: vec![],  // Will be populated by frontend
                pdf_data: Some(pdf_base64),
            })
        }
        "jpg" | "jpeg" => {
            // JPEGはそのまま読み込んでbase64エンコード（変換なし）
            let file_bytes = fs::read(&path).map_err(|e| e.to_string())?;
            let (width, height) = ::image::image_dimensions(&path).map_err(|e| e.to_string())?;
            let image_data = BASE64.encode(&file_bytes);

            Ok(LoadedDocument {
                file_type: extension,
                file_name,
                file_path: path,
                pages: vec![PageData {
                    page_number: 0,
                    image_data: format!("data:image/jpeg;base64,{}", image_data),
                    width,
                    height,
                }],
                pdf_data: None,
            })
        }
        "png" => {
            // PNGもそのまま読み込んでbase64エンコード（変換なし）
            let file_bytes = fs::read(&path).map_err(|e| e.to_string())?;
            let (width, height) = ::image::image_dimensions(&path).map_err(|e| e.to_string())?;
            let image_data = BASE64.encode(&file_bytes);

            Ok(LoadedDocument {
                file_type: extension,
                file_name,
                file_path: path,
                pages: vec![PageData {
                    page_number: 0,
                    image_data: format!("data:image/png;base64,{}", image_data),
                    width,
                    height,
                }],
                pdf_data: None,
            })
        }
        _ => Err(format!("Unsupported file type: {}", extension)),
    }
}

#[tauri::command]
pub async fn load_files(paths: Vec<String>) -> Result<LoadedDocument, String> {
    if paths.is_empty() {
        return Err("No files provided".to_string());
    }

    // 最初のファイル情報を保存
    let first_path_buf = PathBuf::from(&paths[0]);
    let first_file_name = first_path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();
    let first_file_path = paths[0].clone();

    // 並列処理で画像を読み込む（JPEG/PNGはそのままbase64エンコード）
    let handles: Vec<_> = paths
        .into_iter()
        .enumerate()
        .map(|(index, path)| {
            tokio::task::spawn_blocking(move || {
                let path_buf = PathBuf::from(&path);
                let extension = path_buf
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();

                match extension.as_str() {
                    "jpg" | "jpeg" => {
                        // JPEGはそのまま読み込んでbase64エンコード（変換なし）
                        let file_bytes = match fs::read(&path) {
                            Ok(bytes) => bytes,
                            Err(_) => return None,
                        };

                        // サイズ取得のみimage crateを使用
                        let (width, height) = match ::image::image_dimensions(&path) {
                            Ok(dims) => dims,
                            Err(_) => return None,
                        };

                        let image_data = BASE64.encode(&file_bytes);

                        Some(PageData {
                            page_number: index,
                            image_data: format!("data:image/jpeg;base64,{}", image_data),
                            width,
                            height,
                        })
                    }
                    "png" => {
                        // PNGもそのまま読み込んでbase64エンコード（変換なし）
                        let file_bytes = match fs::read(&path) {
                            Ok(bytes) => bytes,
                            Err(_) => return None,
                        };

                        // サイズ取得のみimage crateを使用
                        let (width, height) = match ::image::image_dimensions(&path) {
                            Ok(dims) => dims,
                            Err(_) => return None,
                        };

                        let image_data = BASE64.encode(&file_bytes);

                        Some(PageData {
                            page_number: index,
                            image_data: format!("data:image/png;base64,{}", image_data),
                            width,
                            height,
                        })
                    }
                    _ => None,
                }
            })
        })
        .collect();

    // 全ての処理を待機
    let mut all_pages: Vec<PageData> = Vec::new();
    for handle in handles {
        if let Ok(Some(page)) = handle.await {
            all_pages.push(page);
        }
    }

    if all_pages.is_empty() {
        return Err("No supported image files found".to_string());
    }

    // ページ番号でソート
    all_pages.sort_by_key(|p| p.page_number);

    Ok(LoadedDocument {
        file_type: "images".to_string(),
        file_name: first_file_name,
        file_path: first_file_path,
        pages: all_pages,
        pdf_data: None,
    })
}

#[tauri::command]
pub async fn save_pdf(
    save_path: String,
    request: SaveRequest,
) -> Result<(), String> {
    create_pdf_with_drawings(&save_path, &request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub async fn list_folder_entries(path: String, extension_filter: Option<String>) -> Result<Vec<FolderEntry>, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let entries = fs::read_dir(&path_buf).map_err(|e| e.to_string())?;

    let mut result: Vec<FolderEntry> = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let entry_path = entry.path();
            let is_dir = entry_path.is_dir();

            // フィルタ処理
            if !is_dir {
                if let Some(ref ext_filter) = extension_filter {
                    let ext = entry_path
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|s| s.to_lowercase())
                        .unwrap_or_default();

                    if ext != ext_filter.to_lowercase() {
                        continue;
                    }
                }
            }

            if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                result.push(FolderEntry {
                    name: name.to_string(),
                    path: entry_path.to_string_lossy().to_string(),
                    is_dir,
                });
            }
        }
    }

    // 名前でソート（ディレクトリ優先）
    result.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(result)
}
