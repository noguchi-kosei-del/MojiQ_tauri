/**
 * 描画データのエクスポート/インポート機能
 * 描画情報をJSONファイルとして保存・読み込みできるようにする
 *
 * v1.1: 座標をページサイズベースで保存し、読み込み時に現在の表示サイズにスケーリング
 */

import { PageState, Layer, Stroke, Shape, TextElement, ImageElement, Point, Annotation } from '../types';

// エクスポートデータ形式（ver_2.08互換）
export interface MojiQExportData {
  version: string;  // '1.0', '1.1' など
  exportedAt: string;
  pageCount: number;
  pageSizes?: Record<string, { width: number; height: number }>;  // v1.1以降
  data: Record<string, ExportedObject[]>;
}

// エクスポートされるオブジェクト（フラット構造）
export interface ExportedObject {
  id: string;
  type: 'stroke' | 'shape' | 'text' | 'image';
  layerId: string;

  // Stroke fields
  points?: Point[];
  isMarker?: boolean;
  opacity?: number;

  // Shape fields
  shapeType?: string;
  startPos?: Point;
  endPos?: Point;
  stampType?: string;
  size?: number;
  annotation?: Annotation;
  leaderLine?: { start: Point; end: Point };
  label?: string;
  fontLabel?: {
    fontName: string;
    textX: number;
    textY: number;
    textAlign: 'left' | 'right';
  };

  // Text fields
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  isVertical?: boolean;
  pdfAnnotationSource?: string;

  // Image fields
  imageData?: string;

  // Common fields
  color: string;
  width?: number;
}

const VERSION = '1.1';
const FILE_EXTENSION = '.mojiq.json';

/**
 * オブジェクトの座標をスケーリング
 */
function scaleObjectCoordinates(obj: ExportedObject, scaleX: number, scaleY: number): ExportedObject {
  const scaled = { ...obj };

  // startPos / endPos
  if (scaled.startPos) {
    scaled.startPos = {
      x: scaled.startPos.x * scaleX,
      y: scaled.startPos.y * scaleY,
    };
  }
  if (scaled.endPos) {
    scaled.endPos = {
      x: scaled.endPos.x * scaleX,
      y: scaled.endPos.y * scaleY,
    };
  }

  // points array
  if (scaled.points && Array.isArray(scaled.points)) {
    scaled.points = scaled.points.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
      pressure: p.pressure,
    }));
  }

  // x / y (text position)
  if (typeof scaled.x === 'number') {
    scaled.x = scaled.x * scaleX;
  }
  if (typeof scaled.y === 'number') {
    scaled.y = scaled.y * scaleY;
  }

  // leaderLine
  if (scaled.leaderLine) {
    scaled.leaderLine = {
      start: {
        x: scaled.leaderLine.start.x * scaleX,
        y: scaled.leaderLine.start.y * scaleY,
      },
      end: {
        x: scaled.leaderLine.end.x * scaleX,
        y: scaled.leaderLine.end.y * scaleY,
      },
    };
  }

  // fontLabel textX / textY
  if (scaled.fontLabel) {
    scaled.fontLabel = {
      ...scaled.fontLabel,
      textX: scaled.fontLabel.textX * scaleX,
      textY: scaled.fontLabel.textY * scaleY,
    };
  }

  // annotation
  if (scaled.annotation) {
    scaled.annotation = {
      ...scaled.annotation,
      x: scaled.annotation.x * scaleX,
      y: scaled.annotation.y * scaleY,
      fontSize: scaled.annotation.fontSize * Math.min(scaleX, scaleY),
      leaderLine: {
        start: {
          x: scaled.annotation.leaderLine.start.x * scaleX,
          y: scaled.annotation.leaderLine.start.y * scaleY,
        },
        end: {
          x: scaled.annotation.leaderLine.end.x * scaleX,
          y: scaled.annotation.leaderLine.end.y * scaleY,
        },
      },
    };
  }

  // width (stroke width)
  if (typeof scaled.width === 'number' && scaled.type === 'stroke') {
    scaled.width = scaled.width * Math.min(scaleX, scaleY);
  }

  // fontSize
  if (typeof scaled.fontSize === 'number') {
    scaled.fontSize = scaled.fontSize * Math.min(scaleX, scaleY);
  }

  // size (stamp size)
  if (typeof scaled.size === 'number') {
    scaled.size = scaled.size * Math.min(scaleX, scaleY);
  }

  return scaled;
}

/**
 * StrokeをExportedObjectに変換
 */
function strokeToExportedObject(stroke: Stroke): ExportedObject {
  return {
    id: stroke.id,
    type: 'stroke',
    layerId: stroke.layerId,
    points: stroke.points,
    color: stroke.color,
    width: stroke.width,
    isMarker: stroke.isMarker,
    opacity: stroke.opacity,
  };
}

/**
 * ShapeをExportedObjectに変換
 */
function shapeToExportedObject(shape: Shape): ExportedObject {
  return {
    id: shape.id,
    type: 'shape',
    layerId: shape.layerId,
    shapeType: shape.type,
    startPos: shape.startPos,
    endPos: shape.endPos,
    color: shape.color,
    width: shape.width,
    points: shape.points,
    stampType: shape.stampType,
    size: shape.size,
    annotation: shape.annotation,
    leaderLine: shape.leaderLine,
    label: shape.label,
    fontLabel: shape.fontLabel,
  };
}

/**
 * TextElementをExportedObjectに変換
 */
function textToExportedObject(text: TextElement): ExportedObject {
  return {
    id: text.id,
    type: 'text',
    layerId: text.layerId,
    text: text.text,
    x: text.x,
    y: text.y,
    color: text.color,
    fontSize: text.fontSize,
    isVertical: text.isVertical,
    pdfAnnotationSource: text.pdfAnnotationSource,
  };
}

/**
 * ImageElementをExportedObjectに変換
 */
function imageToExportedObject(image: ImageElement): ExportedObject {
  return {
    id: image.id,
    type: 'image',
    layerId: image.layerId,
    startPos: image.startPos,
    endPos: image.endPos,
    imageData: image.imageData,
    color: '#000000', // dummy, required field
  };
}

/**
 * レイヤー構造からフラットなオブジェクト配列に変換
 */
function flattenPageData(pageState: PageState): ExportedObject[] {
  const objects: ExportedObject[] = [];

  for (const layer of pageState.layers) {
    // 全てのストロークを追加
    for (const stroke of layer.strokes) {
      objects.push(strokeToExportedObject(stroke));
    }

    // 全ての図形を追加
    for (const shape of layer.shapes) {
      objects.push(shapeToExportedObject(shape));
    }

    // 全てのテキストを追加
    for (const text of layer.texts) {
      objects.push(textToExportedObject(text));
    }

    // 全ての画像を追加
    for (const image of layer.images) {
      objects.push(imageToExportedObject(image));
    }
  }

  return objects;
}

/**
 * ExportedObjectをStrokeに変換
 */
function exportedObjectToStroke(obj: ExportedObject): Stroke {
  return {
    id: obj.id,
    points: obj.points || [],
    color: obj.color,
    width: obj.width || 2,
    layerId: obj.layerId,
    isMarker: obj.isMarker,
    opacity: obj.opacity,
  };
}

/**
 * ExportedObjectをShapeに変換
 */
function exportedObjectToShape(obj: ExportedObject): Shape {
  return {
    id: obj.id,
    type: (obj.shapeType || 'rect') as Shape['type'],
    startPos: obj.startPos || { x: 0, y: 0 },
    endPos: obj.endPos || { x: 0, y: 0 },
    color: obj.color,
    width: obj.width || 2,
    layerId: obj.layerId,
    points: obj.points,
    stampType: obj.stampType as Shape['stampType'],
    size: obj.size,
    annotation: obj.annotation,
    leaderLine: obj.leaderLine,
    label: obj.label,
    fontLabel: obj.fontLabel,
  };
}

/**
 * ExportedObjectをTextElementに変換
 */
function exportedObjectToText(obj: ExportedObject): TextElement {
  return {
    id: obj.id,
    text: obj.text || '',
    x: obj.x || 0,
    y: obj.y || 0,
    color: obj.color,
    fontSize: obj.fontSize || 14,
    isVertical: obj.isVertical || false,
    layerId: obj.layerId,
    pdfAnnotationSource: obj.pdfAnnotationSource as TextElement['pdfAnnotationSource'],
  };
}

/**
 * ExportedObjectをImageElementに変換
 */
function exportedObjectToImage(obj: ExportedObject): ImageElement {
  return {
    id: obj.id,
    startPos: obj.startPos || { x: 0, y: 0 },
    endPos: obj.endPos || { x: 0, y: 0 },
    imageData: obj.imageData || '',
    layerId: obj.layerId,
  };
}

/**
 * フラットなオブジェクト配列をレイヤー構造に復元
 */
function unflattenToLayers(objects: ExportedObject[], existingLayers: Layer[]): Layer[] {
  // layerIdごとにオブジェクトをグループ化
  const groupedByLayer: Record<string, ExportedObject[]> = {};

  for (const obj of objects) {
    const layerId = obj.layerId || existingLayers[0]?.id || 'default';
    if (!groupedByLayer[layerId]) {
      groupedByLayer[layerId] = [];
    }
    groupedByLayer[layerId].push(obj);
  }

  // 既存のレイヤーをコピーしてオブジェクトを追加
  const newLayers = existingLayers.map((layer) => ({
    ...layer,
    strokes: [] as Stroke[],
    shapes: [] as Shape[],
    texts: [] as TextElement[],
    images: [] as ImageElement[],
  }));

  // 各グループのオブジェクトをレイヤーに追加
  for (const [layerId, layerObjects] of Object.entries(groupedByLayer)) {
    let targetLayer = newLayers.find((l) => l.id === layerId);

    // レイヤーが見つからない場合は最初のレイヤーに追加
    if (!targetLayer) {
      if (newLayers.length === 0) {
        newLayers.push({
          id: layerId,
          name: 'レイヤー 1',
          visible: true,
          opacity: 1,
          strokes: [],
          shapes: [],
          texts: [],
          images: [],
        });
      }
      targetLayer = newLayers[0];
    }

    for (const obj of layerObjects) {
      switch (obj.type) {
        case 'stroke':
          targetLayer.strokes.push(exportedObjectToStroke(obj));
          break;
        case 'shape':
          targetLayer.shapes.push(exportedObjectToShape(obj));
          break;
        case 'text':
          targetLayer.texts.push(exportedObjectToText(obj));
          break;
        case 'image':
          targetLayer.images.push(exportedObjectToImage(obj));
          break;
      }
    }
  }

  return newLayers;
}

/**
 * インポートデータのバリデーション
 */
export function validateImportData(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '無効なデータ形式です。' };
  }

  const exportData = data as Partial<MojiQExportData>;

  if (!exportData.version) {
    return { valid: false, error: 'バージョン情報がありません。MojiQの描画データファイルではない可能性があります。' };
  }

  if (!exportData.data || typeof exportData.data !== 'object') {
    return { valid: false, error: '描画データが含まれていません。' };
  }

  // 各ページのオブジェクトを検証
  for (const pageNum in exportData.data) {
    const objects = exportData.data[pageNum];
    if (!Array.isArray(objects)) {
      return { valid: false, error: `ページ ${pageNum} のデータが不正です。` };
    }

    for (const obj of objects) {
      if (!obj.type || !obj.id) {
        return { valid: false, error: `ページ ${pageNum} に不正なオブジェクトがあります。` };
      }
    }
  }

  return { valid: true };
}

/**
 * 描画データをエクスポート形式に変換
 */
export function prepareExportData(pages: PageState[]): MojiQExportData {
  const data: Record<string, ExportedObject[]> = {};
  const pageSizes: Record<string, { width: number; height: number }> = {};

  for (const page of pages) {
    const pageNum = String(page.pageNumber);
    const objects = flattenPageData(page);

    // 描画データがあるページのみエクスポート
    if (objects.length > 0) {
      data[pageNum] = objects;
      pageSizes[pageNum] = {
        width: page.width,
        height: page.height,
      };
    }
  }

  return {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    pageCount: Object.keys(data).length,
    pageSizes,
    data,
  };
}

/**
 * インポートデータを座標スケーリングして返す
 */
export function scaleImportData(
  importData: MojiQExportData,
  currentPages: PageState[]
): Record<string, ExportedObject[]> {
  const scaledData: Record<string, ExportedObject[]> = {};

  for (const pageNumStr in importData.data) {
    const pageNum = parseInt(pageNumStr);
    const currentPage = currentPages.find((p) => p.pageNumber === pageNum);
    const savedPageSize = importData.pageSizes?.[pageNumStr];

    if (!currentPage) {
      // ページが存在しない場合はスキップ
      continue;
    }

    const objects = importData.data[pageNumStr];

    // v1.0以前またはページサイズ情報がない場合はスケーリングしない
    if (importData.version === '1.0' || !savedPageSize) {
      scaledData[pageNumStr] = objects;
      continue;
    }

    // サイズが同じ場合もスケーリング不要
    if (savedPageSize.width === currentPage.width && savedPageSize.height === currentPage.height) {
      scaledData[pageNumStr] = objects;
      continue;
    }

    // スケール計算
    const scaleX = currentPage.width / savedPageSize.width;
    const scaleY = currentPage.height / savedPageSize.height;

    scaledData[pageNumStr] = objects.map((obj) => scaleObjectCoordinates(obj, scaleX, scaleY));
  }

  return scaledData;
}

/**
 * インポートデータをページに適用
 */
export function applyImportDataToPages(
  scaledData: Record<string, ExportedObject[]>,
  currentPages: PageState[]
): PageState[] {
  const newPages = currentPages.map((page) => {
    const pageNumStr = String(page.pageNumber);
    const objects = scaledData[pageNumStr];

    if (!objects || objects.length === 0) {
      // インポートデータがないページは既存のレイヤーをクリア
      return {
        ...page,
        layers: page.layers.map((layer) => ({
          ...layer,
          strokes: [],
          shapes: [],
          texts: [],
          images: [],
        })),
      };
    }

    // オブジェクトをレイヤー構造に復元
    const newLayers = unflattenToLayers(objects, page.layers);

    return {
      ...page,
      layers: newLayers,
    };
  });

  return newPages;
}

/**
 * エクスポートデータをJSON文字列に変換
 */
export function exportDataToJson(data: MojiQExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * JSON文字列をインポートデータに変換
 */
export function parseImportJson(jsonString: string): MojiQExportData {
  const data = JSON.parse(jsonString);
  const validation = validateImportData(data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return data as MojiQExportData;
}

/**
 * デフォルトのエクスポートファイル名を生成
 */
export function generateExportFileName(documentTitle: string): string {
  const baseName = documentTitle.replace(/\.(pdf|jpg|jpeg|png)$/i, '');
  return `${baseName}_描画${FILE_EXTENSION}`;
}

/**
 * PDFパスから描画データJSONのパスを生成
 */
export function getDrawingJsonPath(pdfPath: string): string {
  return pdfPath.replace(/\.(pdf|jpg|jpeg|png)$/i, '_描画.json');
}
