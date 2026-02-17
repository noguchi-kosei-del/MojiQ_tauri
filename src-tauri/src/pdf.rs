use std::io::Cursor;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use ::image::{DynamicImage, GenericImageView, ImageFormat, Rgba, RgbaImage};
use printpdf::*;

use crate::commands::{PageData, SaveRequest};

#[allow(dead_code)]
pub fn render_pdf_pages(path: &str) -> Result<Vec<PageData>, Box<dyn std::error::Error>> {
    let doc = lopdf::Document::load(path)?;
    let page_count = doc.get_pages().len();

    let mut pages = Vec::new();

    for page_num in 0..page_count {
        let width = 595u32;
        let height = 842u32;

        let mut img = RgbaImage::new(width, height);

        for pixel in img.pixels_mut() {
            *pixel = Rgba([255, 255, 255, 255]);
        }

        for x in 0..width {
            img.put_pixel(x, 0, Rgba([200, 200, 200, 255]));
            img.put_pixel(x, height - 1, Rgba([200, 200, 200, 255]));
        }
        for y in 0..height {
            img.put_pixel(0, y, Rgba([200, 200, 200, 255]));
            img.put_pixel(width - 1, y, Rgba([200, 200, 200, 255]));
        }

        let dynamic_img = DynamicImage::ImageRgba8(img);
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);
        dynamic_img.write_to(&mut cursor, ImageFormat::Png)?;

        let image_data = BASE64.encode(&buffer);

        pages.push(PageData {
            page_number: page_num,
            image_data: format!("data:image/png;base64,{}", image_data),
            width,
            height,
        });
    }

    Ok(pages)
}

pub fn create_pdf_with_drawings(
    save_path: &str,
    request: &SaveRequest,
) -> Result<(), Box<dyn std::error::Error>> {
    // ページ数を確認
    let page_count = request.pages.len();
    if page_count == 0 {
        return Err("No pages to save".into());
    }

    // 最初のページのサイズを決定
    let first_bg = request.background_images.first();
    let (first_width_mm, first_height_mm) = if let Some(bg) = first_bg {
        if !bg.is_empty() {
            if let Some(bytes) = decode_data_url(bg) {
                if let Ok(img) = ::image::load_from_memory(&bytes) {
                    let (w, h) = img.dimensions();
                    (Mm(w as f32 * 25.4 / 72.0), Mm(h as f32 * 25.4 / 72.0))
                } else {
                    let p = &request.pages[0];
                    (Mm(p.width as f32 * 25.4 / 72.0), Mm(p.height as f32 * 25.4 / 72.0))
                }
            } else {
                let p = &request.pages[0];
                (Mm(p.width as f32 * 25.4 / 72.0), Mm(p.height as f32 * 25.4 / 72.0))
            }
        } else {
            let p = &request.pages[0];
            (Mm(p.width as f32 * 25.4 / 72.0), Mm(p.height as f32 * 25.4 / 72.0))
        }
    } else {
        let p = &request.pages[0];
        (Mm(p.width as f32 * 25.4 / 72.0), Mm(p.height as f32 * 25.4 / 72.0))
    };

    let (doc, page1, layer1) = PdfDocument::new(
        "MojiQ Document",
        first_width_mm,
        first_height_mm,
        "Layer 1",
    );

    let mut current_layer = doc.get_page(page1).get_layer(layer1);

    for idx in 0..page_count {
        let page_drawing = &request.pages[idx];
        let bg_image = request.background_images.get(idx);

        // 背景画像からサイズを取得、なければpage_drawingのサイズを使用
        let (width_mm, height_mm, loaded_image) = if let Some(bg) = bg_image {
            if !bg.is_empty() {
                if let Some(bytes) = decode_data_url(bg) {
                    if let Ok(img) = ::image::load_from_memory(&bytes) {
                        let (w, h) = img.dimensions();
                        (w as f32 * 25.4 / 72.0, h as f32 * 25.4 / 72.0, Some(img))
                    } else {
                        (page_drawing.width as f32 * 25.4 / 72.0, page_drawing.height as f32 * 25.4 / 72.0, None)
                    }
                } else {
                    (page_drawing.width as f32 * 25.4 / 72.0, page_drawing.height as f32 * 25.4 / 72.0, None)
                }
            } else {
                (page_drawing.width as f32 * 25.4 / 72.0, page_drawing.height as f32 * 25.4 / 72.0, None)
            }
        } else {
            (page_drawing.width as f32 * 25.4 / 72.0, page_drawing.height as f32 * 25.4 / 72.0, None)
        };

        // 2ページ目以降は新しいページを追加
        if idx > 0 {
            let (new_page, new_layer) = doc.add_page(
                Mm(width_mm),
                Mm(height_mm),
                format!("Page {}", idx + 1),
            );
            current_layer = doc.get_page(new_page).get_layer(new_layer);
        }

        // 背景画像を追加
        if let Some(img) = loaded_image {
            let (img_width, img_height) = img.dimensions();
            let rgb_img = img.to_rgb8();

            let image = Image::from(ImageXObject {
                width: Px(img_width as usize),
                height: Px(img_height as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_img.into_raw(),
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            });

            // 画像をページ全体に配置
            // printpdfのデフォルトDPIは300、ページは72DPIで計算しているので調整
            // dpi: Some(72.0)を設定して72DPIとして扱う
            image.add_to_layer(
                current_layer.clone(),
                ImageTransform {
                    translate_x: Some(Mm(0.0)),
                    translate_y: Some(Mm(0.0)),
                    scale_x: None,
                    scale_y: None,
                    dpi: Some(72.0),
                    ..Default::default()
                },
            );
        }

        // ストロークを描画
        for stroke in &page_drawing.strokes {
            if stroke.points.len() < 2 {
                continue;
            }

            let (r, g, b) = parse_color(&stroke.color);

            current_layer.set_outline_color(Color::Rgb(Rgb::new(
                r as f32 / 255.0,
                g as f32 / 255.0,
                b as f32 / 255.0,
                None,
            )));
            current_layer.set_outline_thickness(stroke.width as f32);

            // ストロークの座標をPDF座標に変換
            let scale_x = width_mm as f64 / page_drawing.width as f64;
            let scale_y = height_mm as f64 / page_drawing.height as f64;

            let points: Vec<(Point, bool)> = stroke
                .points
                .iter()
                .enumerate()
                .map(|(i, (x, y))| {
                    let pdf_x = x * scale_x;
                    let pdf_y = (page_drawing.height as f64 - y) * scale_y;
                    (
                        Point::new(Mm(pdf_x as f32), Mm(pdf_y as f32)),
                        i == 0,
                    )
                })
                .collect();

            let line = Line {
                points: points.iter().map(|(p, _)| (*p, false)).collect(),
                is_closed: false,
            };

            current_layer.add_line(line);
        }
    }

    doc.save(&mut std::io::BufWriter::new(std::fs::File::create(save_path)?))?;
    Ok(())
}

fn decode_data_url(data_url: &str) -> Option<Vec<u8>> {
    if let Some(comma_pos) = data_url.find(',') {
        let base64_data = &data_url[comma_pos + 1..];
        BASE64.decode(base64_data).ok()
    } else {
        None
    }
}

fn parse_color(color: &str) -> (u8, u8, u8) {
    if color.starts_with('#') && color.len() == 7 {
        let r = u8::from_str_radix(&color[1..3], 16).unwrap_or(0);
        let g = u8::from_str_radix(&color[3..5], 16).unwrap_or(0);
        let b = u8::from_str_radix(&color[5..7], 16).unwrap_or(0);
        (r, g, b)
    } else if color.starts_with("rgb(") {
        let inner = color.trim_start_matches("rgb(").trim_end_matches(')');
        let parts: Vec<&str> = inner.split(',').collect();
        if parts.len() == 3 {
            let r = parts[0].trim().parse().unwrap_or(0);
            let g = parts[1].trim().parse().unwrap_or(0);
            let b = parts[2].trim().parse().unwrap_or(0);
            (r, g, b)
        } else {
            (0, 0, 0)
        }
    } else {
        (0, 0, 0)
    }
}
