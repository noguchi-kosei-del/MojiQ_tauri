use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::time::{UNIX_EPOCH, SystemTime, Duration};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

use crate::pdf::create_pdf_with_drawings;

/// 古い一時ファイルをクリーンアップ（1時間以上前のmojiq-print-*.pdfを削除）
fn cleanup_old_temp_files(temp_dir: &Path) {
    let one_hour_ago = SystemTime::now()
        .checked_sub(Duration::from_secs(3600))
        .unwrap_or(SystemTime::UNIX_EPOCH);

    if let Ok(entries) = fs::read_dir(temp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("mojiq-print-") && name.ends_with(".pdf") {
                    if let Ok(metadata) = fs::metadata(&path) {
                        if let Ok(modified) = metadata.modified() {
                            if modified < one_hour_ago {
                                let _ = fs::remove_file(&path);
                            }
                        }
                    }
                }
            }
        }
    }
}

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

// 新しいPDF保存用構造体（描画オーバーレイPNG方式）
#[derive(Debug, Serialize, Deserialize)]
pub struct PageDrawingsV2 {
    pub page_number: usize,
    pub drawing_overlay: String,  // 描画レイヤーのBase64 PNG
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveRequestV2 {
    pub pages: Vec<PageDrawingsV2>,
    pub background_images: Vec<String>,
}

/// ファイルサイズを取得する（読み込み前のサイズチェック用）
#[tauri::command]
pub async fn get_file_size(path: String) -> Result<u64, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(metadata.len())
}

/// ファイルサイズ上限（300MB）
const MAX_FILE_SIZE: u64 = 300 * 1024 * 1024;

#[tauri::command]
pub async fn load_file(path: String) -> Result<LoadedDocument, String> {
    let path_buf = PathBuf::from(&path);

    // ファイルサイズチェック（300MB以上はブロック）
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();
    if file_size >= MAX_FILE_SIZE {
        let size_mb = file_size / (1024 * 1024);
        return Err(format!("ファイルサイズが大きすぎるので読み込めません（{}MB / 上限300MB）", size_mb));
    }

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

    // 各ファイルのサイズチェック（300MB以上はブロック）
    for path in &paths {
        let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
        let file_size = metadata.len();
        if file_size >= MAX_FILE_SIZE {
            let size_mb = file_size / (1024 * 1024);
            let file_name = PathBuf::from(path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            return Err(format!("ファイルサイズが大きすぎるので読み込めません: {} ({}MB / 上限300MB)", file_name, size_mb));
        }
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

/// ディスク容量チェック（保存前確認）
/// 旧MojiQ ver_2.11 の electron/main.js より移植
#[derive(Debug, Serialize)]
pub struct DiskSpaceResult {
    pub free_space: u64,
    pub is_enough: bool,
}

#[tauri::command]
pub async fn check_disk_space(file_path: String, required_bytes: u64) -> Result<DiskSpaceResult, String> {
    let path = Path::new(&file_path);

    // ドライブのルートを取得
    // 保存先のパスからルート(例: "C:\")を取り出す
    let root = {
        let mut ancestors = path.ancestors();
        let mut last = path;
        while let Some(p) = ancestors.next() {
            if p.parent().is_none() || p == Path::new("") {
                break;
            }
            last = p;
        }
        last.to_path_buf()
    };

    // Windows: wmicコマンドでディスク空き容量を取得
    if cfg!(target_os = "windows") {
        let drive_str = root.to_string_lossy();
        // ドライブレターを抽出 (例: "C:" → "C")
        let drive_letter = drive_str.chars().next().unwrap_or('C');
        if !drive_letter.is_ascii_alphabetic() {
            // 無効なドライブレター: チェックをスキップ（保存を許可）
            return Ok(DiskSpaceResult { free_space: u64::MAX, is_enough: true });
        }

        let output = std::process::Command::new("wmic")
            .args(["logicaldisk", "where", &format!("DeviceID='{drive_letter}:'"), "get", "FreeSpace"])
            .output()
            .map_err(|e| format!("wmicコマンド実行失敗: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.trim().lines().collect();
        if lines.len() >= 2 {
            if let Ok(free_space) = lines[1].trim().parse::<u64>() {
                // 必要容量の1.5倍のマージンを確保
                let required_with_margin = required_bytes + required_bytes / 2;
                return Ok(DiskSpaceResult {
                    free_space,
                    is_enough: free_space > required_with_margin,
                });
            }
        }
    }

    // 非Windows環境またはコマンド失敗時はチェックをスキップ（保存を許可）
    Ok(DiskSpaceResult { free_space: u64::MAX, is_enough: true })
}

#[tauri::command]
pub async fn save_pdf(
    save_path: String,
    request: SaveRequest,
) -> Result<(), String> {
    create_pdf_with_drawings(&save_path, &request).map_err(|e| e.to_string())
}

// 新しいPDF保存（描画オーバーレイPNG方式）
#[tauri::command]
pub async fn save_pdf_v2(
    save_path: String,
    request: SaveRequestV2,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        crate::pdf::create_pdf_with_overlays(&save_path, &request)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
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

/// 再帰的にJSONファイルを収集して検索
#[tauri::command]
pub async fn search_json_files_recursive(base_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let base = PathBuf::from(&base_path);
    if !base.exists() || !base.is_dir() {
        return Err(format!("ベースパスが無効です: {}", base_path));
    }

    let normalized_query = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    fn collect_files(dir: &Path, base: &Path, query: &str, results: &mut Vec<SearchResult>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    collect_files(&path, base, query, results);
                } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ext.to_lowercase() == "json" {
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            let relative = path.strip_prefix(base)
                                .map(|p| p.to_string_lossy().to_string())
                                .unwrap_or_default();
                            if name.to_lowercase().contains(query) || relative.to_lowercase().contains(query) {
                                results.push(SearchResult {
                                    name: name.to_string(),
                                    path: path.to_string_lossy().to_string(),
                                    relative_path: relative,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    collect_files(&base, &base, &normalized_query, &mut results);
    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub name: String,
    pub path: String,
    pub relative_path: String,
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

// 印刷用PDFを生成してシステム印刷ダイアログを開く
#[tauri::command]
pub async fn print_pdf(request: SaveRequest) -> Result<(), String> {
    use std::env;
    use std::process::Command;

    // 一時ファイルパスを生成（タイムスタンプ+プロセスIDで衝突防止）
    let temp_dir = env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())  // ナノ秒精度で衝突をさらに防止
        .unwrap_or(0);
    let pid = std::process::id();
    let temp_path = temp_dir.join(format!("mojiq-print-{}-{}.pdf", timestamp, pid));
    let temp_path_str = temp_path.to_string_lossy().to_string();

    // 古い一時ファイルをクリーンアップ（1時間以上前のファイル）
    cleanup_old_temp_files(&temp_dir);

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

// 描画データJSONを保存
#[tauri::command]
pub async fn save_drawing_json(path: String, data: String) -> Result<(), String> {
    fs::write(&path, data).map_err(|e| format!("Failed to save drawing data: {}", e))
}

// 描画データJSONを読み込み
#[tauri::command]
pub async fn load_drawing_json(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to load drawing data: {}", e))
}

/// レジストリのフォントキー名からCSSフォントファミリー名を抽出する。
/// 例: "Yu Gothic Bold & Yu Gothic UI Semibold (TrueType)" → ["Yu Gothic", "Yu Gothic UI"]
/// 例: "Arial Bold Italic (TrueType)" → ["Arial"]
#[cfg(target_os = "windows")]
fn extract_font_families(registry_name: &str) -> Vec<String> {
    // 括弧部分 "(TrueType)" 等を除去
    let base = if let Some(pos) = registry_name.rfind('(') {
        registry_name[..pos].trim()
    } else {
        registry_name.trim()
    };
    // 末尾のセミコロンを除去
    let base = base.trim_end_matches(';').trim();

    // "&" で分割（複合フォント名対応）
    let parts: Vec<&str> = base.split('&').collect();

    // スタイル名を除去するための既知サフィックス
    let style_suffixes = [
        " Extra Bold Italic", " Extra Bold",
        " Extra Light Italic", " Extra Light",
        " Semibold Italic", " Semibold",
        " SemiLight Italic", " SemiLight",
        " Semilight Italic", " Semilight",
        " Demibold Italic", " Demibold",
        " Bold Italic", " Bold",
        " Light Italic", " Light",
        " Medium Italic", " Medium",
        " Regular Italic", " Regular",
        " Thin Italic", " Thin",
        " Heavy Italic", " Heavy",
        " Black Italic", " Black",
        " Condensed Italic", " Condensed",
        " Demi Cond", " Demi",
        " Book Italic", " Book",
        " Italic",
    ];

    let mut result = Vec::new();
    for part in parts {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mut family = trimmed.to_string();
        for suffix in &style_suffixes {
            if let Some(stripped) = family.strip_suffix(suffix) {
                if !stripped.is_empty() {
                    family = stripped.to_string();
                    break;
                }
            }
        }
        if !family.is_empty() {
            result.push(family);
        }
    }
    result
}

// システムにインストールされているフォント一覧を取得（Windowsレジストリから）
#[tauri::command]
pub async fn list_system_fonts() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::collections::BTreeSet;

        let fonts_key = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";

        let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
        let mut families = BTreeSet::new();

        if let Ok(key) = hklm.open_subkey(fonts_key) {
            for (name, _value) in key.enum_values().filter_map(|r| r.ok()) {
                for family in extract_font_families(&name) {
                    families.insert(family);
                }
            }
        }

        // 現在のユーザーのフォントも取得
        let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey(fonts_key) {
            for (name, _value) in key.enum_values().filter_map(|r| r.ok()) {
                for family in extract_font_families(&name) {
                    families.insert(family);
                }
            }
        }

        Ok(families.into_iter().collect())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![
            "sans-serif".to_string(),
            "serif".to_string(),
            "monospace".to_string(),
        ])
    }
}
