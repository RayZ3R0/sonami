pub trait DspProcessor: Send + Sync {
    fn process(&mut self, samples: &mut [f32], channels: usize, sample_rate: u32);
    fn reset(&mut self) {}
}

pub struct DspChain {
    processors: Vec<Box<dyn DspProcessor>>,
}

impl DspChain {
    pub fn new() -> Self {
        Self {
            processors: Vec::new(),
        }
    }

    pub fn add(&mut self, processor: Box<dyn DspProcessor>) {
        self.processors.push(processor);
    }

    pub fn process(&mut self, samples: &mut [f32], channels: usize, sample_rate: u32) {
        for processor in &mut self.processors {
            processor.process(samples, channels, sample_rate);
        }
    }

    pub fn reset(&mut self) {
        for processor in &mut self.processors {
            processor.reset();
        }
    }
}

/// Loudness Normalizer using running RMS with attack/release
/// Target: -14 LUFS (Spotify standard), approximated via RMS
pub struct LoudnessNormalizer {
    enabled: bool,
    target_db: f32,
    current_gain: f32,
    rms_sum: f64,
    rms_count: u64,
    attack_coeff: f32,
    release_coeff: f32,
}

impl LoudnessNormalizer {
    pub fn new() -> Self {
        Self {
            enabled: true,
            target_db: -14.0,
            current_gain: 1.0,
            rms_sum: 0.0,
            rms_count: 0,
            attack_coeff: 0.01,
            release_coeff: 0.0005,
        }
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    fn db_to_linear(db: f32) -> f32 {
        10.0_f32.powf(db / 20.0)
    }

    fn linear_to_db(linear: f32) -> f32 {
        if linear > 0.0 {
            20.0 * linear.log10()
        } else {
            -100.0
        }
    }
}

impl DspProcessor for LoudnessNormalizer {
    fn process(&mut self, samples: &mut [f32], _channels: usize, _sample_rate: u32) {
        if !self.enabled || samples.is_empty() {
            return;
        }

        // Calculate RMS of this block
        let mut block_sum: f64 = 0.0;
        for &s in samples.iter() {
            block_sum += (s as f64) * (s as f64);
        }

        self.rms_sum += block_sum;
        self.rms_count += samples.len() as u64;

        // Calculate running RMS
        if self.rms_count > 0 {
            let rms = (self.rms_sum / self.rms_count as f64).sqrt() as f32;
            let current_db = Self::linear_to_db(rms);

            // Calculate target gain
            let target_gain = if current_db > -60.0 {
                Self::db_to_linear(self.target_db - current_db)
            } else {
                1.0
            };

            let coeff = if target_gain < self.current_gain {
                self.attack_coeff
            } else {
                self.release_coeff
            };

            self.current_gain += coeff * (target_gain - self.current_gain);

            self.current_gain = self.current_gain.clamp(0.1, 4.0);
        }

        for sample in samples.iter_mut() {
            *sample *= self.current_gain;
        }
    }

    fn reset(&mut self) {
        self.rms_sum = 0.0;
        self.rms_count = 0;
        self.current_gain = 1.0;
    }
}

/// Simple static gain processor (kept for manual volume boosts)
pub struct VolumeNormalizer {
    pub target_gain: f32,
}

impl VolumeNormalizer {
    pub fn new(target_gain: f32) -> Self {
        Self { target_gain }
    }
}

impl DspProcessor for VolumeNormalizer {
    fn process(&mut self, samples: &mut [f32], _channels: usize, _sample_rate: u32) {
        if (self.target_gain - 1.0).abs() < 0.001 {
            return;
        }
        for sample in samples.iter_mut() {
            *sample *= self.target_gain;
        }
    }
}
