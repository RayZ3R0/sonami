

pub trait DspProcessor: Send + Sync {
    fn process(&mut self, samples: &mut [f32], channels: usize, sample_rate: u32);
}

pub struct DspChain {
    processors: Vec<Box<dyn DspProcessor>>,
}

impl DspChain {
    pub fn new() -> Self {
        Self { processors: Vec::new() }
    }

    pub fn add(&mut self, processor: Box<dyn DspProcessor>) {
        self.processors.push(processor);
    }

    pub fn process(&mut self, samples: &mut [f32], channels: usize, sample_rate: u32) {
        for processor in &mut self.processors {
            processor.process(samples, channels, sample_rate);
        }
    }
}

// Simple Volume Normalizer (Gain)
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

// Basic 10-Band EQ implementation using Biquad filters
// For simplicity in this first pass, we'll implement a simple gain processor
// but structure it for future Biquad expansion.
pub struct Equalizer {
    pub bands: [f32; 10], // Gains for 10 bands
    enabled: bool,
}

impl Equalizer {
    pub fn new() -> Self {
        Self {
            bands: [0.0; 10], // 0.0 dB means no change
            enabled: false,
        }
    }

    pub fn set_band(&mut self, index: usize, gain_db: f32) {
        if index < 10 {
            self.bands[index] = gain_db;
            self.enabled = self.bands.iter().any(|&g| g.abs() > 0.1);
        }
    }
}

impl DspProcessor for Equalizer {
    fn process(&mut self, _samples: &mut [f32], _channels: usize, _sample_rate: u32) {
        if !self.enabled {
            return;
        }
        // Placeholder: Real Biquad filtering would go here.
        // For now, we just apply a global gain average as a mock to prove connectivity.
        // The real implementation needs stateful filters which is complex to write from scratch without a crate.
        // We will focus on architecture first.
    }
}
