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
- **小文字スタンプ**: 小文字指定

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
| `loadingStore` | ローディング状態 |
| `presetStore` | プリセット設定 |
| `sidebarStore` | サイドバー状態 |
| `settingsStore` | 環境設定（ショートカット、スクロール方向等） |
| `calibrationStore` | 縮尺設定（pixelsPerMm、キャリブレーションモード） |
| `gridStore` | 写植グリッド（ページごとのグリッド、書き方向、サンプルテキスト） |

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
│   │   └── ...              # その他コンポーネント
│   ├── stores/              # Zustand状態管理
│   │   ├── drawingStore.ts  # メイン描画状態
│   │   ├── documentStore.ts # ドキュメント管理
│   │   └── ...              # その他ストア
│   ├── hooks/               # カスタムフック
│   │   └── useCanvas.ts     # キャンバス操作フック
│   ├── types/               # 型定義
│   │   └── index.ts
│   └── utils/               # ユーティリティ
│       ├── pdfRenderer.ts   # PDF処理
│       └── backgroundImageCache.ts  # 背景画像キャッシュ
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
