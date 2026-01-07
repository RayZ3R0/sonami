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
    const [description, setDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Reset form when opening
    if (!isOpen && (name || description)) {
        setName("");
        setDescription("");
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            setIsLoading(true);
            try {
                await createPlaylist(name.trim(), description.trim());
                setName("");
                setDescription("");
                onClose();
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Playlist">
            <div className="relative">
                {/* Decorative background element */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
                    <div className="flex gap-4">
                        {/* Placeholder Cover Art */}
                        <div className="w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-white/5 flex items-center justify-center flex-shrink-0 shadow-inner">
                            <svg className="w-10 h-10 text-white/20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        </div>

                        <div className="flex-1 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-white/60 uppercase tracking-wider pl-1">Name</label>
                                <input
                                    type="text"
                                    placeholder="My Playlist #1"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 transition-all font-medium"
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-wider pl-1">Description</label>
                        <textarea
                            placeholder="Add an optional description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 transition-all min-h-[80px] resize-none text-sm leading-relaxed"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || isLoading}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                        >
                            {isLoading ? "Creating..." : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
