use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use std::time::UNIX_EPOCH;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

use crate::pdf::create_pdf_with_drawings;

// ファイルメタデータ（リンク方式用）
#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_path: String,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub modified_at: u64,
}

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

// リンク方式: 単一ファイルのメタデータ取得（Base64なし、高速）
#[tauri::command]
pub async fn load_file_metadata(path: String) -> Result<FileMetadata, String> {
    let path_buf = PathBuf::from(&path);

    let extension = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    // サポートするファイル形式のチェック
    let mime_type = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        _ => return Err(format!("Unsupported file type: {}", extension)),
    };

    // 画像サイズ取得
    let (width, height) = ::image::image_dimensions(&path).map_err(|e| e.to_string())?;

    // ファイル更新日時取得
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified_at = metadata
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    Ok(FileMetadata {
        file_path: path,
        mime_type: mime_type.to_string(),
        width,
        height,
        modified_at,
    })
}

// リンク方式: 複数ファイルのメタデータ取得（並列処理、高速）
#[tauri::command]
pub async fn load_files_metadata(paths: Vec<String>) -> Result<Vec<FileMetadata>, String> {
    if paths.is_empty() {
        return Err("No files provided".to_string());
    }

    // 並列処理でメタデータを取得
    let handles: Vec<_> = paths
        .into_iter()
        .map(|path| {
            tokio::task::spawn_blocking(move || {
                let path_buf = PathBuf::from(&path);
                let extension = path_buf
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();

                let mime_type = match extension.as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "png" => "image/png",
                    _ => return None,
                };

                // 画像サイズ取得
                let (width, height) = match ::image::image_dimensions(&path) {
                    Ok(dims) => dims,
                    Err(_) => return None,
                };

                // ファイル更新日時取得
                let modified_at = fs::metadata(&path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                Some(FileMetadata {
                    file_path: path,
                    mime_type: mime_type.to_string(),
                    width,
                    height,
                    modified_at,
                })
            })
        })
        .collect();

    // 全ての処理を待機
    let mut all_metadata: Vec<FileMetadata> = Vec::new();
    for handle in handles {
        if let Ok(Some(metadata)) = handle.await {
            all_metadata.push(metadata);
        }
    }

    if all_metadata.is_empty() {
        return Err("No supported image files found".to_string());
    }

    Ok(all_metadata)
}

// リンク方式: 単一画像のBase64読み込み（オンデマンド）
#[tauri::command]
pub async fn load_page_image(path: String) -> Result<String, String> {
    let path_buf = PathBuf::from(&path);

    let extension = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let mime_type = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        _ => return Err(format!("Unsupported file type: {}", extension)),
    };

    // ファイルを読み込んでBase64エンコード
    let file_bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let image_data = BASE64.encode(&file_bytes);

    Ok(format!("data:{};base64,{}", mime_type, image_data))
}

// ===== 校正チェック機能 =====

// 校正チェック項目
#[derive(Debug, Serialize, Deserialize)]
pub struct ProofreadingCheckItem {
    pub picked: Option<bool>,
    pub category: Option<String>,
    pub page: Option<String>,
    pub excerpt: Option<String>,
    pub content: Option<String>,
    #[serde(rename = "checkKind")]
    pub check_kind: Option<String>,  // "correctness" | "proposal"
}

// 校正チェックカテゴリ
#[derive(Debug, Serialize, Deserialize)]
pub struct ProofreadingCheckCategory {
    pub items: Vec<ProofreadingCheckItem>,
}

// 校正チェック全体
#[derive(Debug, Serialize, Deserialize)]
pub struct ProofreadingChecks {
    pub variation: Option<ProofreadingCheckCategory>,
    pub simple: Option<ProofreadingCheckCategory>,
}

// 校正チェックファイルのルート構造
#[derive(Debug, Serialize, Deserialize)]
pub struct ProofreadingCheckData {
    pub title: Option<String>,
    pub work: Option<String>,
    pub checks: Option<ProofreadingChecks>,
}

// デフォルトのベースパス
const DEFAULT_PROOFREADING_CHECK_BASE_PATH: &str =
    r"G:\共有ドライブ\CLLENN\編集部フォルダ\編集企画部\写植・校正用テキストログ";

// 校正チェック: ベースパス取得
#[tauri::command]
pub async fn get_proofreading_check_base_path() -> Result<String, String> {
    // 環境変数から取得、なければデフォルト
    let path = std::env::var("MOJIQ_PROOFREADING_CHECK_PATH")
        .unwrap_or_else(|_| DEFAULT_PROOFREADING_CHECK_BASE_PATH.to_string());
    Ok(path)
}

// 校正チェック: ディレクトリ一覧取得（JSONフィルター付き）
#[tauri::command]
pub async fn list_proofreading_check_directory(
    path: String,
    base_path: String,
) -> Result<Vec<FolderEntry>, String> {
    // セキュリティチェック: パスがベースパス配下であることを確認
    let normalized_path = PathBuf::from(&path);
    let normalized_base = PathBuf::from(&base_path);

    // canonicalizeはWindows上でパスが存在しないとエラーになるため、
    // starts_withで簡易チェック（大文字小文字を区別しない）
    let path_lower = path.to_lowercase().replace('/', "\\");
    let base_lower = base_path.to_lowercase().replace('/', "\\");

    if !path_lower.starts_with(&base_lower) {
        return Err("アクセスが許可されていないパスです".to_string());
    }

    // パスが存在するかチェック
    if !normalized_path.exists() {
        return Err(format!("パスが存在しません: {}", path));
    }

    // 既存のlist_folder_entriesロジックを使用（JSONフィルター付き）
    list_folder_entries(path, Some("json".to_string())).await
}

// 校正チェック: JSONファイル読み込み
#[tauri::command]
pub async fn read_proofreading_check_file(
    path: String,
    base_path: String,
) -> Result<ProofreadingCheckData, String> {
    // セキュリティチェック
    let path_lower = path.to_lowercase().replace('/', "\\");
    let base_lower = base_path.to_lowercase().replace('/', "\\");

    if !path_lower.starts_with(&base_lower) {
        return Err("アクセスが許可されていないパスです".to_string());
    }

    // ファイルを読み込んでJSONパース
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("ファイルの読み込みに失敗: {}", e))?;

    let data: ProofreadingCheckData = serde_json::from_str(&content)
        .map_err(|e| format!("JSONのパースに失敗: {}", e))?;

    Ok(data)
}

// 校正チェック: ビューアーウィンドウを開く
#[tauri::command]
pub async fn open_proofreading_viewer(
    app: tauri::AppHandle,
    file_path: String,
    base_path: String,
    file_name: String,
    dark_mode: bool,
) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    // URLパラメータを構築
    let params = format!(
        "file={}&basePath={}&darkMode={}",
        urlencoding::encode(&file_path),
        urlencoding::encode(&base_path),
        if dark_mode { "true" } else { "false" }
    );

    let url = format!("/proofreading-viewer.html?{}", params);
    let label = format!("proofreading-viewer-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0));

    // ウィンドウを作成
    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(url.into()),
    )
    .title(format!("校正チェック - {}", file_name))
    .inner_size(840.0, 1080.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| format!("ウィンドウの作成に失敗: {}", e))?;

    Ok(())
}

// 印刷用PDFを生成してシステム印刷ダイアログを開く
#[tauri::command]
pub async fn print_pdf(request: SaveRequest) -> Result<(), String> {
    use std::env;
    use std::process::Command;

    // 一時ファイルパスを生成
    let temp_dir = env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = temp_dir.join(format!("mojiq-print-{}.pdf", timestamp));
    let temp_path_str = temp_path.to_string_lossy().to_string();

    // PDFを生成
    create_pdf_with_drawings(&temp_path_str, &request).map_err(|e| e.to_string())?;

    // Windows: SumatraPDFを探して印刷ダイアログを開く、なければデフォルトビューアで開く
    #[cfg(target_os = "windows")]
    {
        // SumatraPDFの可能なパス
        let local_app_data = env::var("LOCALAPPDATA").unwrap_or_default();
        let sumatra_local = format!("{}\\SumatraPDF\\SumatraPDF.exe", local_app_data);
        let sumatra_paths = [
            sumatra_local.as_str(),
            "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
            "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
        ];

        let mut sumatra_found = false;
        for sumatra_path in &sumatra_paths {
            if std::path::Path::new(sumatra_path).exists() {
                // SumatraPDFで印刷ダイアログを開く
                let result = Command::new(sumatra_path)
                    .args(["-print-dialog", &temp_path_str])
                    .spawn();

                if result.is_ok() {
                    sumatra_found = true;
                    break;
                }
            }
        }

        // SumatraPDFが見つからない場合はデフォルトビューアで開く
        if !sumatra_found {
            Command::new("cmd")
                .args(["/C", "start", "", &temp_path_str])
                .spawn()
                .map_err(|e| format!("Failed to open PDF: {}", e))?;
        }
    }

    // macOS
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&temp_path_str)
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    // Linux
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&temp_path_str)
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    Ok(())
}
