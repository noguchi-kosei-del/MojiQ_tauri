# MojiQ Pro 1.0

PDF/画像に対して描画・注釈を追加し、校正作業を行うためのデスクトップアプリケーション

## プロジェクト概要

- **アプリ名**: MojiQ Pro
- **バージョン**: 1.0.0
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
| `displayScaleStore` | 表示スケール（baseScale * zoom）の管理 |

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
MojiQ_Pro_1.0/
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

#### ファイルサイズ制限機能
- **300MB以上のファイル読み込みブロック**:
  - Rust側（`commands.rs`）で`load_file`/`load_files`コマンドにファイルサイズチェックを追加
  - 300MB以上のファイルはエラーを返して読み込みを拒否
  - フロントエンド側でエラーをキャッチしてカスタムダイアログで表示
  - エラーメッセージ: 「ファイルサイズが大きすぎるので読み込めません（XXX MB / 上限300MB）」

### 2026-03-18
#### タブバーUI改善
- **新規タブボタン無効化**: 初回起動時（タブが0個の状態）は新規タブボタンを無効化
  - ファイルが読み込まれていない状態ではボタンがグレーアウト
  - 読み込みボタンからファイルを読み込むように誘導

### 2026-03-19
#### 描画スケーリング修正（旧MojiQ ver_2.09より移植）
- **displayScaleStore追加**: 表示スケールをストアで一元管理
  - `src/stores/displayScaleStore.ts` - displayScale（baseScale * zoom）を保存
  - DrawingCanvasで計算したdisplayScaleをストアに保存
  - useCanvasでストアから読み取り、`renderScale = 1 / displayScale`で描画スケールを計算
- **描画スケール安定化**: ツール切り替え時のテキストサイズ変動を解消
  - 従来: `getBoundingClientRect()`依存で不安定
  - 改善: 計算済みdisplayScaleをストア経由で取得し一貫したスケーリング
- **テキスト・線の太さスケーリング**: currentRenderScaleRefを全描画関数で適用
  - `drawStroke`: ストロークの線幅をスケーリング
  - `drawShape`: 図形の線幅、スタンプサイズ、引出線をスケーリング
  - `drawAnnotation`: アノテーションのフォントサイズと線幅をスケーリング
  - `drawText`: テキストのフォントサイズとアウトライン線幅をスケーリング
  - `drawLeaderPreview`: 引出線プレビューの線幅とドット半径をスケーリング
- **コメントテキストとテキストツールのサイズ統一**: 両者が同じrenderScaleを使用

#### PDF注釈（コメントテキスト）表示改善
- **フォントサイズ固定値**: PDF注釈テキストは`fontSize: 16`で統一（テキストツールのデフォルトと同じ）
- **白フチの太さ統一**: フォントサイズに比例した白フチ（`scaledFontSize * 0.22`）
- **見切れ防止**: テキスト位置をキャンバス境界内に収めるクランプ処理
  - `calculateTextBounds()`: テキストの幅と高さを計算
  - `clampTextPosition()`: 右端/左端/上端/下端をチェックして位置を調整

#### ヘッダーバーUI改善
- **ハンバーガーメニュー簡素化**:
  - 「描画データをエクスポート」「描画データをインポート」を削除
  - 「ショートカット」リンクを削除
- **ズームボタン位置反転**: `[+] 100% [-]` の順序に変更
- **アンドゥ・リドゥ・全消去ボタン**: PDF読み込み前は非表示（ズームボタンと同様）

#### タブバーUI改善
- **タブ色反転**: 選択中/非選択中の背景色を反転
  - 非選択タブ: `var(--bg-primary)`
  - 選択中タブ: `var(--bg-tertiary)`

#### テキスト選択判定の改善
- **正確なテキストサイズ測定**: Canvas APIの`measureText`を使用
  - `calculateTextBounds`: オフスクリーンCanvasで正確なテキスト幅を測定
  - `calculateAnnotationTextBounds`: アノテーション（+テキスト）も同様に対応
  - オフスクリーンCanvasをキャッシュしてパフォーマンス最適化
- **スケーリング対応**: `displayScaleStore`から`displayScale`を取得
  - `renderScale = 1 / displayScale`を計算して描画時と同じスケーリングを適用
  - テキスト選択ボックスが実際の描画サイズと一致

#### 選択ツールのドラッグ選択にテキスト対応
- **`selectTextsInRect`関数追加**: 矩形選択でテキストも選択可能に
  - `drawingStore.ts`に実装
  - テキストの境界と選択矩形の重なりをチェック
  - 既存のストローク・図形選択と統合

#### デフォルト設定の変更
- **デフォルトフォントサイズ**: 16pt → 14pt
  - AnnotationModal（テキスト/アノテーション入力）
  - pdfRenderer（PDF注釈テキスト）
  - drawingExportImport（インポート時のフォールバック）
- **デフォルトツール**: ペン → 選択ツール（起動時は選択ツール）

### 2026-03-27
#### 致命的バグ修正・パフォーマンス改善

##### PDF保存時のアトミック書き込み
- **データ損失防止**: 一時ファイル→リネーム方式で保存
  - `src-tauri/src/pdf.rs` - `atomic_save_pdf()`関数追加
  - ディスク容量不足時でも元ファイルを保護
  - バックアップファイル（.pdf.bak）による安全な書き込み

##### Web Worker化（PDF処理のメインスレッド分離）
- **UIフリーズ防止**: 大容量Base64変換をWorkerに委譲
  - `src/workers/pdfWorker.ts` - Base64⇔Uint8Array変換Worker
  - `src/utils/pdfWorkerManager.ts` - Worker管理、リクエストID管理
  - `src/utils/pdfRenderer.ts` - 75KB以上のデータを自動でWorker処理
  - Transferable objectでゼロコピー転送

##### 状態管理の最適化（structuredClone導入）
- **パフォーマンス向上**: `JSON.parse(JSON.stringify())`を`structuredClone()`に置換
  - `src/stores/drawingStore.ts` - 履歴管理の深いコピーを最適化
  - 循環参照対応、より高速なクローン処理

##### キャッシュ管理の統一
- **統合インターフェース**: 3つのキャッシュを一元管理
  - `src/utils/cacheManager.ts` - 新規作成
  - `pageRenderCache`、`backgroundImageCache`、`imageCache`を統合
  - `clearAll()` - 全キャッシュクリア
  - `clearForDocument(id)` - ドキュメント単位クリア
  - `clearByType(type)` - タイプ別クリア
  - `getStats()` - 統計取得
  - `reduceMemory()` - メモリ圧迫時の削減
- **documentStore更新**: `cacheManager.clearForDocument()`を使用

##### メモリリーク対策
- **Canvas明示解放**: `releaseCanvas()`関数追加
  - `src/utils/pdfRenderer.ts` - PDFレンダリング後にCanvas解放
  - `src/utils/imageCompression.ts` - 圧縮処理後にCanvas解放
- **ImageBitmap解放**: `close()`呼び出しの徹底
  - `src/utils/backgroundImageCache.ts` - 上書き時に古いBitmapを解放
- **ページ数制限見直し**: MAX_PAGES 500→200に引き下げ

##### タブ切り替え時のレース条件修正
- **リクエストID管理**: 古いリクエストを無視
  - `src/App.tsx` - `switchDocumentRequestIdRef`でリクエスト追跡
  - プリロード中のタブ切り替えでも安全に動作

##### 一時ファイルクリーンアップ
- **自動削除**: 1時間以上経過した印刷用一時ファイルを削除
  - `src-tauri/src/commands.rs` - `cleanup_old_temp_files()`関数追加
  - `print_pdf()`コマンド実行時に自動クリーンアップ

### 2026-03-31
#### 校正記号ツール5種の移植（旧MojiQ ver_2.11より移植）
- **くの字ツール (chevron)**: ＜形の校正記号、Ctrl押下で∨方向に切替
- **L字ツール (lshape)**: L字型折れ線、ドラッグ方向で4方向自動判定（└ ┘ ┌ ┐）
- **Z字ツール (zshape)**: クランク形状（縦→横→縦）、Ctrl押下で横→縦→横に切替
- **コの字ツール (bracket)**: 全体移動指示の校正記号、セリフ付き、縦横自動判定
- **半円ツール (semicircle)**: 半円描画、縦横比で方向自動判定
- 各ツールの描画・プレビュー・ヒットテスト・PDF保存レンダリングを実装
- `DrawingToolbar`に「校正記号グループ」としてボタン追加
- `src/types/index.ts` - `ShapeType`に5種追加、`Shape`に`orientation`/`direction`/`flipped`/`rotated`プロパティ追加

#### コピー＆ペースト機能（旧MojiQ ver_2.11より移植）
- **Ctrl+C**: 選択中オブジェクト（ストローク・図形・テキスト・画像）をコピー
- **Ctrl+X**: カット（コピー後に削除、貼り付けは1回限り）
- **Ctrl+V**: 貼り付け（コピー時は20pxオフセット、カット時は元位置）
- アノテーション・引出線・フォントラベル・折れ線pointsの座標もオフセット適用
- 貼り付け後に新オブジェクトを自動選択
- `src/stores/drawingStore.ts` - `copySelected()`/`cutSelected()`/`pasteClipboard()`/`hasClipboard()`追加

#### オブジェクト回転機能（旧MojiQ ver_2.11より移植）
- **回転ハンドル**: 選択ボックス上辺中央から25px上に緑色の円（半径6px）
- **自由回転**: ドラッグで`atan2`による角度計算
- **15°スナップ**: Shift押下で15°単位にスナップ（`Math.round(angle / (π/12)) * (π/12)`）
- 図形（Shape）・画像（ImageElement）の両方に`rotation`プロパティ追加
- Canvas描画時に`ctx.translate → ctx.rotate → ctx.translate`変換を適用
- PDF保存用レンダラー（`drawingRenderer.ts`）にも同じ回転変換を適用
- Undo/Redo対応（回転終了時に履歴保存）

#### 全選択機能（Ctrl+A）
- **Ctrl+A**: 現在ページの表示レイヤーの全オブジェクトを一括選択
- ストローク・図形・テキスト・画像の全IDを収集し統合バウンディングボックスを計算
- `src/stores/drawingStore.ts` - `selectAll()`関数追加

#### モード切替スライドアニメーション（旧MojiQ ver_2.11より移植）
- **指示入れ→校正チェック**: `slideInFromRight`（右から20pxスライド、0.2秒ease-out）
- **校正チェック→指示入れ**: `slideInFromLeft`（左から20pxスライド、0.2秒ease-out）
- PDF読み込み後のみ発動（ホーム画面では無効）
- `src/App.css` - `@keyframes`定義、`.mode-transition-to-*`クラスで適用
- `src/App.tsx` - `useEffect`でモード変化を検知、200ms後にクラス除去

#### 校正チェック検索機能（旧MojiQ ver_2.11より移植）
- **検索バー**: タブと内容エリアの間に配置、プレースホルダー「検索...」
- **即時フィルタ**: 入力ごとに正誤/提案/コメントの項目をフィルタリング
  - 正誤・提案タブ: `content`・`excerpt`・`category`フィールドを検索
  - コメントタブ: コメントテキストを検索
- **検索結果件数表示**: 入力欄右に「N件」表示
- **クリアボタン**: ×アイコンで検索をクリア、Escapeキーでも可能
- **タブ切替時自動クリア**: タブを切り替えると検索欄が自動リセット
- `src/components/ProofreadingPanel/ProofreadingPanel.tsx` - 検索state・フィルタロジック・UI追加
- `src/components/ProofreadingPanel/ProofreadingPanel.css` - 検索バーのスタイル

#### 四分アキスタンプ追加
- **四分アキスタンプ**: `yonbunakiStamp`（テキストスタンプ「四分アキ」、サイズ14）
- 引出線対応（ドラッグで引出線付き配置可能）
- `RightToolbar`・`ProofreadingToolPanel`のスタンプ一覧に追加

### 2026-04-01
#### ビューポートカリング（旧MojiQ ver_2.11より移植）
- **画面外オブジェクトの描画スキップ**: パフォーマンス最適化
  - `src/utils/viewportCulling.ts` - カリングユーティリティ新規作成
  - `getVisibleViewport()` - スクロール領域からキャンバス座標系のビューポート矩形を計算
  - `isStrokeVisible()` / `isShapeVisible()` / `isTextVisible()` / `isImageVisible()` - バウンディングボックス判定
  - ビューポート外マージン: 100px（部分表示対応）
  - 選択中オブジェクトは常に描画（UIインタラクション維持）
- `src/hooks/useCanvas.ts` - `redrawCanvas`内でカリング判定を追加、`scrollAreaRef`追加
- `src/components/Canvas/DrawingCanvas.tsx` - スクロール時に`requestAnimationFrame`で再描画

#### オブジェクト数/ストロークポイント制限（旧MojiQ ver_2.11より移植）
- **メモリ保護**: ページあたり最大オブジェクト数・ストロークポイント数を制限
  - `src/constants/loadingLimits.ts` - 定数追加
    - `OBJECT_LIMITS.MAX_PER_PAGE: 5000` / `WARNING_PER_PAGE: 3000`
    - `STROKE_LIMITS.MAX_POINTS: 50000`
    - `TEXT_LIMITS.MAX_LENGTH: 50000`
  - `src/stores/drawingStore.ts` - `countPageObjects()` / `isPageObjectLimitReached()` ヘルパー追加
    - `addStroke` / `addShape` / `addText` / `addImage` / `addStamp` の5関数に制限チェック
    - 上限到達時はオブジェクト追加をブロック＋アラート表示
  - `src/hooks/useCanvas.ts` - ストロークポイント50,000到達で自動終了

#### ファイルロック — 保存中の競合防止（旧MojiQ ver_2.11より移植）
- **保存ロック機構**: 複数の保存リクエストが同時に走るのを防止
  - `src/utils/saveLock.ts` - ロックユーティリティ新規作成
    - `acquireSaveLock(pageCount, totalObjects)` - ロック取得（動的タイムアウト付き）
    - `releaseSaveLock()` - ロック解放
    - 動的タイムアウト: ベース60秒 + (ページ数×3秒) + (オブジェクト数×500ms)、最大10分
    - タイムアウト超過で自動解放（デッドロック防止）
  - `src/components/HeaderBar/HeaderBar.tsx` - `savePdfToPath()`にロック取得/解放を統合

#### ディスク容量チェック — 保存前確認（旧MojiQ ver_2.11より移植）
- **保存前にディスク空き容量を確認**: 容量不足時はエラーダイアログを表示
  - `src-tauri/src/commands.rs` - `check_disk_space` Tauriコマンド追加
    - Windows: `wmic`コマンドでドライブ空き容量を取得
    - ドライブレターバリデーション（コマンドインジェクション対策）
    - 必要容量の1.5倍マージンで判定
    - 非Windows/コマンド失敗時はチェックスキップ（グレースフルフォールバック）
  - `src-tauri/src/lib.rs` - コマンド登録
  - `src/components/HeaderBar/HeaderBar.tsx` - 保存前にディスク容量チェック実行

#### チェック済み状態の永続化 — 再読み込み時のチェック状態復元（旧MojiQ ver_2.11より移植）
- **校正チェックのチェック済み状態を`.mojiq.json`に保存・復元**
  - `src/stores/proofreadingCheckStore.ts` - チェック済み状態をストアに移動
    - `CheckedState`型エクスポート（`checkedComments` / `checkedCorrectnessItems` / `checkedProposalItems`）
    - `getCheckedState()` - シリアライズ可能な形式で取得（Set→Array）
    - `restoreCheckedState()` - 保存データから復元（Array→Set）
    - `resetCheckedState()` - 全チェック状態クリア
  - `src/utils/drawingExportImport.ts` - エクスポートデータv1.2に`checkedState`フィールド追加
    - `prepareExportData(pages, checkedState)` - チェック状態を含めてエクスポート
    - v1.1以前のデータも引き続き読み込み可能（後方互換性）
  - `src/components/HeaderBar/HeaderBar.tsx` - 保存時にチェック状態をエクスポート、読み込み時に復元
  - `src/components/ProofreadingPanel/ProofreadingPanel.tsx` - ローカルstateからストアに移行

#### PDFテキストレイヤー表示 (Ctrl+T)（旧MojiQ ver_2.11より移植）
- **PDF元テキストのオーバーレイ表示**: Ctrl+Tで切り替え
  - `src/stores/textLayerStore.ts` - テキストレイヤー表示状態の管理（新規作成）
    - `isVisible` - 表示/非表示状態
    - `pageTextItems` - ページごとの抽出済みテキストキャッシュ（`Map<number, PdfTextItem[]>`）
    - `toggle()` / `show()` / `hide()` / `clearCache()`
  - `src/utils/pdfRenderer.ts` - `extractPdfTextContent()` 関数追加
    - PDF.js `getTextContent()` APIで元テキストの位置・サイズ・フォント・回転を抽出
    - PDF座標（左下原点）→キャンバス座標（左上原点）変換
  - `src/components/Canvas/DrawingCanvas.tsx` - テキストレイヤーオーバーレイ描画
    - 背景キャンバスと描画キャンバスの間に`<div class="pdf-text-layer">`を配置
    - 各テキストを`<span>`でabsolute配置（位置・フォントサイズ・回転反映）
    - `pointer-events: none`で描画操作を妨げない
    - オンデマンド抽出（表示時のみ、結果はキャッシュ）
  - `src/components/Canvas/DrawingCanvas.css` - 半透明（opacity: 0.35）オーバーレイ、ダークモード対応
  - `src/App.tsx` - Ctrl+Tでテキストレイヤー＋コメントテキスト同時トグル
  - `src/stores/documentStore.ts` - ドキュメント閉じ時にテキストレイヤーキャッシュクリア

#### ホーム画面遷移時のタブリセット修正
- **バグ**: ハンバーガーメニュー「ホームに戻る」で描画状態はクリアされるが、ドキュメントタブが残り続けていた
- **原因**: `handleGoHome`が`drawingStore.clearDocument()`のみ呼び出し、`documentStore`のタブを閉じていなかった
- **修正**: `src/components/HamburgerMenu/HamburgerMenu.tsx`
  - ホーム画面遷移時に`[...tabOrder].forEach(id => closeDocument(id, true))`で全タブを強制クローズ
  - PDFリソース解放・キャッシュクリアも正しく実行される

### 2026-04-02
#### 旧MojiQ ver_2.13からの機能移植

##### Z-ordering（前面/背面移動）
- **`bringToFront()`**: 選択中オブジェクトをレイヤー内配列末尾に移動（前面へ）
- **`sendToBack()`**: 選択中オブジェクトをレイヤー内配列先頭に移動（背面へ）
- Undo/Redo対応、ストローク・図形・テキスト・画像すべてに対応
- `src/stores/drawingStore.ts` に実装

##### Ctrl+Arrowによる選択オブジェクト移動
- **Ctrl+↑↓←→**: 選択中オブジェクトを5pxずつ移動（v2.13と同じステップ幅）
- 選択なし時は従来通りCtrl+←→で最初/最後のページへジャンプ
- `moveSelectedByDelta()` - 全オブジェクト種別を一括移動＋selectionBounds更新
- `src/stores/drawingStore.ts` に実装、`src/App.tsx` にキーハンドラ追加

##### 両矢印+テキスト（doubleArrowAnnotated）
- 両矢印に引出線+テキスト指示を追加可能なアノテーション付きバリアント
- `src/types/index.ts` - `ShapeType`と`ToolType`に`'doubleArrowAnnotated'`追加
- `src/components/DrawingToolbar/DrawingToolbar.tsx` - 両矢印ボタンをtool-groupに変更
- `src/hooks/useCanvas.ts` - 図形描画、Shiftスナップ、アノテーションフェーズ管理に対応
- drawingRenderer.tsは`replace('Annotated', '')`で自動対応

##### PDFページ挿入機能
- **`insertBlankPage(position: 'before' | 'after')`**: 現在ページの前後に空白ページを挿入
  - 現在のページと同じサイズで空白ページを作成
  - ページ番号再割り当て、PDF関連情報も同期更新
  - Undo対応（履歴保存）
- `src/stores/drawingStore.ts` に実装
- `src/components/HeaderBar/HeaderBar.tsx` - 見開きメニューの「ページ操作」に挿入ボタン追加

##### PDF注釈コメントの校正チェックパネル表示（旧MojiQ ver_2.13より移植）
- **PDF読み込み時に注釈コメントをコメントタブに自動表示**
  - `src/stores/drawingStore.ts` - `loadDocumentWithAnnotations`で`pdfAnnotations`にデータを保存（従来は空配列だった）
  - `src/components/ProofreadingPanel/ProofreadingPanel.tsx` - 指示入れモードでもPDF注釈がある場合はパネル表示
    - 校正チェック専用UI（カラー/線太さ/スタンプ/読み込みボタン）は校正チェックモード時のみ表示
    - JSON未読み込み時にPDF注釈があればコメントタブに自動切替
  - `src/App.tsx` - `hasPdfAnnotationComments`フラグで指示入れモードでもProofreadingPanel表示
- コメントタブ機能: ページジャンプリンク、コメント内容表示、チェックボックス＋済スタンプ配置/除去

#### モード切替アニメーション改善
- **カクツキ修正**: `.app-body`全体への`transform`アニメーションを廃止
  - `opacity`のみのフェードアニメーション（0.15秒）に変更
  - `opacity`はコンポジタスレッドのみで処理されレイアウト/ペイントが不要
  - `src/App.css` - `modeFadeIn`キーフレームに変更

### 2026-04-02（続き）
#### アプリ名リネーム: MojiQ 3.0 → MojiQ Pro 1.0
- **全体リネーム**: アプリ名を「MojiQ Pro」、バージョンを「1.0.0」に変更
  - `src-tauri/tauri.conf.json` - productName, version, window title
  - `package.json` - name → `mojiq-pro`, version → `1.0.0`
  - `src-tauri/Cargo.toml` - name → `mojiq-pro`, lib name → `mojiq_pro_lib`
  - `src-tauri/src/main.rs` - `mojiq_pro_lib::run()`
  - `src-tauri/src/pdf.rs` - PDFメタデータ → `MojiQ Pro Document`
  - `index.html`, `proofreading-viewer.html` - タイトル更新
  - `src/components/HeaderBar/HeaderBar.tsx` - ファイルダイアログ名・alt属性

#### 指示入れモードのサイドバー修正
- **RightToolbar復元**: 指示入れモードで常にRightToolbar（指示ツール・文字サイズ等）を表示
  - PDF注釈がある場合にProofreadingPanelに置き換わるバグを修正
  - `src/App.tsx` - `hasPdfAnnotationComments`による条件分岐を削除
  - ProofreadingPanelは校正チェックモード時のみ表示

#### サイドバーボタンのバッジ表示
- **文字サイズボタン**: 選択中のサイズを青いグラデーションバッジで表示（例: `16P`）
- **フォント指定ボタン**: 選択中のフォント名をフォント色の枠線バッジで表示
- **校正ツールボタン**: 選択中のツール名をピンク系グラデーションバッジで表示
  - スタンプ系・描画ツール系の全校正ツールに対応
  - `src/components/RightToolbar/RightToolbar.tsx` - バッジUI追加、currentStampType取得
  - `src/components/RightToolbar/RightToolbar.css` - `.right-toolbar-btn-badge`スタイル追加

#### 校正チェックモードの線の太さ入力を指示入れモードと統一
- **仕様統一**: 校正チェックモードの入力仕様を指示入れモードに揃えた
  - number input max: 20 → 50、step: 0.5 → 1（整数のみ）
  - `parseFloat` → `parseInt`、スライダーハンドラを共通化
  - スライダー色を`#ff9800`に統一、背景を`var(--bg-tertiary)`に
  - スピンボタン非表示、ホバー時つまみ拡大を追加
  - px単位を入力欄の右隣に横並び配置（`.panel-line-width-row`ラッパー追加）
  - `src/components/ProofreadingPanel/ProofreadingPanel.tsx` - ハンドラ・UI修正
  - `src/components/ProofreadingPanel/ProofreadingPanel.css` - スタイル統一

#### 引出線ヒントメッセージ削除
- **不要なメッセージ除去**: 図形+テキストツールで引出線描画時の画面下部メッセージを削除
  - `src/components/Canvas/DrawingCanvas.tsx` - `annotationState === 2`の条件を除去
  - 折れ線描画中のヒントは引き続き表示

#### オブジェクト削除機能の修正
- **Deleteキー修正**: 図形（Shape）・画像（Image）も削除対象に追加
  - `src/App.tsx` - `selectedShapeIds`と`selectedImageIds`の条件を追加
- **削除ボタン追加**: 選択ボックスの右下に赤い円＋ゴミ箱アイコンのボタンを描画（旧MojiQ同様）
  - `src/hooks/useCanvas.ts` - `drawSelectionBounds`内で削除ボタン描画
  - サイズ24px、オフセット8px、赤色(`#F44336`)の円＋白色ゴミ箱アイコン
  - ポインターダウン時に円形ヒットテスト（半径+4px余裕）でクリック検出
  - `deleteSelectedStrokes()`で全オブジェクト種別を削除

### 2026-04-03
#### 校正チェックモードのページバー・コメントテキストボタン
- **ProofreadingPanel下部**: 指示入れモード同様のページバー非表示/コメントテキスト非表示ボタンを追加
  - `pageNavStore`・`commentVisibilityStore`と連動
  - 折りたたみ時は非表示

#### PDF保存時のコメントテキスト自動非表示
- **旧MojiQ準拠**: PDF保存後に`commentVisibilityStore.hide()`を呼び出し、コメントテキストを非表示状態にしてUIボタンに反映
  - 元PDFに既にテキストがあるため重複を避ける

#### Ctrl+S保存ショートカット
- **Ctrl+S**: PDF保存ショートカットを追加
  - 初回保存時は「名前を付けて保存」ダイアログを表示
  - 2回目以降は同じパスに上書き保存
  - `src/App.tsx` - `mojiq-save`イベント発行
  - `src/components/HeaderBar/HeaderBar.tsx` - イベントリスナーで保存処理

#### ハンバーガーメニューのz-index修正
- **ページバーとの重なり修正**: ハンバーガーメニューのz-indexをPageNav（9998-10000）より上に変更
  - `.hamburger-overlay`: 1000 → 10010
  - `.hamburger-menu`: 1001 → 10011

#### ドロップダウンのダークモード対応
- **PDF保存メニュー・ページ編集メニュー**: ハードコードされたカラー値をCSS変数に置換
  - `background: #fff` → `var(--bg-secondary)`
  - `color: #333` → `var(--text-primary)`
  - `border: #eee` → `var(--border-color)`
  - `hover: #f0f0f0` → `var(--bg-hover)`
  - 吹き出し三角形・SVG stroke・無効状態も対応

#### 校正チェックモードのカラースウォッチ統一
- **指示入れモードと統一**: サイズ21×21px、border-radius 3px、gap 3px
  - カスタムカラーボタン: `1px dashed var(--border-color)`、背景`var(--bg-tertiary)`
  - active状態: `var(--accent-color)`のborder+shadow
  - スポイトボタンも同サイズに統一

#### カスタムカラーピッカー（リアルタイム色変更）
- **旧MojiQ準拠**: カスタムカラーボタンクリックでネイティブカラーピッカーを起動
  - `onInput`イベントでドラッグ中リアルタイムに色反映
  - 選択中オブジェクトの色も`updateSelectedColor()`でリアルタイム変更
  - DrawingSettingsBar・ProofreadingPanel両方に実装

#### テキスト指示モーダル改善
- **OKボタン**: `OK (Ctrl+Enter)` → `OK` にショートカット表記を削除
- **ダークモード対応**: チェックボックスに`accent-color`・`color-scheme: light dark`、数値入力にも`color-scheme`追加

#### ホーム画面遷移のカスタムモーダル化
- **ネイティブダイアログ廃止**: `ask()`をカスタムモーダルに置換
  - CSS変数によるダークモード自動対応
  - 「ホームに戻る」ボタンは赤色（破壊的操作）

#### 正誤・提案タブのチェック済み表示改善
- **「確認済み」ラベル削除**: カテゴリヘッダー・各項目の「確認済み」テキストを削除
- **チェック済みスタイル変更**: チェックボックス・ページリンクの色は変えず、メッセージ部分のみ色変更
  - 正誤・提案: `.panel-excerpt` → `#bbb`（ダーク: `#666`）、`.panel-content` → `#999`（ダーク: `#888`）
  - コメント: `.panel-comment-type`・`.panel-comment-text` → `opacity: 0.5`

#### 全消去確認のカスタムモーダル化
- **描画全消去**: ネイティブ`ask()`をカスタムモーダルに置換
  - ボタンクリック・Ctrl+Deleteの両方で同じモーダル表示
  - `mojiq-clear-all`イベントで連携

#### 作業履歴クリアの確認モーダル
- **RightToolbar**: 「履歴をクリア」ボタンにカスタム確認モーダルを追加
  - ダークモード対応、赤色の「クリア」ボタン

#### 指示入れモードのツールバー整理
- **校正記号ツール除外**: くの字・L字・Z字・コの字・半円の5ツールをDrawingToolbarから削除
- **矢印ツール移動**: 矢印・両矢印・両矢印+テキストをDrawingToolbarから削除し、校正記号ツールセクションに移動
  - RightToolbarの校正記号ツールグリッドに3ボタン追加（SVGアイコン付き）
  - ProofreadingToolPanelにも同様に追加
  - バッジ表示対応

#### 文字サイズパネルの追加・削除機能
- **追加ボタン**: インライン入力欄でサイズ追加（1〜200pt、Enter/OKで確定）
- **削除ボタン**: 削除モードトグル（×マーク表示、クリックで削除）
- **レイアウト**: 4列グリッド、5行以上はスクロール（max-height: 160px）、追加・削除ボタンはスクロール外に固定

#### フォント指定パネルのレイアウト改善
- **スクロールパネル化**: フォント一覧をmax-height: 160pxのスクロール領域に配置
- **フッター固定**: 「+ フォント追加」ボタンをスクロール外に固定
- **モーダル操作時のポップアップ維持**: フォント追加/編集モーダル表示中はフォントパネルが閉じないように修正

#### 正誤・提案の全チェック完了時の自動閉じ
- **カテゴリ自動折りたたみ**: すべてのチェックボックスにチェックを入れると、該当タブのカテゴリが自動で閉じる
  - 各チェックハンドラ内で全完了判定、`setTimeout`で確実に反映

#### 校正チェックデータのドキュメント連動リセット
- **`mojiq-document-changed`イベント**: `documentStore`の`loadIntoActiveDocument`・`closeDocument`・`switchDocument`からイベント発行
  - ProofreadingPanelがイベントを受信し、正誤・提案・コメントデータ、チェック状態、折りたたみ状態をすべてリセット

### 2026-04-06
#### 文字サイズパネル改善
- **すべて削除ボタン**: 全文字サイズを一括削除するボタンを追加（確認モーダル付き）
  - `presetStore.ts` - `clearFontSizes()` メソッド追加
  - ボタンカラー: `var(--text-secondary)`（白系）
- **ボタンレイアウト変更**: 「+ コメント追加」「削除」「すべて削除」を全幅縦並びに変更（フォント指定と統一）
- **空状態メッセージ**: 項目が0件の場合「コメントがありません。追加するか作品仕様を読み込みから読み込んで下さい。」を表示
- **追加ボタン文言変更**: 「追加」→「+ コメント追加」

#### フォント指定パネル改善
- **すべて削除ボタン**: 全フォントを一括削除するボタンを追加（確認モーダル付き）
- **削除方式変更**: 項目右の×ボタン削除から、削除ボタンのトグル方式に変更（文字サイズと統一）
  - 削除モード中はフォント項目が赤枠+×マーク表示、クリックで削除
  - 削除モード中はダブルクリック編集を無効化
  - パネルを閉じると削除モード自動解除
- **空状態メッセージ**: 項目が0件の場合「フォントがありません。追加するか作品仕様を読み込みから読み込んで下さい。」を表示

#### 作業履歴パネル改善
- **空状態メッセージ**: 作業履歴がない場合「作業履歴がありません」を表示

#### 選択ハンドル・UIのスケーリング修正
- **displayScale対応**: 選択枠の線幅、四隅ハンドル、回転ハンドル、削除ボタンに`1/displayScale`を適用
  - キャンバスのCSS縮小後も画面上で旧MojiQと同じサイズで表示
  - ヒットテスト側も同様にスケーリング
  - `useDisplayScaleStore.getState()`で最新値を直接取得（クロージャの古い値問題を回避）

#### オブジェクト拡大縮小機能
- **四隅ハンドルからリサイズ**: 選択中オブジェクトの四隅ハンドルをドラッグして拡大縮小
  - `drawingStore.ts` - `resizeSelected()` 関数追加
    - ストローク: 各ポイント座標をスケール
    - 図形: startPos/endPos、points、annotation、leaderLine、fontLabelをスケール
    - テキスト: 位置とfontSizeをスケール（最小スケール使用）
    - 画像: startPos/endPosをスケール
    - スタンプ: sizeをスケール
  - `useCanvas.ts` - リサイズ用refを追加（`isResizingHandleRef`等）
    - pointerDown: 四隅ハンドルのヒットテスト（回転・削除より前に配置）
    - pointerMove: ハンドル方向に応じたバウンディングボックス計算＋リアルタイムリサイズ
    - pointerUp: 履歴保存＋状態リセット
  - 最小サイズ10px制限
  - Undo/Redo対応
- **リサイズカーソル**: ハンドルホバー時に`nwse-resize`/`nesw-resize`カーソルを表示
  - `DrawingCanvas.tsx` - `resizeCursor`をカーソル判定に統合

### 2026-04-06（続き）
#### 写植シミュレーター機能（旧MojiQ ver_2.16より移植）
- **GridSettingsPanel → TypesettingSimulator に置き換え**
  - `src/components/GridSettingsPanel/` - 削除（旧 縮尺・グリッド設定パネル）
  - `src/components/TypesettingSimulator/` - 新規作成（写植シミュレーター）
  - 旧MojiQの写植シミュレーターUI構造を移植
- **TypesettingSimulatorコンポーネント**: 左サイドバー（DrawingSettingsBar内）に配置
  - セクションラベル「写植シミュレーター」
  - 縮尺表示（設定済/未設定）
  - 3つのツールボタン:
    - 縮尺合わせ（オレンジ色パルスアニメーション）
    - 一文字グリッド（1x1固定、縮尺設定後に有効化）
    - セリフ見本（テキスト入力後に有効化、テキストから行数・文字数を自動計算）
  - セリフ見本入力エリア（textarea、横/縦方向切替、削除ボタン）
  - サイズ表示ダッシュボード（ptサイズ、調整中のみアクティブ表示）
  - グリッド削除ボタン（Delete/Backspaceキーでも削除可能）
  - 縮尺入力モーダル
  - ダークモード完全対応
- **gridStore拡張**:
  - `gridMode: 'grid' | 'sampleGrid' | null` - 一文字グリッド/セリフ見本の区別
  - `enterGridMode(mode)` - モード引数追加
  - `deleteSelectedGrid()` / `confirmPendingGrid()` - グリッド管理アクション
  - ページ別undo/redoスタック（最大20件）: `saveStateForUndo()` / `undo()` / `redo()`
- **useCanvas.tsグリッド処理改善**:
  - `gridMode`に応じて1x1/テキスト計算を切替
  - 確定済みグリッドはグリッドモード外でも常に表示
  - グリッド外クリック時にpendingGridをページに確定保存（旧実装では破棄されていた）
  - グリッド操作時にundo保存

#### グリッドリサイズ方式変更（ハンドル → マウスホイール）
- **四隅ハンドル廃止**: グリッドの四隅リサイズハンドルを完全削除
  - `detectGridCorner` 関数削除
  - `isResizingGrid` / `resizingCorner` / `gridResizeStartRef` 状態変数削除
  - handlePointerDown/Move/Upのハンドル検出・ドラッグリサイズ処理削除
  - drawGridのハンドル描画削除
- **マウスホイールでptサイズ調整（旧MojiQ ver_2.16準拠）**:
  - グリッド上でホイール回転 → ±0.5pt/ノッチ（1-200pt範囲）
  - `centerPos`を基準に中央からリサイズ（旧MojiQ準拠）
  - pendingGrid（調整中）とページ配置済みグリッドの両方に対応
  - `e.preventDefault()` + `e.stopPropagation()` でページ移動をブロック
- **ネイティブwheelリスナー統合**: React `onWheel`（passive）を廃止し、全ホイール処理を`addEventListener('wheel', handler, { passive: false })`に統合
  - Ctrl+ホイール → ズーム
  - グリッド上ホイール → ptサイズ変更（ページ移動ブロック）
  - グリッド外ホイール → ページ移動
  - 座標変換: `canvasRef.getBoundingClientRect()` + `canvas.width/rect.width`スケーリング（`getPointerPosition`と同一方式）
- **調整中グリッドの視覚フィードバック**: ハンドルの代わりにシアン色(#00bcd4)の太枠で調整中を表示

#### ＋テキスト引出線のEscキャンセル
- **引出線描画中にEscで引出線のみキャンセル**（図形は残す）
  - `useCanvas.ts` - `annotationState === 2`のとき`keydown`リスナーを登録
  - Escキーで`annotationState`/`isDrawingLeader`/各refをリセット
  - `capture: true`で他のESCハンドラへの伝播を防止

### 2026-04-07
#### アイコン更新（MojiQ Pro対応）
- **アプリアイコン全面更新**: MojiQ Proの新アイコンに置き換え
  - `logo/MojiQ_icon.png` - 新MojiQ Proアイコンに更新
  - `src-tauri/icons/` - 全サイズPNG（32x32〜512x512）とICOをPillowで再生成
  - Windowsタスクバー・タイトルバー・インストーラーすべてに反映
- **不要ファイル削除**: `logo/` 配下の未使用ファイルを整理
  - `MojiQ_favicon.ico`, `MojiQ_icon.ico`, `MojiQ_logo.png` を削除
  - `pdf-icons/` ディレクトリ（`MojiQ-jpeg_256.ico`, `MojiQ-pdf_256.ico`）を削除

#### スプラッシュスクリーン
- **起動時スプラッシュ表示**: HTML事前スプラッシュ + React SplashScreenコンポーネントのハイブリッド方式
  - `index.html` - インラインHTML/CSS/JSでReactロード前からスプラッシュ表示（0%→30%）
  - `src/components/SplashScreen/` - Reactコンポーネント新規作成
    - HTMLスプラッシュの進捗値を引き継ぎ、30%→100%まで2秒でease-in-outアニメーション
    - 100%到達後に400msフェードアウト
  - `public/logo/MojiQ Pro_logo_WH.png` - スプラッシュ用ロゴ（静的アセット）
  - `<link rel="preload">` でロゴ画像を優先読み込み
- **デザイン**: 上部30%黒背景（ロゴ上下中央）、青プログレスバー、下部70%白背景（メッセージ+進捗%）
- **ウィンドウドラッグ対応**: `data-tauri-drag-region`属性でスプラッシュ上部からドラッグ可能

#### 方向キー設定の反映修正
- **環境設定の方向キー設定が反映されないバグを修正**
  - `src/App.tsx` - `useSettingsStore`をインポート、`getArrowKeyInverted()`で設定を参照
  - 通常モード・閲覧モード両方で方向キー反転設定に対応
- **ページバー操作後の方向キー設定反映修正**
  - `src/components/PageNav/PageNav.tsx` - スライダー・ボタン操作後に`blur()`でフォーカスを外す
  - フォーカスがスライダーに残りブラウザデフォルト動作が優先される問題を解消

#### 校正チェックパネルUI改善
- **読み込みボタン背景色**: `background: var(--bg-tertiary)` を削除し、カラー/線の太さセクションと統一
- **カラー・線の太さ間の区切り線**: 縦の区切り線（`panel-color-linewidth-divider`）を追加
  - `flex-wrap: nowrap` + `align-items: stretch` で区切り線がborder-bottomまで連続
- **プリセットカラーに黒を追加**: `PRESET_COLORS`に`#000000`を追加（黒、赤、青の3色）
- **レインボーパレット削除**: 指示入れモード・校正チェックモード両方から`GRADIENT_COLORS`とグラデーションバーUIを削除

#### 見開き表示の修正
- **サイドバー消失バグ修正**: 見開き表示時も全サイドバーを表示するように変更
  - `src/App.tsx` - `!isSpreadView &&` 条件を削除（DrawingSettingsBar, DrawingToolbar, RightToolbar, ProofreadingToolbar, ProofreadingPanel）
  - PageNavのみ見開き時は非表示（SpreadCanvasが独自ナビを持つため）
- **空白ページ挿入機能の削除**: 「前に空白ページ挿入」「後に空白ページ挿入」ボタンを削除
  - `src/components/HeaderBar/HeaderBar.tsx` - ページ操作セクションから挿入ボタンとInsertPageIconを削除
  - ページ削除ボタンは維持

#### その他
- **start-dev.bat**: 表示名を「MojiQ 3.0」→「MojiQ Pro 1.0」に更新
- **未使用変数の修正**: `App.tsx`の`pdfAnnotations`、`DrawingCanvas.tsx`の`annotationState`を削除（TypeScriptエラー修正）

### 2026-04-08
#### Alt+スクロールでポインター中心ズーム
- **Alt+ホイール**: ポインター位置を中心にズームイン/アウト
  - `src/components/Canvas/DrawingCanvas.tsx` - wheelハンドラの条件に`e.altKey`を追加
  - 既存のCtrl+ホイールと同じポインター中心ズームロジックを共有

#### 写植シミュレーター グリッド選択時の視覚強調
- **選択中グリッドの線を太く**: `isAdjusting`（pendingGrid）時に線幅を強調
  - `src/hooks/useCanvas.ts` - `drawGrid`関数で`isAdjusting`時に`lineWidth: 2.5`、色を`#00bcd4`（シアン）に変更
  - 通常の確定済みグリッドは従来通り緑色・1px

#### 写植シミュレーター グリッドのツール切り替え時リセット
- **ツール切り替え時にグリッドをクリア**: 別のツールに切り替えるとグリッドを全消去してグリッドモードを終了
  - `src/stores/drawingStore.ts` - `setTool`に`clearPageGrids`+`exitGridMode`呼び出しを追加
  - `src/stores/drawingStore.ts` - `useGridStore`をインポート
- **グリッド表示をグリッドモード中のみに制限**: グリッドモード外では描画しない
  - `src/hooks/useCanvas.ts` - グリッド描画を`gridState.isGridMode`条件でラップ

#### 写植シミュレーター ホーム画面遷移時の全リセット
- **`resetAll()`関数追加**: gridStoreの全状態を初期化
  - `src/stores/gridStore.ts` - `resetAll()`を追加（モード、pendingGrid、全ページグリッド、サンプルテキスト、undo/redoスタックをクリア）
  - `src/stores/drawingStore.ts` - `clearDocument`内で`gridStore.resetAll()`を呼び出し
  - ホーム画面遷移時に写植シミュレーターの状態が完全にリセットされる
