use std::io::Cursor;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use ::image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
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
    let (doc, page1, layer1) = PdfDocument::new(
        "MojiQ Document",
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );

    let mut current_layer = doc.get_page(page1).get_layer(layer1);

    for (idx, page_drawing) in request.pages.iter().enumerate() {
        if idx > 0 {
            let (new_page, new_layer) = doc.add_page(
                Mm(210.0),
                Mm(297.0),
                format!("Page {}", idx + 1),
            );
            current_layer = doc.get_page(new_page).get_layer(new_layer);
        }

        // Draw strokes
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

            let page_height = page_drawing.height as f64;
            let scale_x = 210.0 / page_drawing.width as f64;
            let scale_y = 297.0 / page_drawing.height as f64;

            let points: Vec<(Point, bool)> = stroke
                .points
                .iter()
                .enumerate()
                .map(|(i, (x, y))| {
                    let pdf_x = x * scale_x;
                    let pdf_y = (page_height - y) * scale_y;
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

#[allow(dead_code)]
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
