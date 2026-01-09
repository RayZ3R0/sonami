//! Quick Discord RPC test
//! Run with: cd examples && cargo run --example discord_test

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();

    println!("Creating Discord IPC client...");
    // Using a known working ID from the crate's tests
    let mut client = DiscordIpcClient::new("1459143320604508251");

    println!("Connecting to Discord...");
    match client.connect() {
        Ok(_) => println!("✅ Connected successfully!"),
        Err(e) => {
            println!("❌ Failed to connect: {}", e);
            return Err(e.into());
        }
    }

    println!("Setting activity...");
    match client.set_activity(
        activity::Activity::new()
            .details("Test Track")
            .state("by Test Artist"),
    ) {
        Ok(_) => println!("✅ Activity set successfully!"),
        Err(e) => {
            println!("❌ Failed to set activity: {}", e);
            return Err(e.into());
        }
    }

    println!("Activity should now be visible in Discord!");
    println!("Waiting 10 seconds before clearing...");
    std::thread::sleep(Duration::from_secs(10));

    println!("Clearing activity...");
    client.clear_activity()?;

    println!("Closing connection...");
    client.close()?;

    println!("Done!");
    Ok(())
}
