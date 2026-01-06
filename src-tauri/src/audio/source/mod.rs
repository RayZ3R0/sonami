pub mod file;
pub mod http;
pub mod prefetch;

use std::io::{self, Read, Seek, SeekFrom};

pub use symphonia::core::io::MediaSource;

#[derive(Clone, Debug, PartialEq)]
pub enum SourceType {
    LocalFile,
    HttpStream,
}

#[derive(Clone, Debug)]
pub struct SourceMetadata {
    pub source_type: SourceType,
    pub uri: String,
    pub content_type: Option<String>,
    pub size: Option<u64>,
}
