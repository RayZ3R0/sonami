import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LocalSearchResults } from "../api/library";
import { getProviderConfigs, ProviderConfig } from "../api/providers";
import { usePlayer } from "../context/PlayerContext";
import { Track, Album, Artist } from "../types";
import { createTrackKey, isValidProvider, ProviderId } from "../utils/trackId";

export interface ProviderSearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: any[];
}

export interface UnifiedSearchTrack extends Omit<Track, "source"> {
  type: "local" | "tidal" | "subsonic" | "jellyfin";
  cover?: string;
  providerId?: string;
  externalId?: string;
  artistId?: string; // Provider-prefixed artist ID for navigation
  albumId?: string; // Provider-prefixed album ID for navigation
  raw: any;
}

export interface UnifiedSearchAlbum extends Album {
  type: "local" | "tidal" | "subsonic" | "jellyfin";
  cover?: string;
  providerId?: string;
  externalId?: string;
  raw: any;
}

export interface UnifiedSearchArtist extends Artist {
  type: "local" | "tidal" | "subsonic" | "jellyfin";
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

export function useSearch({
  query,
  types = ["track", "album", "artist"],
  debounceMs = 200,
  enabled = true,
}: UseSearchOptions): UseSearchResult {
  const { searchProviderOrder } = usePlayer();
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);

  const [localResults, setLocalResults] = useState<LocalSearchResults>({
    tracks: [],
    albums: [],
    artists: [],
  });
  const [tidalResults, setTidalResults] = useState<ProviderSearchResults>({
    tracks: [],
    albums: [],
    artists: [],
    playlists: [],
  });
  const [subsonicResults, setSubsonicResults] = useState<ProviderSearchResults>(
    { tracks: [], albums: [], artists: [], playlists: [] },
  );
  const [jellyfinResults, setJellyfinResults] = useState<ProviderSearchResults>(
    { tracks: [], albums: [], artists: [], playlists: [] },
  );

  const [loadingLocal] = useState(false);
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
      setTidalResults({ tracks: [], albums: [], artists: [], playlists: [] });
      setSubsonicResults({
        tracks: [],
        albums: [],
        artists: [],
        playlists: [],
      });
      setJellyfinResults({
        tracks: [],
        albums: [],
        artists: [],
        playlists: [],
      });
      return;
    }

    const searchProvider = async (
      providerId: string,
      setLoading: (loading: boolean) => void,
      setResults: (results: ProviderSearchResults) => void,
    ) => {
      setLoading(true);
      try {
        const response = await invoke<ProviderSearchResults>("search_music", {
          query: debouncedQuery,
          providerId,
        });
        if (currentQueryRef.current === debouncedQuery) {
          setResults({
            tracks: response.tracks?.slice(0, 15) || [],
            albums: response.albums?.slice(0, 10) || [],
            artists: response.artists?.slice(0, 10) || [],
            playlists: response.playlists || [],
          });
        }
      } catch (e) {
        console.error(`${providerId} search failed:`, e);
        if (currentQueryRef.current === debouncedQuery) {
          setResults({ tracks: [], albums: [], artists: [], playlists: [] });
        }
      } finally {
        if (currentQueryRef.current === debouncedQuery) {
          setLoading(false);
        }
      }
    };

    const configMap = new Map(providerConfigs.map((c) => [c.provider_id, c]));

    // searchLocal();

    // Tidal is always available (if authenticated, handled by backend usually, or we assume it is)
    // Check if we should only search if Tidal is configured? Currently Tidal is kind of "built-in" separate from generic providers list in some contexts
    // But for generic refactor, we treat it as provider "tidal".
    searchProvider("tidal", setLoadingTidal, setTidalResults);

    if (configMap.has("subsonic")) {
      searchProvider("subsonic", setLoadingSubsonic, setSubsonicResults);
    } else {
      setSubsonicResults({
        tracks: [],
        albums: [],
        artists: [],
        playlists: [],
      });
    }

    if (configMap.has("jellyfin")) {
      searchProvider("jellyfin", setLoadingJellyfin, setJellyfinResults);
    } else {
      setJellyfinResults({
        tracks: [],
        albums: [],
        artists: [],
        playlists: [],
      });
    }
  }, [debouncedQuery, enabled, types, providerConfigs]);

  const results = useMemo((): UnifiedSearchResults => {
    // Collect results by provider first
    const providerData: Record<ProviderId, ProviderSearchResults> = {
      local: {
        tracks: [] as Track[],
        albums: [] as Album[],
        artists: [] as Artist[],
        playlists: [],
      },
      tidal: {
        tracks: [] as Track[],
        albums: [] as Album[],
        artists: [] as Artist[],
        playlists: [],
      },
      subsonic: {
        tracks: [] as Track[],
        albums: [] as Album[],
        artists: [] as Artist[],
        playlists: [],
      },
      jellyfin: {
        tracks: [] as Track[],
        albums: [] as Album[],
        artists: [] as Artist[],
        playlists: [],
      },
      spotify: {
        tracks: [] as Track[],
        albums: [] as Album[],
        artists: [] as Artist[],
        playlists: [],
      },
    };

    const localTrackKeys = new Set(
      localResults.tracks
        .filter(
          (t) =>
            t.provider_id && t.external_id && isValidProvider(t.provider_id),
        )
        .map((t) =>
          createTrackKey(t.provider_id as ProviderId, t.external_id!),
        ),
    );

    const processProviderResults = (
      type: ProviderId,
      results: ProviderSearchResults | LocalSearchResults,
    ) => {
      const target = providerData[type];
      if (type === "local") {
        const local = results as LocalSearchResults;
        local.tracks.forEach((t) => {
          target.tracks.push({
            ...t,
            type: "local",
            cover: t.cover_image,
            providerId: t.provider_id,
            externalId: t.external_id,
            raw: t,
          } as UnifiedSearchTrack);
        });
        local.albums.forEach((a) => {
          target.albums.push({
            ...a,
            type: "local",
            id: a.id,
            title: a.title,
            artist: a.artist,
            cover: a.cover_image,
            providerId: a.provider_id,
            externalId: a.external_id,
            raw: a,
          } as UnifiedSearchAlbum);
        });
        local.artists.forEach((a) => {
          target.artists.push({
            ...a,
            type: "local",
            cover: a.cover_image,
            providerId: a.provider_id,
            externalId: a.external_id,
            raw: a,
          } as UnifiedSearchArtist);
        });
      } else {
        const provider = results as ProviderSearchResults;
        provider.tracks.forEach((t) => {
          // Backend now returns prefixed IDs (e.g., "tidal:12345")
          // Use the prefixed ID directly as the unified ID
          const unifiedId: string = t.id.includes(":")
            ? t.id
            : createTrackKey(type, t.id);

          // Deduplication: Skip if this track exists locally
          if (localTrackKeys.has(unifiedId)) return;

          target.tracks.push({
            ...t,
            id: unifiedId,
            type: type, // TypeScript knows type is ProviderId
            cover: t.cover_image,
            providerId: type,
            externalId: t.id.includes(":") ? t.id.split(":")[1] : t.id,
            artistId: t.artist_id, // Already prefixed by backend
            albumId: t.album_id, // Already prefixed by backend
            raw: t,
            path: t.path || unifiedId,
          } as unknown as UnifiedSearchTrack); // Need unknown cast because UnifiedSearchTrack expects specific type literal union, but we have generic ProviderId
        });
        provider.albums.forEach((a) => {
          // Backend now returns prefixed IDs - use directly or prefix if needed
          const unifiedId = a.id.includes(":")
            ? a.id
            : createTrackKey(type, a.id);
          target.albums.push({
            ...a,
            id: unifiedId,
            type: type,
            cover: a.cover_url,
            providerId: type,
            externalId: a.id.includes(":") ? a.id.split(":")[1] : a.id,
            raw: a,
          } as unknown as UnifiedSearchAlbum);
        });
        provider.artists.forEach((a) => {
          // Backend now returns prefixed IDs - use directly or prefix if needed
          const unifiedId = a.id.includes(":")
            ? a.id
            : createTrackKey(type, a.id);
          target.artists.push({
            ...a,
            id: unifiedId,
            type: type,
            cover: a.cover_url,
            providerId: type,
            externalId: a.id.includes(":") ? a.id.split(":")[1] : a.id,
            raw: a,
          } as unknown as UnifiedSearchArtist);
        });
      }
    };

    searchProviderOrder.forEach((provider) => {
      if (isValidProvider(provider)) {
        if (provider === "local") processProviderResults("local", localResults);
        else if (provider === "tidal")
          processProviderResults("tidal", tidalResults);
        else if (provider === "subsonic")
          processProviderResults("subsonic", subsonicResults);
        else if (provider === "jellyfin")
          processProviderResults("jellyfin", jellyfinResults);
      }
    });

    const interleave = <T extends { title?: string; name?: string }>(
      lists: T[][],
      query: string,
    ): T[] => {
      const result: T[] = [];
      const queryLower = query.toLowerCase();

      // 1. Extract exact matches first
      const exactMatches: T[] = [];
      const remainingLists = lists.map((list) => [...list]);

      // Helper to find and remove indices
      const extractExact = (list: T[]) => {
        const exacts = [];
        const others = [];
        for (const item of list) {
          const txt = item.title || item.name || "";
          if (txt.toLowerCase() === queryLower) {
            exacts.push(item);
          } else {
            others.push(item);
          }
        }
        return { exacts, others };
      };

      for (let i = 0; i < remainingLists.length; i++) {
        const { exacts, others } = extractExact(remainingLists[i]);
        exactMatches.push(...exacts);
        remainingLists[i] = others;
      }

      result.push(...exactMatches);

      // 2. Interleave the rest
      // We loop until all lists are empty
      let active = true;
      while (active) {
        active = false;
        for (let i = 0; i < remainingLists.length; i++) {
          if (remainingLists[i].length > 0) {
            result.push(remainingLists[i].shift()!);
            active = true;
          }
        }
      }

      return result;
    };

    // Create lists based on provider order
    const trackLists = searchProviderOrder.map(
      (p) => (providerData as any)[p]?.tracks || [],
    );
    const albumLists = searchProviderOrder.map(
      (p) => (providerData as any)[p]?.albums || [],
    );
    const artistLists = searchProviderOrder.map(
      (p) => (providerData as any)[p]?.artists || [],
    );

    return {
      tracks: interleave(trackLists, debouncedQuery),
      albums: interleave(albumLists, debouncedQuery),
      artists: interleave(artistLists, debouncedQuery),
    };
  }, [
    localResults,
    tidalResults,
    subsonicResults,
    jellyfinResults,
    debouncedQuery,
    searchProviderOrder,
  ]);

  const isLoading =
    loadingLocal || loadingTidal || loadingSubsonic || loadingJellyfin;

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
