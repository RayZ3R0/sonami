use std::cell::UnsafeCell;
use std::sync::atomic::{AtomicU32, Ordering};

pub struct AudioBuffer {
    data: UnsafeCell<Box<[f32]>>,
    read_pos: AtomicU32,
    write_pos: AtomicU32,
    capacity: u32,
    lock: std::sync::Mutex<()>,
}

unsafe impl Sync for AudioBuffer {}
unsafe impl Send for AudioBuffer {}

impl AudioBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: UnsafeCell::new(vec![0.0; capacity].into_boxed_slice()),
            read_pos: AtomicU32::new(0),
            write_pos: AtomicU32::new(0),
            capacity: capacity as u32,
            lock: std::sync::Mutex::new(()),
        }
    }

    pub fn push_samples(&self, samples: &[f32]) -> usize {
        let _guard = self.lock.lock().unwrap();
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        let available = if write_pos >= read_pos {
            self.capacity - (write_pos - read_pos) - 1
        } else {
            read_pos - write_pos - 1
        };

        let to_write = (samples.len() as u32).min(available) as usize;
        let data_slice = unsafe { &mut *self.data.get() };

        for (i, &sample) in samples.iter().enumerate().take(to_write) {
            let pos = ((write_pos as usize) + i) % (self.capacity as usize);
            data_slice[pos] = sample;
        }

        let new_write = (write_pos + to_write as u32) % self.capacity;
        self.write_pos.store(new_write, Ordering::Release);
        to_write
    }

    pub fn pop_samples(&self, out: &mut [f32]) -> usize {
        let _guard = self.lock.lock().unwrap();
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        let available = if write_pos >= read_pos {
            write_pos - read_pos
        } else {
            self.capacity - read_pos + write_pos
        };

        let to_read = (out.len() as u32).min(available) as usize;
        let data_slice = unsafe { &*self.data.get() };

        for (i, out_sample) in out.iter_mut().enumerate().take(to_read) {
            let pos = ((read_pos as usize) + i) % (self.capacity as usize);
            *out_sample = data_slice[pos];
        }

        let new_read = (read_pos + to_read as u32) % self.capacity;
        self.read_pos.store(new_read, Ordering::Release);
        to_read
    }

    pub fn available_space(&self) -> usize {
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);
        let available = if write_pos >= read_pos {
            self.capacity - (write_pos - read_pos) - 1
        } else {
            read_pos - write_pos - 1
        };
        available as usize
    }

    pub fn clear(&self) {
        let _guard = self.lock.lock().unwrap();
        self.read_pos.store(0, Ordering::Release);
        self.write_pos.store(0, Ordering::Release);
    }
}
