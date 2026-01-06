use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use super::{MediaSource, SourceMetadata, SourceType};

pub struct FileSource {
    file: File,
    path: PathBuf,
    size: u64,
    position: u64,
}

impl FileSource {
    pub fn new(path: impl AsRef<Path>) -> io::Result<Self> {
        let path = path.as_ref();
        let file = File::open(path)?;
        let size = file.metadata()?.len();

        Ok(Self {
            file,
            path: path.to_owned(),
            size,
            position: 0,
        })
    }
}

impl Read for FileSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let n = self.file.read(buf)?;
        self.position += n as u64;
        Ok(n)
    }
}

impl Seek for FileSource {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        self.position = self.file.seek(pos)?;
        Ok(self.position)
    }
}

impl MediaSource for FileSource {
    fn is_seekable(&self) -> bool {
        true
    }

    fn byte_len(&self) -> Option<u64> {
        Some(self.size)
    }
}
