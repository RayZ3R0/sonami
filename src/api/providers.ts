import { invoke } from "@tauri-apps/api/core";

export interface ProviderConfig {
    provider_id: string;
    server_url: string;
    username: string;
    enabled: boolean;
}

export async function configureSubsonic(
    serverUrl: string,
    username: string,
    password: string
): Promise<string> {
    return await invoke<string>("configure_subsonic", {
        serverUrl,
        username,
        password,
    });
}

export async function configureJellyfin(
    serverUrl: string,
    username: string,
    password: string
): Promise<string> {
    return await invoke<string>("configure_jellyfin", {
        serverUrl,
        username,
        password,
    });
}

export async function getProviderConfigs(): Promise<ProviderConfig[]> {
    return await invoke<ProviderConfig[]>("get_provider_configs");
}

export async function removeProviderConfig(providerId: string): Promise<void> {
    await invoke("remove_provider_config", { providerId });
}
