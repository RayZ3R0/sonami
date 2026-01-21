/**
 * Track ID Utilities
 * 
 * Provides consistent track key generation and parsing across the application.
 * All providers use the uniform format: `{provider}:{externalId}`
 */

export type ProviderId = "local" | "tidal" | "subsonic" | "jellyfin";

export const VALID_PROVIDERS: readonly ProviderId[] = ["local", "tidal", "subsonic", "jellyfin"] as const;

/**
 * Validates if a string is a valid provider ID
 */
export function isValidProvider(id: string): id is ProviderId {
    return VALID_PROVIDERS.includes(id as ProviderId);
}

/**
 * Creates a canonical track key for identifying tracks across the app.
 * 
 * Format: `{provider}:{externalId}`
 * Examples: "tidal:12345", "subsonic:abc123", "jellyfin:xyz789"
 */
export function createTrackKey(providerId: ProviderId, externalId: string): string {
    return `${providerId}:${externalId}`;
}

/**
 * Parses a track key back into provider and external ID.
 * Returns null if the key is invalid.
 */
export function parseTrackKey(key: string): { providerId: ProviderId; externalId: string } | null {
    const colonIndex = key.indexOf(":");
    if (colonIndex === -1) return null;

    const providerId = key.slice(0, colonIndex);
    const externalId = key.slice(colonIndex + 1);

    if (!isValidProvider(providerId)) {
        return null;
    }

    return { providerId, externalId };
}

/**
 * Gets track key from a Track-like object, with fallback logic for different data shapes.
 */
export function getTrackKeyFromObject(track: {
    provider_id?: string;
    external_id?: string;
    path?: string;
}): string | null {
    // Prefer explicit provider_id + external_id
    if (track.provider_id && track.external_id && isValidProvider(track.provider_id)) {
        return createTrackKey(track.provider_id, track.external_id);
    }

    // Fallback: parse from path (format: "provider:id")
    if (track.path) {
        const parsed = parseTrackKey(track.path);
        if (parsed) {
            return createTrackKey(parsed.providerId, parsed.externalId);
        }
    }

    return null;
}
