export interface RecommendedTrack {
  title: string;
  artist: string;
  album?: string;
  duration_ms: number;
  cover_url?: string;
  spotify_uri: string;
  matched_provider_id?: string;
  matched_external_id?: string;
  matched_local_id?: string;
  matched_artist_id?: string;
  matched_album_id?: string;
}

export interface RecommendationSection {
  title: string;
  description: string;
  seed_artist: string;
  source_playlist_uri?: string;
  tracks: RecommendedTrack[];
}

export interface TopArtistInfo {
  id: string;
  name: string;
  play_count: number;
}
