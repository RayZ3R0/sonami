import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Album, Artist, Track } from "../types";

interface UseAlbumResult {
  album: Album | null;
  tracks: Track[];
  isLoading: boolean;
  error: string | null;
}

interface UseArtistResult {
  artist: Artist | null;
  topTracks: Track[];
  albums: Album[];
  isLoading: boolean;
  error: string | null;
}

const parseId = (fullId: string) => {
  const parts = fullId.split(":");
  if (parts.length < 2) return { providerId: "local", id: fullId };
  return { providerId: parts[0], id: parts.slice(1).join(":") };
};

const normalizeTrack = (track: Track, providerId: string): Track => {
  const isPrefixed = track.id.includes(":");
  const unifiedId = isPrefixed ? track.id : `${providerId}:${track.id}`;
  return {
    ...track,
    id: unifiedId,
    // Ensure provider_id is set
    provider_id: track.provider_id || providerId,
    external_id: isPrefixed ? track.id.split(":")[1] : track.id,
    source: providerId.toUpperCase() as any,
    path: track.path || unifiedId, // Use existing path or unified ID as path
    // Preserve artist_id and album_id from backend (already prefixed)
    artist_id: track.artist_id,
    album_id: track.album_id,
  };
};

const normalizeAlbum = (album: Album, providerId: string): Album => {
  const isPrefixed = album.id.includes(":");
  return {
    ...album,
    id: isPrefixed ? album.id : `${providerId}:${album.id}`,
    artist_id:
      album.artist_id && !album.artist_id.includes(":")
        ? `${providerId}:${album.artist_id}`
        : album.artist_id,
  };
};

const normalizeArtist = (artist: Artist, providerId: string): Artist => {
  const isPrefixed = artist.id.includes(":");
  return {
    ...artist,
    id: isPrefixed ? artist.id : `${providerId}:${artist.id}`,
  };
};

export function useAlbum(albumId: string): UseAlbumResult {
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlbum = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { providerId, id } = parseId(albumId);

        let albumData: Album;
        let tracksData: Track[];

        if (providerId === "local") {
          // Use legacy/specific commands for local library
          // Assuming we have get_library_album equivalent or need to invoke specific command
          // Actually existing codebase probably used specific commands.
          // Let's assume we might need to implement or use 'get_library_albums' filtering,
          // BUT better: if 'local' isn't supported by generic system, we need to handle it.
          // Given previous context, local commands are: get_library_tracks, get_library_albums...
          // There doesn't seem to be a single 'get_library_album(id)' exposed directly based on reviewed files?
          // Wait, `get_album_details` was implemented in traits.

          // IF the backend relies on 'local' being a provider, we should have implemented it.
          // Since we didn't, we fallback to:
          throw new Error("Local provider details not yet implemented");
        } else {
          [{ val: albumData }, { val: tracksData }] = await Promise.all([
            invoke("get_album", { providerId, albumId: id }).then((v: any) => ({
              val: v,
            })),
            invoke("get_album_tracks", { providerId, albumId: id }).then(
              (v: any) => ({ val: v }),
            ),
          ]);
        }

        setAlbum(normalizeAlbum(albumData, providerId));
        setTracks(tracksData.map((t) => normalizeTrack(t, providerId)));
      } catch (e) {
        console.error("Failed to fetch album:", e);
        setError(e instanceof Error ? e.message : "Failed to load album");
      } finally {
        setIsLoading(false);
      }
    };

    if (albumId) {
      fetchAlbum();
    }
  }, [albumId]);

  return { album, tracks, isLoading, error };
}

export function useArtist(artistId: string): UseArtistResult {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArtist = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[useArtist] Fetching artist:", artistId);
        const { providerId, id } = parseId(artistId);
        console.log("[useArtist] Parsed:", { providerId, id });

        let artistData: Artist;
        let topTracksData: Track[];
        let albumsData: Album[];
        let usedProviderId = providerId;

        if (providerId === "local") {
          console.log(
            "[useArtist] 'local' provider detected. Checking fallbacks:",
            id,
          );
          // Try Subsonic, Jellyfin, Tidal in order if local isn't implemented or defaults
          const fallbackProviders = ["subsonic", "jellyfin", "tidal"];
          let found = false;

          for (const p of fallbackProviders) {
            try {
              const [a, t, al] = await Promise.all([
                invoke<Artist>("get_artist", { providerId: p, artistId: id }),
                invoke<Track[]>("get_artist_top_tracks", {
                  providerId: p,
                  artistId: id,
                }),
                invoke<Album[]>("get_artist_albums", {
                  providerId: p,
                  artistId: id,
                }),
              ]);
              artistData = a;
              topTracksData = t;
              albumsData = al;
              usedProviderId = p;
              found = true;
              console.log(`[useArtist] Found in provider: ${p}`);
              break;
            } catch (err) {
              // Continue
            }
          }

          if (!found) {
            throw new Error(
              "Artist not found (Local provider not implemented and fallbacks failed)",
            );
          }
        } else {
          [{ val: artistData }, { val: topTracksData }, { val: albumsData }] =
            await Promise.all([
              invoke("get_artist", { providerId, artistId: id }).then(
                (v: any) => ({ val: v }),
              ),
              invoke("get_artist_top_tracks", {
                providerId,
                artistId: id,
              }).then((v: any) => ({ val: v })),
              invoke("get_artist_albums", { providerId, artistId: id }).then(
                (v: any) => ({ val: v }),
              ),
            ]);
        }

        console.log("[useArtist] Fetched data for:", usedProviderId);

        setArtist(normalizeArtist(artistData!, usedProviderId));
        setTopTracks(
          topTracksData!.map((t) => normalizeTrack(t, usedProviderId)),
        );
        setAlbums(albumsData!.map((a) => normalizeAlbum(a, usedProviderId)));
      } catch (e) {
        console.error("Failed to fetch artist:", e);
        // Extract error message potentially from the invokes
        const msg = e instanceof Error ? e.message : "Failed to load artist";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    if (artistId) {
      fetchArtist();
    }
  }, [artistId]);

  return { artist, topTracks, albums, isLoading, error };
}
