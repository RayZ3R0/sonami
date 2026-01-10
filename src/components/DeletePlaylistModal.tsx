import { Modal } from "./Modal";
import { useState } from "react";

interface DeletePlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    playlistName: string;
}

export const DeletePlaylistModal = ({
    isOpen,
    onClose,
    onConfirm,
    playlistName,
}: DeletePlaylistModalProps) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delete Playlist">
            <div className="flex flex-col gap-6">
                <p className="text-white/70 text-sm leading-relaxed">
                    Are you sure you want to delete <span className="text-white font-semibold">"{playlistName}"</span>?
                    This action cannot be undone.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
