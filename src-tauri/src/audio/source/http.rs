use reqwest::blocking::Client;
use reqwest::header::{ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_TYPE, RANGE};
use std::io::{self, Read, Seek, SeekFrom};

use super::{MediaSource, SourceMetadata, SourceType};

pub struct HttpSource {
    url: String,
    total_size: Option<u64>,
    position: u64,
    reader: Option<Box<dyn Read + Send + Sync>>,
    client: Client,
    content_type: Option<String>,
}

impl HttpSource {
    pub fn new(url: &str) -> io::Result<Self> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        let resp = client
            .head(url)
            .send()
            .map_err(|e| io::Error::new(io::ErrorKind::ConnectionRefused, e))?;

        if !resp.status().is_success() {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                format!("HTTP error: {}", resp.status()),
            ));
        }

        let total_size = resp
            .headers()
            .get(CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok());

        let content_type = resp
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let accept_ranges = resp
            .headers()
            .get(ACCEPT_RANGES)
            .and_then(|v| v.to_str().ok())
            .map(|v| v == "bytes")
            .unwrap_or(false);

        Ok(Self {
            url: url.to_string(),
            total_size,
            position: 0,
            reader: None,
            client,
            content_type,
        })
    }

    fn backoff(attempt: u32) {
        let delay = std::time::Duration::from_millis(100 * (2_u64.pow(attempt - 1)));
        std::thread::sleep(delay);
    }

    fn ensure_reader(&mut self) -> io::Result<()> {
        if self.reader.is_some() {
            return Ok(());
        }

        let mut req = self.client.get(&self.url);

        if self.position > 0 {
            req = req.header(RANGE, format!("bytes={}-", self.position));
        }

        let resp = req
            .send()
            .map_err(|e| io::Error::new(io::ErrorKind::ConnectionRefused, e))?;

        if !resp.status().is_success() {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                format!("HTTP stream error: {}", resp.status()),
            ));
        }

        self.reader = Some(Box::new(resp));
        Ok(())
    }
}

impl Read for HttpSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let max_retries = 5;
        let mut attempts = 0;

        loop {
            match self.ensure_reader() {
                Ok(_) => {}
                Err(e) => {
                    attempts += 1;
                    if attempts > max_retries {
                        return Err(e);
                    }
                    log::warn!(
                        "Connection failed (attempt {}/{}): {}. Retrying...",
                        attempts,
                        max_retries,
                        e
                    );
                    HttpSource::backoff(attempts);
                    continue;
                }
            }

            let reader = self.reader.as_mut().unwrap();
            match reader.read(buf) {
                Ok(n) => {
                    self.position += n as u64;
                    return Ok(n);
                }
                Err(e) => {
                    attempts += 1;
                    if attempts > max_retries {
                        return Err(e);
                    }
                    log::warn!(
                        "Read error (attempt {}/{}): {}. Reconnecting...",
                        attempts,
                        max_retries,
                        e
                    );
                    self.reader = None;
                    HttpSource::backoff(attempts);
                }
            }
        }
    }
}

impl Seek for HttpSource {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(p) => p,
            SeekFrom::End(p) => {
                if let Some(len) = self.total_size {
                    (len as i64 + p) as u64
                } else {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidInput,
                        "Cannot seek from end: unknown size",
                    ));
                }
            }
            SeekFrom::Current(p) => (self.position as i64 + p) as u64,
        };

        if new_pos != self.position {
            self.position = new_pos;
            self.reader = None;
        }

        Ok(self.position)
    }
}

impl MediaSource for HttpSource {
    fn is_seekable(&self) -> bool {
        true
    }

    fn byte_len(&self) -> Option<u64> {
        self.total_size
    }
}
