# MojiQ 3.0

PDF/画像に対して描画・注釈を追加し、校正作業を行うためのデスクトップアプリケーション

## プロジェクト概要

- **アプリ名**: MojiQ 3.0
- **バージョン**: 3.0.0
- **識別子**: com.mojiq.app
- **目的**: PDF・画像ファイルへの校正指示・注釈の追加、校正済みPDFの出力

## 技術スタック

### フロントエンド
- **React 19** + **TypeScript 5.8**
- **Vite 7** (ビルドツール)
- **Zustand 5** (状態管理)
- **pdfjs-dist 5.4** (PDFレンダリング・注釈抽出)
- **jsPDF 4** (PDF圧縮)

### バックエンド (Tauri)
- **Tauri 2** (デスクトップアプリフレームワーク)
- **Rust** (バックエンド処理)
- PDF生成: `printpdf`, `lopdf`
- 画像処理: `image`
- 非同期処理: `tokio`

### Tauriプラグイン
- `tauri-plugin-dialog` - ファイルダイアログ
- `tauri-plugin-opener` - 外部アプリ連携

## 主要機能

### 1. ファイル読み込み
- **対応フォーマット**: PDF, JPEG, PNG
- ドラッグ&ドロップによるファイル読み込み
- 複数画像ファイルの一括読み込み（自然順ソート）
- PDFの高解像度レンダリング（3倍スケール）
- PDF注釈の自動抽出・表示

### 2. 描画ツール
| ツール | ショートカット | 説明 |
|--------|---------------|------|
| 選択 | V | ストローク・図形の選択・移動 |
| ペン | P | フリーハンド描画（筆圧対応） |
| マーカー | M | 半透明のハイライト描画 |
| 消しゴム | E | ストロークの消去 |
| 矩形 | R | 四角形の描画 |
| 楕円 | O | 楕円・円の描画 |
| 直線 | L | 直線の描画 |
| 矢印 | A | 矢印付き直線 |
| 両矢印 | D | 両端矢印の直線 |
| 折れ線 | Y | 複数頂点の折れ線 |
| テキスト | T | テキスト挿入 |
| 画像 | I | 画像挿入 |
| パン | Space (長押し) | キャンバスの移動 |

### 3. 校正用スタンプ
- **済スタンプ**: 確認済みマーク
- **ルビスタンプ**: ルビ指示
- **トルスタンプ**: 削除指示
- **トルツメスタンプ**: 削除して詰める指示
- **トルママスタンプ**: 削除してそのまま
- **全角アキスタンプ**: 全角スペース挿入
- **半角アキスタンプ**: 半角スペース挿入
- **改行スタンプ**: 改行挿入
- **とじるスタンプ**: 文字間を詰める指示
- **ひらくスタンプ**: 文字間を空ける指示
- **小文字スタンプ**: 小文字指定

※ トル系・アキ系・改行・とじる・ひらくスタンプはドラッグで引出線付きで配置可能

### 4. アノテーション機能
- 図形に引出線 + テキスト指示を追加
- フォント指定枠線（フォント名ラベル付き）
- ラベル付き枠線

### 5. レイヤー管理
- 複数レイヤーの作成・削除
- レイヤーの表示/非表示切替
- レイヤーの不透明度調整

### 6. ページ管理
- 複数ページのナビゲーション
- 見開き表示（右綴じ/左綴じ対応）
- ページの削除
- 矢印キーによるページ送り

### 7. 閲覧モード (F1)
- フルスクリーン表示
- キーボード/マウスホイールでページ送り
- ダークモード自動切替

### 8. タブ管理
- 複数ドキュメントの同時編集
- タブの切り替え (Ctrl+Tab)
- タブの閉じる (Ctrl+W)
- 未保存変更の警告

### 9. エクスポート
- PDF形式での保存（描画データ込み）
- ストロークのベクター出力

### 10. Undo/Redo
- Ctrl+Z: 元に戻す
- Ctrl+Y / Ctrl+Shift+Z: やり直し

## データ構造

### ページ状態 (PageState)
```typescript
interface PageState {
  pageNumber: number;
  layers: Layer[];
  backgroundImage: string;  // Base64 Data URL
  width: number;
  height: number;
}
```

### レイヤー (Layer)
```typescript
interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  strokes: Stroke[];
  shapes: Shape[];
  texts: TextElement[];
  images: ImageElement[];
}
```

### ストローク (Stroke)
```typescript
interface Stroke {
  id: string;
  points: Point[];    // { x, y, pressure? }
  color: string;
  width: number;
  layerId: string;
  isMarker?: boolean;
  opacity?: number;
}
```

### 図形 (Shape)
```typescript
interface Shape {
  id: string;
  type: ShapeType;  // 'rect' | 'ellipse' | 'line' | 'arrow' | 'doubleArrow' | 'polyline' | 'stamp' | 'labeledRect' | ...
  startPos: Point;
  endPos: Point;
  color: string;
  width: number;
  layerId: string;
  annotation?: Annotation;
  points?: Point[];      // 折れ線用
  stampType?: StampType; // スタンプの種類
  label?: string;        // ラベル付き枠線用
}
```

## Tauriコマンド (invoke)

| コマンド | 説明 |
|---------|------|
| `load_file` | 単一ファイル（PDF/JPEG/PNG）を読み込み |
| `load_files` | 複数画像ファイルを並列読み込み |
| `save_pdf` | 描画データ付きPDFを保存 |
| `read_text_file` | テキストファイルを読み込み |
| `list_folder_entries` | フォルダ内のエントリ一覧を取得 |
| `open_file_dialog` | ファイルダイアログを開く |
| `get_proofreading_check_base_path` | 校正チェックのベースパスを取得 |
| `list_proofreading_check_directory` | 校正チェックディレクトリ一覧を取得 |
| `read_proofreading_check_file` | 校正チェックJSONファイルを読み込み |
| `open_proofreading_viewer` | 校正チェックビューアウィンドウを開く |
| `save_pdf_v2` | 描画オーバーレイ付きPDFを保存（PNG合成方式） |
| `save_drawing_json` | 描画データをJSONファイルに保存 |
| `load_drawing_json` | 描画データJSONファイルを読み込み |

## 状態管理 (Zustand Stores)

| Store | 説明 |
|-------|------|
| `drawingStore` | 描画状態、ページ、レイヤー、履歴管理 |
| `documentStore` | 複数ドキュメント（タブ）の管理 |
| `zoomStore` | ズームレベル管理 |
| `themeStore` | テーマ（ダーク/ライト）管理 |
| `viewerModeStore` | 閲覧モード状態 |
| `spreadViewStore` | 見開き表示状態 |
| `workspaceStore` | ワークスペース設定（左右反転など） |
| `loadingStore` | ローディング状態、圧縮進捗 |
| `presetStore` | プリセット設定 |
| `sidebarStore` | サイドバー状態 |
| `settingsStore` | 環境設定（ショートカット、スクロール方向等） |
| `calibrationStore` | 縮尺設定（pixelsPerMm、キャリブレーションモード） |
| `gridStore` | 写植グリッド（ページごとのグリッド、書き方向、サンプルテキスト） |
| `proofreadingCheckStore` | 校正チェック（モーダル状態、ナビゲーション、データ表示） |
| `modeStore` | モード管理（指示入れモード/校正チェックモード） |

## 開発・ビルド

### 開発環境の起動
```bash
npm run tauri dev
```

### プロダクションビルド
```bash
npm run tauri build
```

## ディレクトリ構成

```
MojiQ_3.0/
├── src/                      # Reactフロントエンド
│   ├── App.tsx              # メインコンポーネント
│   ├── App.css              # スタイル
│   ├── main.tsx             # エントリーポイント
│   ├── components/          # UIコンポーネント
│   │   ├── Canvas/          # 描画キャンバス
│   │   ├── DrawingToolbar/  # 描画ツールバー
│   │   ├── DrawingSettingsBar/ # 描画設定バー
│   │   ├── HeaderBar/       # ヘッダー
│   │   ├── TabBar/          # タブバー
│   │   ├── RightToolbar/    # 右サイドツールバー
│   │   ├── PageNav/         # ページナビゲーション
│   │   ├── LayerPanel/      # レイヤーパネル
│   │   ├── PresetPanel/     # プリセットパネル
│   │   ├── SettingsModal/   # 環境設定モーダル
│   │   ├── GridSettingsPanel/ # 写植グリッド設定パネル
│   │   ├── ProofreadingViewer/ # 校正チェックビューア
│   │   ├── ProofreadingCheckModal/ # 校正チェックモーダル
│   │   ├── ProofreadingPanel/ # 校正チェックパネル（右サイドバー）
│   │   ├── ProofreadingToolbar/ # 校正チェックツールバー（描画ツール）
│   │   ├── PageJumpDialog/  # ページジャンプダイアログ
│   │   └── ...              # その他コンポーネント
│   ├── stores/              # Zustand状態管理
│   │   ├── drawingStore.ts  # メイン描画状態
│   │   ├── documentStore.ts # ドキュメント管理
│   │   └── ...              # その他ストア
│   ├── hooks/               # カスタムフック
│   │   └── useCanvas.ts     # キャンバス操作フック
│   ├── types/               # 型定義
│   │   └── index.ts
│   ├── utils/               # ユーティリティ
│   │   ├── pdfRenderer.ts   # PDF処理
│   │   ├── backgroundImageCache.ts  # 背景画像キャッシュ（ImageBitmap対応）
│   │   ├── pageRenderCache.ts  # LRUキャッシュ（マルチタブ対応）
│   │   ├── imageCompression.ts  # 画像・PDF圧縮
│   │   ├── fileValidation.ts  # ファイルバリデーション
│   │   ├── memoryUtils.ts   # メモリ検出ユーティリティ
│   │   ├── drawingExportImport.ts  # 描画データエクスポート/インポート
│   │   ├── drawingRenderer.ts  # 描画要素のCanvasレンダリング
│   │   └── pageNumberUtils.ts  # ページ番号計算（横長原稿対応）
│   └── constants/           # 定数
│       └── loadingLimits.ts # ファイル読み込み閾値
├── src-tauri/               # Tauriバックエンド
│   ├── src/
│   │   ├── main.rs          # エントリーポイント
│   │   ├── lib.rs           # Tauriアプリ設定
│   │   ├── commands.rs      # Tauriコマンド実装
│   │   └── pdf.rs           # PDF生成処理
│   ├── Cargo.toml           # Rust依存関係
│   └── tauri.conf.json      # Tauri設定
├── logo/                    # アイコン・ロゴ
├── package.json             # npm依存関係
└── vite.config.ts           # Vite設定
```

## キーボードショートカット

### ツール切り替え
- `V`: 選択ツール
- `P`: ペンツール
- `M`: マーカー
- `E`: 消しゴム
- `R`: 矩形
- `O`: 楕円
- `L`: 直線
- `A`: 矢印
- `D`: 両矢印
- `Y`: 折れ線
- `T`: テキスト
- `I`: 画像
- `Space` (長押し): パン

### 編集操作
- `Ctrl+Z`: 元に戻す
- `Ctrl+Y` / `Ctrl+Shift+Z`: やり直し
- `Delete` / `Backspace`: 選択を削除
- `Ctrl+Delete`: すべての描画を消去

### 表示操作
- `Ctrl++` / `Ctrl+=`: ズームイン
- `Ctrl+-`: ズームアウト
- `Ctrl+0`: ズームリセット
- `F1`: 閲覧モード
- `←` / `→`: ページ送り
- `Ctrl+J`: ページジャンプ

### タブ操作
- `Ctrl+Tab`: 次のタブ
- `Ctrl+Shift+Tab`: 前のタブ
- `Ctrl+W`: タブを閉じる

## ウィンドウ設定

- **初期サイズ**: 1280 x 800
- **最小幅**: 1100
- **装飾なし**: カスタムタイトルバー使用
- **リサイズ可能**: true

## 設計方針

1. **高品質レンダリング**: PDFを3倍スケールでレンダリングして高精細表示
2. **筆圧対応**: ペンタブレットの筆圧に対応した自然な描画
3. **非破壊編集**: 元のファイルを変更せず、描画データを別レイヤーで管理
4. **複数ドキュメント対応**: タブで複数ファイルを同時に開いて作業可能
5. **PDF注釈互換**: 既存のPDF注釈を自動で読み込み・表示

## 更新履歴

### 2026-02-07
#### UI改善
- **ヘッダーバー**: MojiQロゴをハンバーガーメニューの左に追加
- **描画ツールバー**: 枠線・楕円・直線ツールの下に+テキスト付きバージョンを縦に配置
  - 枠線+テキスト、楕円+テキスト、直線+テキストがそれぞれのツールの直下に表示
  - ツールグループ間のgapを4pxに統一
- **描画設定バー**: ページバー非表示・コメントテキスト非表示ボタンをパネル下部に移動
  - 旧MojiQ ver_2.04のレイアウトを踏襲したアイコンボタン配置
  - 折りたたみ時はボタン非表示

#### ページ切り替えの高速化
- **背景画像キャッシュ**: HTMLImageElementをキャッシュして即座に描画
  - `src/utils/backgroundImageCache.ts` を新規作成
  - PDF/画像読み込み時に全ページをプリロード
  - ページ切り替え時のちらつきを解消

#### 環境設定機能（旧MojiQ ver_2.04より移植）
- **SettingsModal**: 4タブ構成の環境設定モーダル
  - ショートカット: キーボードショートカットのカスタマイズ
  - スクロール: マウスホイールの方向設定（通常/反転）
  - 方向キー: ページ送り方向の設定（通常/反転）
  - パネル動作: ツール選択後のパネル動作設定
- **settingsStore**: Zustandによる設定状態管理
  - localStorageへの自動保存・復元
  - ショートカット衝突検出
- **ハンバーガーメニュー**: 歯車アイコンで環境設定を開く（ライトモードとホームボタンの間）

### 2026-02-08
#### 縮尺合わせ機能（旧MojiQ ver_2.04より移植）
- **calibrationStore**: 縮尺設定の状態管理
  - `pixelsPerMm`: ピクセル/mm比率を永続化
  - `isCalibrated`: 毎セッションで確認が必要（永続化しない）
- **キャリブレーションモード**:
  - キャンバス上でドラッグして距離を測定
  - モーダルで実際の距離（mm）を入力して縮尺を確定
  - Shiftキーで45度スナップ
  - キャンセル時にガイドラインを自動消去

#### 写植グリッド機能（旧MojiQ ver_2.04より移植）
- **gridStore**: グリッドの状態管理
  - ページごとのグリッド管理
  - 書き方向（横書き/縦書き）
  - セリフサンプルテキスト
- **グリッド操作**:
  - ドラッグでグリッドを作成
  - 四隅のハンドルでリサイズ
  - グリッド内クリックで移動
  - グリッド外クリックで解除＆新規作成可能
- **セリフサンプル表示**:
  - グリッド内にテキストを50%透明度でプレビュー
  - 縦書き時は文字を90度回転
  - 句読点・括弧の位置調整

#### GridSettingsPanel
- **縮尺ボタン**: キャリブレーションモードの開始/終了
- **グリッドボタン**: グリッドモードの開始/終了（縮尺未設定時は無効）
- **縮尺表示**: 設定済み/未設定の状態表示
- **グリッド設定エリア**: 縮尺未設定時はグレーアウト
  - セリフサンプル入力
  - 書き方向切り替え（横/縦）
  - テキストクリアボタン
  - グリッドサイズ（pt）表示

### 2026-02-17
#### 校正チェック機能（旧MojiQ ver_2.05より移植）
- **校正チェックビューア**: 別ウィンドウでProGen生成の校正チェックJSONを表示
  - `src/components/ProofreadingViewer/` - ビューアコンポーネント
  - `src/components/ProofreadingCheckModal/` - フォルダブラウザモーダル
  - `proofreading-viewer.html` - 別ウィンドウ用HTMLエントリーポイント
- **タブ切り替え**: 正誤チェック / 提案チェック / 両方表示
  - `checkKind` フィールドで項目を分類
  - 両方表示は2カラムレイアウト
- **カテゴリ別表示**: カテゴリごとに折りたたみ可能なグループ表示
- **コピー機能**: 各項目の内容をクリップボードにコピー
- **ダークモード対応**: メインウィンドウのテーマに連動

#### 校正指示ツール追加
- **とじるスタンプ**: 文字間を詰める指示（3文字テキストスタンプ）
- **ひらくスタンプ**: 文字間を空ける指示（3文字テキストスタンプ）
- **引出線対応**: トル系・アキ系・改行・とじる・ひらくスタンプでドラッグによる引出線作成
  - クリック: 引出線なしで配置
  - ドラッグ: 引出線付きで配置（先端に●マーク）

### 2026-03-13
#### PDF/JPEG読み込みロジック改善（旧MojiQ ver_2.08より移植）
- **LRUキャッシュ**: システムメモリに基づく動的サイズ（5-30ページ）
  - `src/utils/pageRenderCache.ts` - マルチタブ対応のLRUキャッシュ
  - `src/utils/memoryUtils.ts` - `performance.memory`/`navigator.deviceMemory` API使用
  - ドキュメント単位でのキャッシュクリア（`clearForDocument()`）
- **ImageBitmapキャッシュ**: GPU最適化されたキャッシュ
  - `backgroundImageCache.ts` を改善、`ImageBitmap.close()` でGPUメモリ明示解放
  - `createImageBitmap()` 使用、未対応環境は `HTMLImageElement` にフォールバック
- **大容量ファイル圧縮**:
  - `src/utils/imageCompression.ts` - Canvas経由のPDF/画像圧縮
  - PDFサイズ閾値: 500MB以上で圧縮確認ダイアログ
  - 画像サイズ閾値: 300MB以上で圧縮確認ダイアログ
  - 圧縮品質: JPEG 0.75
- **ページ数制限**:
  - 最大ページ数: 500（超過時はブロック）
  - 警告ページ数: 200（超過時は確認ダイアログ）
- **定数管理**: `src/constants/loadingLimits.ts` に閾値を集約
- **loadingStore拡張**: 圧縮状態（`isCompressing`, `compressionProgress`）追加
- **documentStore改善**: タブ閉じ時・アンロード時にキャッシュをクリア

#### 描画データエクスポート/インポート機能（旧MojiQ ver_2.08より移植）
- **JSONエクスポート**: 描画データを`.mojiq.json`形式で保存
  - `src/utils/drawingExportImport.ts` - エクスポート/インポートロジック
  - `src/utils/drawingRenderer.ts` - Canvas描画レンダリング
  - ストローク、図形、スタンプ、テキスト、画像、アノテーションをすべて保存
- **JSONインポート**: 描画データを復元
  - 座標スケーリング対応（異なるサイズのPDFでも適用可能）
  - ページ数不一致時は確認ダイアログを表示
- **PDF保存時の描画オーバーレイ**:
  - PNGオーバーレイ方式でPDFに全描画要素を合成
  - `save_pdf_v2` Tauriコマンド追加
- **保存メニューにチェックボックス追加**:
  - 「描画データを保存」チェックボックス
  - PDF保存時に自動で`.mojiq.json`も出力
- **描画データ読み込みボタン**:
  - ヘッダーの保存ボタン右隣に配置
  - `.mojiq.json`ファイルを選択して描画を復元

#### 横長原稿のページ番号計算（旧MojiQ ver_2.08より移植）
- **ノンブル計算**: 横長PDF（幅 > 高さ）で見開きページ番号を表示
  - `src/utils/pageNumberUtils.ts` - ページ番号計算ユーティリティ
  - 1ページ目は単独、2ページ目以降は見開き（2-3, 4-5...）
  - 総ノンブル = 1 + (元ページ数 - 1) × 2
- **PageNav更新**: 横長原稿時にノンブル形式で表示（例: `2-3/31`）

#### ページジャンプ機能
- **Ctrl+J**: ページジャンプダイアログを開く
  - `src/components/PageJumpDialog/` - ダイアログコンポーネント
  - ノンブル入力でページ移動
  - 横長原稿の場合はノンブル計算を適用

### 2026-03-13（続き）
#### 校正チェックモードUI改善
- **モード切り替え**: 指示入れモード/校正チェックモードの切り替え機能
  - `src/stores/modeStore.ts` - モード状態管理
  - ヘッダーバーにモード切り替えボタンを追加
- **ProofreadingPanel**: 校正チェック用右サイドバー
  - `src/components/ProofreadingPanel/` - パネルコンポーネント
  - 校正チェックデータの読み込みボタン（青色スタイル）
  - 折りたたみ機能（指示入れモードのサイドバーと同様）
- **ProofreadingToolbar**: 校正チェック用描画ツールバー
  - `src/components/ProofreadingToolbar/` - ツールバーコンポーネント
  - サイドバーの左側に配置（42px幅）
  - 描画ツール: 選択、ペン、マーカー、消しゴム、移動、テキスト
  - 図形ツール: 枠線、楕円、直線（各+テキスト版付き）
  - 折りたたみ機能（左端に矢印ボタン）

### 2026-03-17
#### 校正チェックモードUI改善（旧MojiQ ver_2.08より移植）
- **ページバー位置調整**: 校正チェックモード時にPDF表示領域の中央に配置
  - ツールバー(42px)とパネル(350px)を考慮したオフセット計算
  - サイドバー折りたたみ時の動的位置調整対応
- **タブ順序変更**: コメントタブを一番右に配置（正誤→提案→コメント）

#### ProofreadingPanel機能追加
- **カラーセクション**:
  - プリセットカラー（赤・青）のスウォッチ
  - カスタムカラーピッカー
  - スポイトツール（EyeDropper API対応ブラウザのみ）
  - グラデーションバー（12色セグメント、指示入れモードと同じ）
- **線の太さセクション**:
  - 数値入力（1-20px）
  - スライダー（マウスホイール操作対応）
- **済スタンプ・ルビスタンプボタン**:
  - 校正チェック読み込みボタンの下に配置
  - クリックでスタンプモードに切り替え
  - アクティブ状態の視覚的フィードバック
- **ダークモード対応**: 全セクションでダークモード対応

#### コメントタブチェックボックス機能（旧MojiQ ver_2.08より移植）
- **コメントタブ**:
  - 各コメント項目にチェックボックスを追加
  - チェック時にPDF注釈の位置に済スタンプ（赤色、20px）を自動配置
  - チェック解除時に済スタンプを削除
  - すべてチェック完了でタブに「済」タグを表示
- **正誤・提案タブ**:
  - 各項目にチェックボックスを追加
  - チェック済み項目は薄緑色でハイライト、右端に「確認済み」ラベル表示
  - カテゴリヘッダーにチェックボックスを追加（一括チェック機能）
  - カテゴリ全項目チェック時にヘッダー右端に「確認済み」ラベル表示
  - すべてチェック完了でタブに「済」タグを表示
- **drawingStore拡張**:
  - `addDoneStampToPage(pageIndex, point)` - 指定ページに済スタンプを追加
  - `removeShapeById(pageIndex, shapeId)` - 指定ページから指定IDのスタンプを削除
