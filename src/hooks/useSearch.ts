import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { searchLibraryFull, LocalSearchResults } from "../api/library";
import { getProviderConfigs, ProviderConfig } from "../api/providers";
import { usePlayer } from "../context/PlayerContext";

export interface TidalTrack {
    id: number;
    title: string;
    artist?: { id?: number; name: string; picture?: string };
    album?: { id?: number; title: string; cover?: string };
    duration?: number;
    audioQuality?: string;
}

export interface TidalAlbum {
    id: number;
    title: string;
    artist?: { id?: number; name: string; picture?: string };
    artists?: { id?: number; name: string; picture?: string }[];
    cover?: string;
    releaseDate?: string;
    numberOfTracks?: number;
}

export interface TidalArtist {
    id: number;
    name: string;
    picture?: string;
}

export interface ProviderSearchResults {
    tracks: any[];
    albums: any[];
    artists: any[];
}

export interface UnifiedSearchTrack {
    id: string;
    type: "local" | "tidal" | "subsonic" | "jellyfin";
    title: string;
    artist: string;
    album: string;
    duration: number;
    cover?: string;
    providerId?: string;
    externalId?: string;
    raw: any;
}

export interface UnifiedSearchAlbum {
    id: string;
    type: "local" | "tidal" | "subsonic" | "jellyfin";
    title: string;
    artist: string;
    cover?: string;
    year?: string;
    providerId?: string;
    externalId?: string;
    raw: any;
}

export interface UnifiedSearchArtist {
    id: string;
    type: "local" | "tidal" | "subsonic" | "jellyfin";
    name: string;
    cover?: string;
    providerId?: string;
    externalId?: string;
    raw: any;
}

export interface UnifiedSearchResults {
    tracks: UnifiedSearchTrack[];
    albums: UnifiedSearchAlbum[];
    artists: UnifiedSearchArtist[];
}

interface UseSearchOptions {
    query: string;
    types?: ("track" | "album" | "artist")[];
    debounceMs?: number;
    enabled?: boolean;
}

interface UseSearchResult {
    results: UnifiedSearchResults;
    isLoading: boolean;
    loadingStates: {
        local: boolean;
        tidal: boolean;
        subsonic: boolean;
        jellyfin: boolean;
    };
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

function getTidalCoverUrl(coverId?: string, size: number = 640): string | undefined {
    if (!coverId) return undefined;
    return `https://resources.tidal.com/images/${coverId.replace(/-/g, "/")}/${size}x${size}.jpg`;
}

export function useSearch({
    query,
    types = ["track", "album", "artist"],
    debounceMs = 200,
    enabled = true,
}: UseSearchOptions): UseSearchResult {
    const { searchProviderOrder } = usePlayer();
    const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);

    const [localResults, setLocalResults] = useState<LocalSearchResults>({ tracks: [], albums: [], artists: [] });
    const [tidalTracks, setTidalTracks] = useState<TidalTrack[]>([]);
    const [tidalAlbums, setTidalAlbums] = useState<TidalAlbum[]>([]);
    const [tidalArtists, setTidalArtists] = useState<TidalArtist[]>([]);
    const [subsonicResults, setSubsonicResults] = useState<ProviderSearchResults>({ tracks: [], albums: [], artists: [] });
    const [jellyfinResults, setJellyfinResults] = useState<ProviderSearchResults>({ tracks: [], albums: [], artists: [] });

    const [loadingLocal, setLoadingLocal] = useState(false);
    const [loadingTidal, setLoadingTidal] = useState(false);
    const [loadingSubsonic, setLoadingSubsonic] = useState(false);
    const [loadingJellyfin, setLoadingJellyfin] = useState(false);

    const debouncedQuery = useDebounce(query, debounceMs);
    const currentQueryRef = useRef(query);

    useEffect(() => {
        getProviderConfigs().then(setProviderConfigs).catch(console.error);
    }, []);

    useEffect(() => {
        currentQueryRef.current = debouncedQuery;
        if (!enabled || !debouncedQuery || debouncedQuery.length < 2) {
            setLocalResults({ tracks: [], albums: [], artists: [] });
            setTidalTracks([]);
            setTidalAlbums([]);
            setTidalArtists([]);
            setSubsonicResults({ tracks: [], albums: [], artists: [] });
            setJellyfinResults({ tracks: [], albums: [], artists: [] });
            return;
        }

        const searchLocal = async () => {
            setLoadingLocal(true);
            try {
                const results = await searchLibraryFull(debouncedQuery);
                if (currentQueryRef.current === debouncedQuery) {
                    setLocalResults(results);
                }
            } catch (e) {
                console.error("Local search failed:", e);
                if (currentQueryRef.current === debouncedQuery) {
                    setLocalResults({ tracks: [], albums: [], artists: [] });
                }
            } finally {
                if (currentQueryRef.current === debouncedQuery) {
                    setLoadingLocal(false);
                }
            }
        };

        const searchTidal = async () => {
            setLoadingTidal(true);
            try {
                const [tracksRes, albumsRes, artistsRes] = await Promise.all([
                    types.includes("track") ? invoke<{ items: TidalTrack[] }>("tidal_search_tracks", { query: debouncedQuery }) : Promise.resolve({ items: [] }),
                    types.includes("album") ? invoke<{ items: TidalAlbum[] }>("tidal_search_albums", { query: debouncedQuery }) : Promise.resolve({ items: [] }),
                    types.includes("artist") ? invoke<{ items: TidalArtist[] }>("tidal_search_artists", { query: debouncedQuery }) : Promise.resolve({ items: [] }),
                ]);
                if (currentQueryRef.current === debouncedQuery) {
                    setTidalTracks(tracksRes.items?.slice(0, 15) || []);
                    setTidalAlbums(albumsRes.items?.slice(0, 10) || []);
                    setTidalArtists(artistsRes.items?.slice(0, 10) || []);
                }
            } catch (e) {
                console.error("Tidal search failed:", e);
                if (currentQueryRef.current === debouncedQuery) {
                    setTidalTracks([]);
                    setTidalAlbums([]);
                    setTidalArtists([]);
                }
            } finally {
                if (currentQueryRef.current === debouncedQuery) {
                    setLoadingTidal(false);
                }
            }
        };

        const searchSubsonic = async () => {
            const subsonicConfigured = providerConfigs.some(c => c.provider_id === "subsonic");
            if (!subsonicConfigured) {
                setSubsonicResults({ tracks: [], albums: [], artists: [] });
                return;
            }
            setLoadingSubsonic(true);
            try {
                const response: any = await invoke("search_music", { query: debouncedQuery, providerId: "subsonic" });
                if (currentQueryRef.current === debouncedQuery) {
                    setSubsonicResults({
                        tracks: response.tracks?.slice(0, 15) || [],
                        albums: response.albums?.slice(0, 10) || [],
                        artists: response.artists?.slice(0, 10) || [],
                    });
                }
            } catch (e) {
                console.error("Subsonic search failed:", e);
                if (currentQueryRef.current === debouncedQuery) {
                    setSubsonicResults({ tracks: [], albums: [], artists: [] });
                }
            } finally {
                if (currentQueryRef.current === debouncedQuery) {
                    setLoadingSubsonic(false);
                }
            }
        };

        const searchJellyfin = async () => {
            const jellyfinConfigured = providerConfigs.some(c => c.provider_id === "jellyfin");
            if (!jellyfinConfigured) {
                setJellyfinResults({ tracks: [], albums: [], artists: [] });
                return;
            }
            setLoadingJellyfin(true);
            try {
                const response: any = await invoke("search_music", { query: debouncedQuery, providerId: "jellyfin" });
                if (currentQueryRef.current === debouncedQuery) {
                    setJellyfinResults({
                        tracks: response.tracks?.slice(0, 15) || [],
                        albums: response.albums?.slice(0, 10) || [],
                        artists: response.artists?.slice(0, 10) || [],
                    });
                }
            } catch (e) {
                console.error("Jellyfin search failed:", e);
                if (currentQueryRef.current === debouncedQuery) {
                    setJellyfinResults({ tracks: [], albums: [], artists: [] });
                }
            } finally {
                if (currentQueryRef.current === debouncedQuery) {
                    setLoadingJellyfin(false);
                }
            }
        };

        searchLocal();
        searchTidal();
        searchSubsonic();
        searchJellyfin();
    }, [debouncedQuery, enabled, types, providerConfigs]);

    const results = useMemo((): UnifiedSearchResults => {
        const unifiedTracks: UnifiedSearchTrack[] = [];
        const unifiedAlbums: UnifiedSearchAlbum[] = [];
        const unifiedArtists: UnifiedSearchArtist[] = [];

        // Create a set of local track keys (provider:externalId) for deduplication
        const localTrackKeys = new Set(
            localResults.tracks
                .filter(t => t.provider_id && t.external_id)
                .map(t => `${t.provider_id}:${t.external_id}`)
        );

        const addTracks = (type: "local" | "tidal" | "subsonic" | "jellyfin") => {
            if (type === "local") {
                localResults.tracks.forEach(t => {
                    unifiedTracks.push({
                        id: t.id,
                        type: "local",
                        title: t.title,
                        artist: t.artist,
                        album: t.album,
                        duration: t.duration,
                        cover: t.cover_image,
                        providerId: t.provider_id,
                        externalId: t.external_id,
                        raw: t,
                    });
                });
            } else if (type === "tidal") {
                tidalTracks.filter(t => {
                    const key = `tidal:${t.id}`;
                    return !localTrackKeys.has(key);
                }).forEach(t => {
                    unifiedTracks.push({
                        id: `tidal:${t.id}`,
                        type: "tidal",
                        title: t.title,
                        artist: t.artist?.name || "Unknown Artist",
                        album: t.album?.title || "",
                        duration: t.duration || 0,
                        cover: getTidalCoverUrl(t.album?.cover, 160),
                        providerId: "tidal",
                        externalId: t.id.toString(),
                        raw: t,
                    });
                });
            } else if (type === "subsonic") {
                subsonicResults.tracks.forEach(t => {
                    unifiedTracks.push({
                        id: `subsonic:${t.id}`,
                        type: "subsonic",
                        title: t.title,
                        artist: t.artist || "Unknown Artist",
                        album: t.album || "",
                        duration: t.duration || 0,
                        cover: t.cover_url,
                        providerId: "subsonic",
                        externalId: t.id,
                        raw: t,
                    });
                });
            } else if (type === "jellyfin") {
                jellyfinResults.tracks.forEach(t => {
                    unifiedTracks.push({
                        id: `jellyfin:${t.id}`,
                        type: "jellyfin",
                        title: t.title,
                        artist: t.artist || "Unknown Artist",
                        album: t.album || "",
                        duration: t.duration || 0,
                        cover: t.cover_url,
                        providerId: "jellyfin",
                        externalId: t.id,
                        raw: t,
                    });
                });
            }
        };

        const addAlbums = (type: "local" | "tidal" | "subsonic" | "jellyfin") => {
            if (type === "local") {
                localResults.albums.forEach(a => {
                    unifiedAlbums.push({
                        id: a.id,
                        type: "local",
                        title: a.title,
                        artist: a.artist,
                        cover: a.cover_image,
                        providerId: a.provider_id,
                        externalId: a.external_id,
                        raw: a,
                    });
                });
            } else if (type === "tidal") {
                tidalAlbums.forEach(a => {
                    unifiedAlbums.push({
                        id: `tidal:${a.id}`,
                        type: "tidal",
                        title: a.title,
                        artist: a.artist?.name || a.artists?.[0]?.name || "Unknown Artist",
                        cover: getTidalCoverUrl(a.cover, 320),
                        year: a.releaseDate?.split("-")[0],
                        raw: a,
                    });
                });
            } else if (type === "subsonic") {
                subsonicResults.albums.forEach(a => {
                    unifiedAlbums.push({
                        id: `subsonic:${a.id}`,
                        type: "subsonic",
                        title: a.title,
                        artist: a.artist || "Unknown Artist",
                        cover: a.cover_url,
                        year: a.year?.toString(),
                        providerId: "subsonic",
                        externalId: a.id,
                        raw: a,
                    });
                });
            } else if (type === "jellyfin") {
                jellyfinResults.albums.forEach(a => {
                    unifiedAlbums.push({
                        id: `jellyfin:${a.id}`,
                        type: "jellyfin",
                        title: a.title,
                        artist: a.artist || "Unknown Artist",
                        cover: a.cover_url,
                        year: a.year?.toString(),
                        providerId: "jellyfin",
                        externalId: a.id,
                        raw: a,
                    });
                });
            }
        };

        const addArtists = (type: "local" | "tidal" | "subsonic" | "jellyfin") => {
            if (type === "local") {
                localResults.artists.forEach(a => {
                    unifiedArtists.push({
                        id: a.id,
                        type: "local",
                        name: a.name,
                        cover: a.cover_image,
                        providerId: a.provider_id,
                        externalId: a.external_id,
                        raw: a,
                    });
                });
            } else if (type === "tidal") {
                tidalArtists.forEach(a => {
                    unifiedArtists.push({
                        id: `tidal:${a.id}`,
                        type: "tidal",
                        name: a.name,
                        cover: getTidalCoverUrl(a.picture, 320),
                        raw: a,
                    });
                });
            } else if (type === "subsonic") {
                subsonicResults.artists.forEach(a => {
                    unifiedArtists.push({
                        id: `subsonic:${a.id}`,
                        type: "subsonic",
                        name: a.name,
                        cover: a.cover_url,
                        providerId: "subsonic",
                        externalId: a.id,
                        raw: a,
                    });
                });
            } else if (type === "jellyfin") {
                jellyfinResults.artists.forEach(a => {
                    unifiedArtists.push({
                        id: `jellyfin:${a.id}`,
                        type: "jellyfin",
                        name: a.name,
                        cover: a.cover_url,
                        providerId: "jellyfin",
                        externalId: a.id,
                        raw: a,
                    });
                });
            }
        };

        searchProviderOrder.forEach(provider => {
            addTracks(provider as any);
            addAlbums(provider as any);
            addArtists(provider as any);
        });

        return { tracks: unifiedTracks, albums: unifiedAlbums, artists: unifiedArtists };
    }, [localResults, tidalTracks, tidalAlbums, tidalArtists, subsonicResults, jellyfinResults, searchProviderOrder]);

    const isLoading = loadingLocal || loadingTidal || loadingSubsonic || loadingJellyfin;

    return {
        results,
        isLoading,
        loadingStates: {
            local: loadingLocal,
            tidal: loadingTidal,
            subsonic: loadingSubsonic,
            jellyfin: loadingJellyfin,
        },
    };
}
