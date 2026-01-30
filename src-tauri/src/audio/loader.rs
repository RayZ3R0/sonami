use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use super::resolver::UrlResolver;
use super::source::{file::FileSource, http::HttpSource, prefetch::PrefetchSource, MediaSource};
use super::types::LoadTrackResult;

pub fn resolve_source(uri: &str, resolver: &UrlResolver) -> Result<Box<dyn MediaSource>, String> {
    let resolved = resolver.resolve(uri)?;

    if resolved.path.starts_with("http://") || resolved.path.starts_with("https://") {
        let http = HttpSource::new(&resolved.path).map_err(|e| e.to_string())?;
        Ok(Box::new(PrefetchSource::new(Box::new(http))))
    } else {
        Ok(Box::new(
            FileSource::new(&resolved.path).map_err(|e| e.to_string())?,
        ))
    }
}

pub fn load_track(source: Box<dyn MediaSource>) -> LoadTrackResult {
    let mss = MediaSourceStream::new(source, Default::default());

    let hint = Hint::new();

    let format_opts = FormatOptions {
        enable_gapless: true,
        ..Default::default()
    };
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &MetadataOptions::default())
        .map_err(|e| e.to_string())?;

    let reader = probed.format;
    let track = reader
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or("No audio track")?;
    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    // Use u64 directly from n_frames
    let duration_samples = track.codec_params.n_frames.unwrap_or(0);
    
    let decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| e.to_string())?;

    Ok((reader, decoder, track_id, duration_samples, sample_rate))
}
