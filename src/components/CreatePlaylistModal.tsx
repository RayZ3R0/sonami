import { useState } from 'react';
import { Modal } from './Modal';
import { usePlayer } from '../context/PlayerContext';

interface CreatePlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreatePlaylistModal = ({ isOpen, onClose }: CreatePlaylistModalProps) => {
    const { createPlaylist } = usePlayer();
    const [name, setName] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            await createPlaylist(name.trim());
            setName("");
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Playlist">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <input
                        type="text"
                        placeholder="My Awesome Playlist"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-theme-surface-active/50 border border-white/10 rounded-lg text-theme-primary placeholder-theme-muted/50 focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition-all"
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-theme-muted hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="px-4 py-2 text-sm font-medium bg-theme-accent text-white rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Create Playlist
                    </button>
                </div>
            </form>
        </Modal>
    );
};
