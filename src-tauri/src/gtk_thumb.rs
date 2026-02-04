use ffmpeg_next::{
    format::{input, Pixel},
    media::Type,
    software::scaling::{context::Context, flag::Flags},
    util::frame::video::Video,
};
use gio::{traits::FileExt, Cancellable, File, FileQueryInfoFlags};
use md5::{Digest, Md5};
use rs_vips::{
    bindings::{vips_image_map, GValue},
    Vips, VipsImage,
};
use std::{
    collections::HashMap,
    ffi::{c_char, c_void, CStr, CString},
    fs::{create_dir, set_permissions, Permissions},
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};
use url::Url;

enum SourceType {
    Picture,
    Video,
}

const THUMB_URI: &str = "png-comment-0-Thumb::URI";
const THUMB_MTIME: &str = "png-comment-1-Thumb::MTime";
const THUMB_SOFTWARE: &str = "png-comment-2-Software";
const NORMAL: i32 = 128;
const LARGE: i32 = 256;
const DIRECTORY_PERM: u32 = 0o700;
const FILE_PERM: u32 = 0o600;

// Creates thumbnails(128 and 256)
pub fn video_thumbnail<P: AsRef<Path>>(file: P, software: Option<&str>) -> Result<(Vec<u8>, Vec<u8>), String> {
    make_thumbnail(file, SourceType::Video, software)
}

// Creates thumbnails(128 and 256)
pub fn image_thumbnail<P: AsRef<Path>>(file: P, software: Option<&str>) -> Result<(Vec<u8>, Vec<u8>), String> {
    make_thumbnail(file, SourceType::Picture, software)
}

fn make_thumbnail<P: AsRef<Path>>(file: P, source_type: SourceType, software: Option<&str>) -> Result<(Vec<u8>, Vec<u8>), String> {
    let _ = Vips::init("mkthumb");

    let url = Url::from_file_path(file.as_ref()).unwrap();
    let info = File::for_path(file.as_ref()).query_info("access::can-read,time::*", FileQueryInfoFlags::NOFOLLOW_SYMLINKS, Cancellable::NONE).map_err(|e| e.message().to_string())?;
    // the original image file is readable. If it is not, the program should not attempt to read a thumbnail from the cache, and it should not save any information in the cache
    if !info.boolean("access::can-read") {
        return Err("Cannot access file".to_string());
    }
    let mtime = info.attribute_uint64("time::modified").to_string();

    let mut hasher = Md5::new();
    hasher.update(url.as_str().as_bytes());

    let result = hasher.finalize();

    let fname = format!("{:x}.png", result);

    let cache_directory_candidate = if let Ok(cache_home) = std::env::var("XDG_CACHE_HOME") {
        Some(PathBuf::from(format!("{cache_home}/thumbnails")))
    } else if let Ok(home) = std::env::var("HOME") {
        Some(PathBuf::from(format!("{home}/.cache/thumbnails")))
    } else {
        None
    };

    let cache_directory = if let Some(cache_directory) = cache_directory_candidate {
        cache_directory
    } else {
        return Err("Thumbnail cache directory not found".to_string());
    };

    if !cache_directory.exists() {
        create_dir(&cache_directory).map_err(|e| e.to_string())?;
        let permissions = Permissions::from_mode(DIRECTORY_PERM);
        set_permissions(&cache_directory, permissions).map_err(|e| e.to_string())?;
    }

    let (normal, large) = (cache_directory.join("normal").join(&fname), cache_directory.join("large").join(&fname));

    if !normal.exists() {
        create_dir(&normal).map_err(|e| e.to_string())?;
        let permissions = Permissions::from_mode(DIRECTORY_PERM);
        set_permissions(&normal, permissions).map_err(|e| e.to_string())?;
    }

    if !large.exists() {
        create_dir(&large).map_err(|e| e.to_string())?;
        let permissions = Permissions::from_mode(DIRECTORY_PERM);
        set_permissions(&large, permissions).map_err(|e| e.to_string())?;
    }

    let should_create_large = if large.exists() {
        must_recreate(&large, &mtime).unwrap_or_default()
    } else {
        true
    };

    let size256 = if should_create_large {
        match source_type {
            SourceType::Picture => large_from_image(&url, file.as_ref().to_path_buf(), &mtime, software)?,
            SourceType::Video => large_from_video(&url, file.as_ref().to_path_buf(), &mtime, software)?,
        }
    } else {
        Vec::new()
    };

    if !size256.is_empty() {
        std::fs::write(&large, &size256).map_err(|e| e.to_string())?;
        let permissions = Permissions::from_mode(FILE_PERM);
        set_permissions(&large, permissions).map_err(|e| e.to_string())?;
    }

    let should_create_normal = if normal.exists() {
        must_recreate(&normal, &mtime).unwrap_or_default()
    } else {
        true
    };

    let size128 = if should_create_normal {
        match source_type {
            SourceType::Picture => normal_from_image(&url, &size256, file.as_ref().to_path_buf(), &mtime, software)?,
            SourceType::Video => normal_from_video(&url, &size256, file.as_ref().to_path_buf(), &mtime, software)?,
        }
    } else {
        Vec::new()
    };

    if !size128.is_empty() {
        std::fs::write(&normal, &size128).map_err(|e| e.to_string())?;
        let permissions = Permissions::from_mode(FILE_PERM);
        set_permissions(&normal, permissions).map_err(|e| e.to_string())?;
    }

    Ok((size128, size256))
}

fn must_recreate(large: &PathBuf, current_mtime: &String) -> Result<bool, String> {
    let image = VipsImage::new_from_file(large).map_err(map_vips_error)?;
    let mut comments = Box::new(HashMap::<String, String>::new());
    let comments_ptr: *mut c_void = &mut *comments as *mut _ as *mut c_void;
    unsafe { vips_image_map(image.as_mut_ptr(), Some(read_pngcomment), comments_ptr) };

    if let Some(uri) = comments.get("Thumb::URI") {
        if uri != &uri.to_string() {
            return Ok(false);
        }
    }

    if let Some(mtime) = comments.get("Thumb::MTime") {
        if mtime == current_mtime {
            return Ok(false);
        }
    }

    Ok(true)
}

unsafe extern "C" fn read_pngcomment(image: *mut rs_vips::bindings::_VipsImage, field: *const c_char, _value: *mut GValue, data: *mut c_void) -> *mut c_void {
    let comments: &mut HashMap<String, String> = unsafe { &mut *(data as *mut HashMap<String, String>) };

    let png_comment_start = CString::new("png-comment-").unwrap();
    let png_comment_start_len = "png-comment-".len();

    if rs_vips::bindings::vips_isprefix(png_comment_start.as_ptr(), field) == 1 {
        let field_str = CStr::from_ptr(field).to_str().unwrap();
        let rest = &field_str[png_comment_start_len..];
        let keyword = rest.find('-').map(|idx| &rest[idx..]);
        let mut str: *const c_char = std::ptr::null();
        if let Some(keyword) = keyword {
            if rs_vips::bindings::vips_image_get_string(image, field, &mut str) == 0 {
                // Skip the hyphen
                let keyword = &keyword[1..];
                let value = CStr::from_ptr(str).to_string_lossy().into_owned();
                comments.insert(keyword.to_string(), value);
            }
        }
    }

    std::ptr::null_mut()
}

fn large_from_image(url: &Url, source: PathBuf, mtime: &str, software: Option<&str>) -> Result<Vec<u8>, String> {
    let image = VipsImage::new_from_file(source).map_err(map_vips_error)?.thumbnail_image(LARGE).map_err(map_vips_error)?;
    set_image_data(&image, url, mtime, software)?;
    image.pngsave_buffer().map_err(map_vips_error)
}

fn normal_from_image(url: &Url, large: &[u8], source: PathBuf, mtime: &str, software: Option<&str>) -> Result<Vec<u8>, String> {
    let image = if large.is_empty() {
        VipsImage::new_from_file(source).map_err(map_vips_error)?.thumbnail_image(NORMAL).map_err(map_vips_error)?
    } else {
        VipsImage::new_from_buffer(large, "").map_err(map_vips_error)?.resize(0.5).map_err(map_vips_error)?
    };
    set_image_data(&image, url, mtime, software)?;
    image.pngsave_buffer().map_err(map_vips_error)
}

fn large_from_video(url: &Url, source: PathBuf, mtime: &str, software: Option<&str>) -> Result<Vec<u8>, String> {
    let buffer = create_video_thumbnail(source).map_err(|e| e.to_string())?;
    let image = VipsImage::new_from_buffer(&buffer, "").map_err(map_vips_error)?.thumbnail_image(LARGE).map_err(map_vips_error)?;
    set_image_data(&image, url, mtime, software)?;
    image.pngsave_buffer().map_err(map_vips_error)
}

fn normal_from_video(url: &Url, large: &[u8], source: PathBuf, mtime: &str, software: Option<&str>) -> Result<Vec<u8>, String> {
    let image = if large.is_empty() {
        let buffer = create_video_thumbnail(source).map_err(|e| e.to_string())?;
        VipsImage::new_from_buffer(&buffer, "").map_err(map_vips_error)?.thumbnail_image(NORMAL).map_err(map_vips_error)?
    } else {
        VipsImage::new_from_buffer(large, "").map_err(map_vips_error)?.resize(0.5).map_err(map_vips_error)?
    };
    set_image_data(&image, url, mtime, software)?;
    image.pngsave_buffer().map_err(map_vips_error)
}

fn set_image_data(image: &VipsImage, url: &Url, mtime: &str, software: Option<&str>) -> Result<(), String> {
    image.set_string(THUMB_URI, url.as_ref()).map_err(map_vips_error)?;
    image.set_string(THUMB_MTIME, mtime).map_err(map_vips_error)?;
    if let Some(software) = software {
        image.set_string(THUMB_SOFTWARE, software).map_err(map_vips_error)?;
    }
    Ok(())
}

fn create_video_thumbnail<P: AsRef<Path>>(path: P) -> Result<Vec<u8>, String> {
    ffmpeg_next::init().map_err(map_ffmpeg_error)?;

    let mut result = Vec::new();

    if let Ok(mut ictx) = input(path.as_ref()) {
        let input = ictx.streams().best(Type::Video).ok_or(ffmpeg_next::Error::StreamNotFound).map_err(map_ffmpeg_error)?;
        let stream_index = input.index();
        let context_decoder = ffmpeg_next::codec::context::Context::from_parameters(input.parameters()).map_err(map_ffmpeg_error)?;
        let mut decoder = context_decoder.decoder().video().map_err(map_ffmpeg_error)?;
        let mut rotation: i32 = 0;
        for data in input.side_data() {
            if data.kind() == ffmpeg_next::packet::side_data::Type::DisplayMatrix {
                rotation = parse_display_matrix(data.data());
            } else {
                rotation = input.metadata().get("rotate").unwrap_or("0").parse().unwrap();
            }
        }

        let (width, height) = (decoder.width(), decoder.height());

        let mut scaler = Context::get(decoder.format(), decoder.width(), decoder.height(), Pixel::RGB24, width, height, Flags::BILINEAR).map_err(map_ffmpeg_error)?;

        for (stream, packet) in ictx.packets() {
            if stream.index() == stream_index {
                decoder.send_packet(&packet).map_err(map_ffmpeg_error)?;

                let mut frame = Video::empty();
                match decoder.receive_frame(&mut frame) {
                    Ok(_) => {}
                    Err(e) => match e {
                        ffmpeg_next::Error::Other {
                            errno,
                        } => {
                            if errno == 11 {
                                continue;
                            } else {
                                return Err(map_ffmpeg_error(e));
                            }
                        }
                        _ => return Err(map_ffmpeg_error(e)),
                    },
                }

                let mut rgb_frame = Video::empty();
                scaler.run(&frame, &mut rgb_frame).map_err(map_ffmpeg_error)?;

                result = into_buffer(&rgb_frame, rotation)?;

                break;
            }
        }
    }

    Ok(result)
}

fn into_buffer(rgb_frame: &Video, rotation: i32) -> Result<Vec<u8>, String> {
    let mut pixel = Vec::new();
    for y in 0..rgb_frame.height() {
        for x in 0..rgb_frame.width() {
            let data = rgb_frame.data(0);
            let stride = rgb_frame.stride(0);
            let offset = y as usize * stride + x as usize * 3;
            pixel.push(data[offset]);
            pixel.push(data[offset + 1]);
            pixel.push(data[offset + 2]);
        }
    }
    VipsImage::new_from_memory(&pixel, rgb_frame.width() as _, rgb_frame.height() as _, 3, rs_vips::ops::BandFormat::Uchar)
        .map_err(map_vips_error)?
        .rotate(rotation as _)
        .map_err(map_vips_error)?
        .pngsave_buffer()
        .map_err(map_vips_error)
}

fn parse_display_matrix(data: &[u8]) -> i32 {
    let matrix: [i32; 9] = unsafe { std::ptr::read(data.as_ptr() as *const [i32; 9]) };
    // let matrix_f: Vec<f64> = matrix.iter().map(|&v| v as f64 / 65536.0).collect();

    // Detect rotation
    match (matrix[0], matrix[1], matrix[3], matrix[4]) {
        (0, 65536, -65536, 0) => 90,
        (0, -65536, 65536, 0) => 270,
        (-65536, 0, 0, -65536) => 180,
        (65536, 0, 0, 65536) => 0,
        _ => -1,
    }
}

fn map_vips_error(e: rs_vips::error::Error) -> String {
    e.to_string()
}

fn map_ffmpeg_error(e: ffmpeg_next::Error) -> String {
    e.to_string()
}
