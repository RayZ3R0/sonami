use reqwest::blocking::Client;
use reqwest::header::{ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_TYPE, RANGE};
use std::io::{self, Read, Seek, SeekFrom};

use super::MediaSource;

pub struct HttpSource {
    url: String,
    total_size: Option<u64>,
    position: u64,
    reader: Option<Box<dyn Read + Send + Sync>>,
    client: Client,
    _content_type: Option<String>,
    supports_ranges: bool,
    range_failed: bool,
}

impl HttpSource {
    pub fn new(url: &str) -> io::Result<Self> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(io::Error::other)?;

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

        let _content_type = resp
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let supports_ranges = resp
            .headers()
            .get(ACCEPT_RANGES)
            .and_then(|v| v.to_str().ok())
            .map(|v| v == "bytes")
            .unwrap_or(false);

        log::debug!(
            "[HttpSource] URL: {}... Content-Length: {:?}, Accept-Ranges: {}",
            if url.len() > 60 { &url[..60] } else { url },
            total_size,
            supports_ranges
        );

        Ok(Self {
            url: url.to_string(),
            total_size,
            position: 0,
            reader: None,
            client,
            _content_type,
            supports_ranges,
            range_failed: false,
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

        let use_range = self.position > 0 && self.supports_ranges && !self.range_failed;

        if use_range {
            req = req.header(RANGE, format!("bytes={}-", self.position));
        }

        let resp = req
            .send()
            .map_err(|e| io::Error::new(io::ErrorKind::ConnectionRefused, e))?;

        let status = resp.status();

        if status.as_u16() == 416 {
            log::warn!(
                "[HttpSource] Range request failed (416). Marking as non-seekable and restarting from beginning."
            );
            self.range_failed = true;
            self.position = 0;

            let resp = self
                .client
                .get(&self.url)
                .send()
                .map_err(|e| io::Error::new(io::ErrorKind::ConnectionRefused, e))?;

            if !resp.status().is_success() {
                return Err(io::Error::other(format!(
                    "HTTP stream error: {}",
                    resp.status()
                )));
            }

            self.reader = Some(Box::new(resp));
            return Ok(());
        }

        if !status.is_success() {
            return Err(io::Error::other(format!("HTTP stream error: {}", status)));
        }

        self.reader = Some(Box::new(resp));
        Ok(())
    }
}

impl Read for HttpSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let max_retries = 3;
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
                    if n == 0 {
                        // Check for premature EOF
                        if let Some(total) = self.total_size {
                            if self.position < total {
                                attempts += 1;
                                if attempts > max_retries {
                                    return Err(io::Error::new(io::ErrorKind::UnexpectedEof, format!("Premature EOF at {}/{}", self.position, total)));
                                }
                                log::warn!("[HttpSource] Premature EOF at {}/{} (attempt {}/{}). Reconnecting...", self.position, total, attempts, max_retries);
                                self.reader = None;
                                HttpSource::backoff(attempts);
                                continue;
                            } else {
                                // Clean EOF
                            }
                        }
                    }
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
        if self.range_failed {
            return match pos {
                SeekFrom::Start(0) => Ok(0),
                SeekFrom::Current(0) => Ok(self.position),
                _ => Err(io::Error::new(
                    io::ErrorKind::Unsupported,
                    "Server does not support seeking (Range requests failed)",
                )),
            };
        }

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
        self.supports_ranges && !self.range_failed
    }

    fn byte_len(&self) -> Option<u64> {
        self.total_size
    }
}
