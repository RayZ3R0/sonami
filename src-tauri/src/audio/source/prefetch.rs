use std::io::{self, Read, Seek, SeekFrom};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::collections::VecDeque;
use std::thread;
use parking_lot::{Mutex, Condvar};
use crossbeam_channel::{unbounded, Sender};
use super::MediaSource;

const BUFFER_SIZE: usize = 5 * 1024 * 1024; // 5MB buffer
const READ_CHUNK_SIZE: usize = 64 * 1024;   // 64KB read operations

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
        
        // Spawn writer thread
        let state_clone = state.clone();
        thread::spawn(move || {
            let mut buf = vec![0u8; READ_CHUNK_SIZE];
            
            loop {
                // 1. Check for commands (non-blocking)
                match rx.try_recv() {
                    Ok(Command::Seek(pos)) => {
                        // Reset EOF and Error
                        state_clone.eof.store(false, Ordering::SeqCst);
                        *state_clone.error.lock() = None;
                        
                        // Clear buffer
                        let mut guard = state_clone.buffer.lock();
                        guard.clear();
                        drop(guard);
                        
                        // Perform seek on inner
                        if let Err(e) = inner.seek(SeekFrom::Start(pos)) {
                            *state_clone.error.lock() = Some(e);
                            state_clone.condvar.notify_all();
                        }
                    },
                    Err(crossbeam_channel::TryRecvError::Disconnected) => break, // Owner dropped
                    Err(crossbeam_channel::TryRecvError::Empty) => {},
                }

                // 2. Check if buffer is full
                let len = state_clone.buffer.lock().len();
                if len >= BUFFER_SIZE {
                    thread::sleep(std::time::Duration::from_millis(10));
                    continue;
                }

                // 3. Read data
                match inner.read(&mut buf) {
                    Ok(0) => {
                        // EOF
                        state_clone.eof.store(true, Ordering::SeqCst);
                        state_clone.condvar.notify_all();
                        thread::sleep(std::time::Duration::from_millis(100)); // Sleep while waiting for commands
                    }
                    Ok(n) => {
                        let mut guard = state_clone.buffer.lock();
                        guard.extend(buf[..n].iter());
                        state_clone.condvar.notify_all();
                    }
                    Err(e) => {
                        // Don't exit thread merely on error, wait for seek/recovery
                        // But store error so reader sees it
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
            // Check for error
            if let Some(err) = self.state.error.lock().take() {
                return Err(err);
            }

            // Check for data
            if !guard.is_empty() {
                let amt = std::cmp::min(buf.len(), guard.len());
                // Efficiently copy from VecDeque
                // Standard VecDeque doesn't support direct slice read easily across wrap
                // So we loop or use slices
                let (slice1, slice2) = guard.as_slices();
                let len1 = slice1.len();
                
                if len1 >= amt {
                    buf[..amt].copy_from_slice(&slice1[..amt]);
                } else {
                    buf[..len1].copy_from_slice(slice1);
                    buf[len1..amt].copy_from_slice(&slice2[..amt - len1]);
                }
                
                guard.drain(..amt); // Remove read bytes
                self.position += amt as u64;
                self.state.condvar.notify_one(); // Notify writer space opened (though we poll len)
                return Ok(amt);
            }

            // Check EOF
            if self.state.eof.load(Ordering::SeqCst) {
                return Ok(0);
            }

            // Wait for data
            self.state.condvar.wait(&mut guard);
        }
    }
}

impl Seek for PrefetchSource {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(p) => p,
            SeekFrom::End(_) => return Err(io::Error::new(io::ErrorKind::InvalidInput, "Seek from End not supported")),
            SeekFrom::Current(p) => (self.position as i64 + p) as u64,
        };

        // Smart Seek Optimization:
        // If we are seeking forward and the target is within our current buffer,
        // we can just drain the buffer and avoid a network reconnection.
        if new_pos >= self.position {
            let skip_amount = new_pos - self.position;
            // Check if usize is sufficient (it should be for buffer size)
            if let Ok(skip_usize) = usize::try_from(skip_amount) {
                let mut guard = self.state.buffer.lock();
                if skip_usize < guard.len() {
                    // We have the data!
                    guard.drain(..skip_usize);
                    self.position = new_pos;
                    self.state.condvar.notify_all(); // Notify writer space available
                    return Ok(new_pos);
                }
            }
        }

        // Send command to thread
        self.tx_cmd.send(Command::Seek(new_pos))
            .map_err(|_| io::Error::new(io::ErrorKind::BrokenPipe, "Prefetch thread died"))?;
        
        // We must assume seek succeeds immediately for the wrapper, 
        // OR wait for confirmation?
        // Since `seek` returns the new position, we can update local position.
        // The next `read` will block until thread clears buffer and fetches new data (since buffer empty).
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
