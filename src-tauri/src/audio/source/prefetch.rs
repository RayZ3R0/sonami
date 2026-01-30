use super::MediaSource;
use crossbeam_channel::{unbounded, Sender};
use parking_lot::{Condvar, Mutex};
use std::collections::VecDeque;
use std::io::{self, Read, Seek, SeekFrom};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

const BUFFER_SIZE: usize = 5 * 1024 * 1024;
const READ_CHUNK_SIZE: usize = 64 * 1024;

enum Command {
    Seek(u64),
}

struct SharedState {
    buffer: Mutex<VecDeque<u8>>,
    condvar: Condvar,
    eof: AtomicBool,
    error: Mutex<Option<io::Error>>,
}

pub struct PrefetchSource {
    state: Arc<SharedState>,
    tx_cmd: Sender<Command>,
    position: u64,
    total_size: Option<u64>,
    seekable: bool,
}

impl PrefetchSource {
    pub fn new(mut inner: Box<dyn MediaSource>) -> Self {
        let total_size = inner.byte_len();
        let seekable = inner.is_seekable();

        let state = Arc::new(SharedState {
            buffer: Mutex::new(VecDeque::with_capacity(BUFFER_SIZE)),
            condvar: Condvar::new(),
            eof: AtomicBool::new(false),
            error: Mutex::new(None),
        });

        let (tx, rx) = unbounded();

        let state_clone = state.clone();
        thread::spawn(move || {
            let mut buf = vec![0u8; READ_CHUNK_SIZE];

            loop {
                match rx.try_recv() {
                    Ok(Command::Seek(pos)) => {
                        state_clone.eof.store(false, Ordering::SeqCst);
                        *state_clone.error.lock() = None;

                        let mut guard = state_clone.buffer.lock();
                        guard.clear();
                        drop(guard);

                        if let Err(e) = inner.seek(SeekFrom::Start(pos)) {
                            *state_clone.error.lock() = Some(e);
                            state_clone.condvar.notify_all();
                        }
                    }
                    Err(crossbeam_channel::TryRecvError::Disconnected) => break,
                    Err(crossbeam_channel::TryRecvError::Empty) => {}
                }

                let len = state_clone.buffer.lock().len();
                if len >= BUFFER_SIZE {
                    thread::sleep(std::time::Duration::from_millis(10));
                    continue;
                }

                match inner.read(&mut buf) {
                    Ok(0) => {
                        if !state_clone.eof.load(Ordering::SeqCst) {
                            log::info!("[PrefetchSource] Inner source EOF. Buffer size: {}", state_clone.buffer.lock().len());
                        }
                        state_clone.eof.store(true, Ordering::SeqCst);
                        state_clone.condvar.notify_all();
                        thread::sleep(std::time::Duration::from_millis(100));
                    }
                    Ok(n) => {
                        let mut guard = state_clone.buffer.lock();
                        guard.extend(buf[..n].iter());
                        state_clone.condvar.notify_all();
                    }
                    Err(e) => {
                        let mut err_guard = state_clone.error.lock();
                        if err_guard.is_none() {
                            *err_guard = Some(e);
                            state_clone.condvar.notify_all();
                        }
                        thread::sleep(std::time::Duration::from_millis(100));
                    }
                }
            }
        });

        Self {
            state,
            tx_cmd: tx,
            position: 0,
            total_size,
            seekable,
        }
    }
}

impl Read for PrefetchSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let mut guard = self.state.buffer.lock();

        loop {
            if let Some(err) = self.state.error.lock().take() {
                return Err(err);
            }

            if !guard.is_empty() {
                let amt = std::cmp::min(buf.len(), guard.len());

                let (slice1, slice2) = guard.as_slices();
                let len1 = slice1.len();

                if len1 >= amt {
                    buf[..amt].copy_from_slice(&slice1[..amt]);
                } else {
                    buf[..len1].copy_from_slice(slice1);
                    buf[len1..amt].copy_from_slice(&slice2[..amt - len1]);
                }

                guard.drain(..amt);
                self.position += amt as u64;
                self.state.condvar.notify_one();
                return Ok(amt);
            }

            if self.state.eof.load(Ordering::SeqCst) {
                return Ok(0);
            }

            self.state.condvar.wait(&mut guard);
        }
    }
}

impl Seek for PrefetchSource {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(p) => p,
            SeekFrom::End(_) => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "Seek from End not supported",
                ))
            }
            SeekFrom::Current(p) => (self.position as i64 + p) as u64,
        };
        
        if new_pos >= self.position {
            let skip_amount = new_pos - self.position;

            if let Ok(skip_usize) = usize::try_from(skip_amount) {
                let mut guard = self.state.buffer.lock();
                if skip_usize < guard.len() {
                    guard.drain(..skip_usize);
                    self.position = new_pos;
                    self.state.condvar.notify_all();
                    return Ok(new_pos);
                }
            }
        }

        // Fix for premature EOS: Symphonia attempts to seek to the end of the file (metadata/footer)
        // which dumps our valid audio buffer. If we block seeks near the end, it forces linear read.
        if let Some(total) = self.total_size {
            // Block seeks within the last 512KB (approx 5s of FLAC)
            if new_pos > total.saturating_sub(512 * 1024) {
                 // Return current position effectively ignoring the seek
                 return Ok(self.position);
            }
        }

        self.tx_cmd
            .send(Command::Seek(new_pos))
            .map_err(|_| io::Error::new(io::ErrorKind::BrokenPipe, "Prefetch thread died"))?;

        self.position = new_pos;
        Ok(new_pos)
    }
}

impl MediaSource for PrefetchSource {
    fn is_seekable(&self) -> bool {
        self.seekable
    }

    fn byte_len(&self) -> Option<u64> {
        self.total_size
    }
}
