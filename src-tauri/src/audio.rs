use std::sync::{Arc, Mutex};
use std::fs::File;
use rodio::{Decoder, OutputStreamBuilder, Sink};
// rodio 0.17+ exports are typically at root. `OutputStreamHandle` should be there.
// If it's not, maybe it's just implicit in `OutputStream` usage now?
// Error said `no OutputStreamHandle in root`.
// Let's check imports.
use std::sync::mpsc::{channel, Sender};
use std::thread;

pub enum AudioCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    Seek(String, f64), // (file_path, seconds) - need path to reload for backward seek
    SetVolume(f32), // 0.0 to 1.0
}

pub struct AudioManager {
    commander: Arc<Mutex<Sender<AudioCommand>>>,
    current_path: Arc<Mutex<Option<String>>>,
}

impl AudioManager {
    pub fn new() -> Self {
        let (tx, rx) = channel();
        
        thread::spawn(move || {
            let stream = OutputStreamBuilder::open_default_stream().expect("Failed to get output stream");
            let mut sink = Sink::connect_new(stream.mixer());
            let mut volume: f32 = 1.0;

            loop {
                match rx.recv() {
                    Ok(AudioCommand::Play(path)) => {
                        println!("Backend: Playing {}", path);
                        sink.stop();
                        sink = Sink::connect_new(stream.mixer());
                        match File::open(&path) {
                            Ok(file) => {
                                match Decoder::new(file) {
                                    Ok(source) => {
                                        sink.append(source);
                                        sink.set_volume(volume);
                                        sink.play();
                                        println!("Backend: Playback started");
                                    },
                                    Err(e) => println!("Backend: Failed to decode audio: {}", e),
                                }
                            },
                            Err(e) => println!("Backend: Failed to open file: {}", e),
                        }
                    },
                    Ok(AudioCommand::Pause) => {
                        println!("Backend: Pausing");
                        sink.pause();
                    },
                    Ok(AudioCommand::Resume) => {
                        println!("Backend: Resuming");
                        sink.play();
                    },
                    Ok(AudioCommand::Stop) => sink.stop(),
                    Ok(AudioCommand::Seek(path, seconds)) => {
                        println!("Backend: Seeking to {}s in {}", seconds, path);
                        // Reload the file and seek - this works for both forward and backward seeks
                        sink.stop();
                        sink = Sink::connect_new(stream.mixer());
                        match File::open(&path) {
                            Ok(file) => {
                                match Decoder::new(file) {
                                    Ok(source) => {
                                        sink.append(source);
                                        sink.set_volume(volume);
                                        let time = std::time::Duration::from_secs_f64(seconds);
                                        if let Err(e) = sink.try_seek(time) {
                                            println!("Backend: Seek failed: {}", e);
                                        } else {
                                            println!("Backend: Seek successful to {}s", seconds);
                                        }
                                        sink.play();
                                    },
                                    Err(e) => println!("Backend: Failed to decode audio for seek: {}", e),
                                }
                            },
                            Err(e) => println!("Backend: Failed to open file for seek: {}", e),
                        }
                    },
                    Ok(AudioCommand::SetVolume(vol)) => {
                        println!("Backend: Setting volume to {}", vol);
                        volume = vol;
                        sink.set_volume(vol);
                    },
                    Err(_) => break,
                }
            }
        });

        Self {
            commander: Arc::new(Mutex::new(tx)),
            current_path: Arc::new(Mutex::new(None)),
        }
    }

    pub fn play(&self, path: String) {
        if let Ok(mut p) = self.current_path.lock() {
            *p = Some(path.clone());
        }
        let _ = self.commander.lock().unwrap().send(AudioCommand::Play(path));
    }
    
    pub fn pause(&self) {
        let _ = self.commander.lock().unwrap().send(AudioCommand::Pause);
    }

    pub fn resume(&self) {
        let _ = self.commander.lock().unwrap().send(AudioCommand::Resume);
    }
    
    pub fn seek(&self, seconds: f64) {
        if let Ok(path) = self.current_path.lock() {
            if let Some(ref p) = *path {
                let _ = self.commander.lock().unwrap().send(AudioCommand::Seek(p.clone(), seconds));
            }
        }
    }
    
    pub fn set_volume(&self, vol: f32) {
        let _ = self.commander.lock().unwrap().send(AudioCommand::SetVolume(vol));
    }
}

