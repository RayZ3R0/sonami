// Quick test to verify discord-rich-presence crate works
// Run with: rustc discord_test.rs --edition 2021 -L target/debug/deps -o discord_test && ./discord_test

use std::process::Command;

fn main() {
    // Run cargo test in a temp project
    let output = Command::new("cargo")
        .args(["run", "--example", "presence", "--", "1326962200619569183"])
        .current_dir("/home/z3r0/Github/spotist")
        .output();
    
    match output {
        Ok(o) => {
            println!("stdout: {}", String::from_utf8_lossy(&o.stdout));
            println!("stderr: {}", String::from_utf8_lossy(&o.stderr));
        }
        Err(e) => println!("Error: {}", e),
    }
}
