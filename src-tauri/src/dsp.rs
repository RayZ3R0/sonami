pub trait DspProcessor: Send + Sync {
    fn process(&mut self, samples: &mut [f32], channels: usize, sample_rate: u32);
    fn reset(&mut self) {}
}

/// Audio DSP chain with built-in processors
/// Industry-grade architecture: processors are always present but can be enabled/disabled
pub struct DspChain {
    loudness_normalizer: LoudnessNormalizer,
    custom_processors: Vec<Box<dyn DspProcessor>>,
}

impl Default for DspChain {
    fn default() -> Self {
        Self::new()
    }
}

impl DspChain {
    pub fn new() -> Self {
        Self {
            loudness_normalizer: LoudnessNormalizer::new(),
            custom_processors: Vec::new(),
        }
    }

    /// Add a custom processor to the chain
    pub fn add(&mut self, processor: Box<dyn DspProcessor>) {
        self.custom_processors.push(processor);
    }

    /// Enable or disable loudness normalization
    pub fn set_loudness_normalization(&mut self, enabled: bool) {
        self.loudness_normalizer.set_enabled(enabled);
    }

    /// Check if loudness normalization is enabled
    pub fn is_loudness_normalization_enabled(&self) -> bool {
        self.loudness_normalizer.is_enabled()
    }

    /// Process samples through the entire DSP chain
    pub fn process(&mut self, samples: &mut [f32], channels: usize, sample_rate: u32) {
        // Built-in processors first
        self.loudness_normalizer
            .process(samples, channels, sample_rate);

        // Then custom processors
        for processor in &mut self.custom_processors {
            processor.process(samples, channels, sample_rate);
        }
    }

    /// Reset all processors (call on track change)
    pub fn reset(&mut self) {
        self.loudness_normalizer.reset();
        for processor in &mut self.custom_processors {
            processor.reset();
        }
    }
}

/// Loudness normalization processor using RMS-based dynamic gain
/// Targets -14 LUFS (Spotify/YouTube standard) for consistent playback volume
pub struct LoudnessNormalizer {
    enabled: bool,
    target_db: f32,
    current_gain: f32,
    rms_sum: f64,
    rms_count: u64,
    attack_coeff: f32,
    release_coeff: f32,
}

impl Default for LoudnessNormalizer {
    fn default() -> Self {
        Self::new()
    }
}

impl LoudnessNormalizer {
    pub fn new() -> Self {
        Self {
            enabled: false, // Disabled by default - user must opt-in
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
        if !enabled {
            // Reset gain when disabled for clean transition
            self.current_gain = 1.0;
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
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

        let mut block_sum: f64 = 0.0;
        for &s in samples.iter() {
            block_sum += (s as f64) * (s as f64);
        }

        self.rms_sum += block_sum;
        self.rms_count += samples.len() as u64;

        if self.rms_count > 0 {
            let rms = (self.rms_sum / self.rms_count as f64).sqrt() as f32;
            let current_db = Self::linear_to_db(rms);

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
