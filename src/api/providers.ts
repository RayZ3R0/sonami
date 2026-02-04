import { invoke } from "@tauri-apps/api/core";

export interface ProviderConfig {
  provider_id: string;
  server_url: string;
  username: string;
  enabled: boolean;
}

export interface HifiInstanceConfig {
  endpoints_url: string;
  is_default: boolean;
}

export async function configureSubsonic(
  serverUrl: string,
  username: string,
  password: string,
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
  password: string,
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

export async function getHifiConfig(): Promise<HifiInstanceConfig> {
  return await invoke<HifiInstanceConfig>("get_hifi_config");
}

export async function setHifiConfig(endpointsUrl: string): Promise<string> {
  return await invoke<string>("set_hifi_config", { endpointsUrl });
}

export async function resetHifiConfig(): Promise<string> {
  return await invoke<string>("reset_hifi_config");
}
