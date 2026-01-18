import {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { VerificationProgress, VerifiedSpotifyTrack } from "../api/spotify";

export type ImportPhase =
    | "input"
    | "fetching"
    | "verifying"
    | "review"
    | "importing"
    | "complete"
    | "error";

interface SpotifyImportState {
    isImporting: boolean;
    isMinimized: boolean;
    isModalOpen: boolean;
    phase: ImportPhase;
    progress: VerificationProgress | null;
    playlistName: string;
    error: string | null;
    verifiedTracks: VerifiedSpotifyTrack[];
    selectedTracks: Set<number>;
    importResult: {
        added: number;
        skipped: number;
        errors?: string[];
    } | null;
}

interface SpotifyImportContextType extends SpotifyImportState {
    startImport: (playlistName: string) => boolean;
    updateProgress: (progress: VerificationProgress) => void;
    setPhase: (phase: ImportPhase) => void;
    setError: (error: string | null) => void;
    setVerifiedTracks: (tracks: VerifiedSpotifyTrack[]) => void;
    setSelectedTracks: (tracks: Set<number>) => void;
    setImportResult: (result: SpotifyImportState["importResult"]) => void;
    setPlaylistName: (name: string) => void;
    minimize: () => void;
    maximize: () => void;
    openModal: () => void;
    closeModal: () => void;
    reset: () => void;
    canStartNewImport: boolean;
}

const initialState: SpotifyImportState = {
    isImporting: false,
    isMinimized: false,
    isModalOpen: false,
    phase: "input",
    progress: null,
    playlistName: "",
    error: null,
    verifiedTracks: [],
    selectedTracks: new Set<number>(),
    importResult: null,
};

const SpotifyImportContext = createContext<SpotifyImportContextType | undefined>(
    undefined
);

export const SpotifyImportProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<SpotifyImportState>(initialState);

    const isActivePhase = (phase: ImportPhase) =>
        phase === "fetching" || phase === "verifying" || phase === "importing";

    const startImport = useCallback((playlistName: string): boolean => {
        if (state.isImporting && isActivePhase(state.phase)) {
            return false;
        }
        setState((prev) => ({
            ...prev,
            isImporting: true,
            isMinimized: false,
            isModalOpen: true,
            playlistName,
            phase: "fetching",
            error: null,
            progress: null,
            verifiedTracks: [],
            selectedTracks: new Set<number>(),
            importResult: null,
        }));
        return true;
    }, [state.isImporting, state.phase]);

    const updateProgress = useCallback((progress: VerificationProgress) => {
        setState((prev) => ({ ...prev, progress }));
    }, []);

    const setPhase = useCallback((phase: ImportPhase) => {
        setState((prev) => ({
            ...prev,
            phase,
            isImporting: isActivePhase(phase),
        }));
    }, []);

    const setError = useCallback((error: string | null) => {
        setState((prev) => ({
            ...prev,
            error,
            phase: error ? "error" : prev.phase,
            isImporting: false,
        }));
    }, []);

    const setVerifiedTracks = useCallback((tracks: VerifiedSpotifyTrack[]) => {
        setState((prev) => ({ ...prev, verifiedTracks: tracks }));
    }, []);

    const setSelectedTracks = useCallback((tracks: Set<number>) => {
        setState((prev) => ({ ...prev, selectedTracks: tracks }));
    }, []);

    const setImportResult = useCallback(
        (result: SpotifyImportState["importResult"]) => {
            setState((prev) => ({
                ...prev,
                importResult: result,
                phase: "complete",
                isImporting: false,
            }));
        },
        []
    );

    const setPlaylistName = useCallback((name: string) => {
        setState((prev) => ({ ...prev, playlistName: name }));
    }, []);

    const minimize = useCallback(() => {
        setState((prev) => ({ ...prev, isMinimized: true, isModalOpen: false }));
    }, []);

    const maximize = useCallback(() => {
        setState((prev) => ({ ...prev, isMinimized: false, isModalOpen: true }));
    }, []);

    const openModal = useCallback(() => {
        setState((prev) => ({ ...prev, isModalOpen: true, isMinimized: false }));
    }, []);

    const closeModal = useCallback(() => {
        setState((prev) => {
            // If in active import phase, just minimize
            if (isActivePhase(prev.phase)) {
                return { ...prev, isModalOpen: false, isMinimized: true };
            }
            // Otherwise, close and potentially reset
            return { ...prev, isModalOpen: false };
        });
    }, []);

    const reset = useCallback(() => {
        setState(initialState);
    }, []);

    const canStartNewImport = !state.isImporting || !isActivePhase(state.phase);

    return (
        <SpotifyImportContext.Provider
            value={{
                ...state,
                startImport,
                updateProgress,
                setPhase,
                setError,
                setVerifiedTracks,
                setSelectedTracks,
                setImportResult,
                setPlaylistName,
                minimize,
                maximize,
                openModal,
                closeModal,
                reset,
                canStartNewImport,
            }}
        >
            {children}
        </SpotifyImportContext.Provider>
    );
};

export const useSpotifyImport = (): SpotifyImportContextType => {
    const context = useContext(SpotifyImportContext);
    if (!context) {
        throw new Error(
            "useSpotifyImport must be used within a SpotifyImportProvider"
        );
    }
    return context;
};
