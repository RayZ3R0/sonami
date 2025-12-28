import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from "react";

// Toast types with semantic meaning
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number; // ms, 0 = persistent
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Hook for consuming toasts
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};

// Icons for each toast type
const ToastIcons = {
    success: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ),
    error: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    ),
    warning: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    info: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
};

// Individual toast component
const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: () => void }) => {
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);

    const handleRemove = useCallback(() => {
        setIsExiting(true);
        setTimeout(onRemove, 300); // Match animation duration
    }, [onRemove]);

    useEffect(() => {
        if (toast.duration === 0) return; // Persistent toast

        const duration = toast.duration || 4000;
        const interval = 50;
        const step = (interval / duration) * 100;

        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev <= 0) {
                    clearInterval(timer);
                    handleRemove();
                    return 0;
                }
                return prev - step;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [toast.duration, handleRemove]);

    // Color classes based on type
    const typeStyles = {
        success: {
            icon: "text-[var(--theme-success)]",
            bg: "bg-[var(--theme-success)]/10",
            border: "border-[var(--theme-success)]/30",
            progress: "bg-[var(--theme-success)]",
        },
        error: {
            icon: "text-[var(--theme-error)]",
            bg: "bg-[var(--theme-error)]/10",
            border: "border-[var(--theme-error)]/30",
            progress: "bg-[var(--theme-error)]",
        },
        warning: {
            icon: "text-[var(--theme-warning)]",
            bg: "bg-[var(--theme-warning)]/10",
            border: "border-[var(--theme-warning)]/30",
            progress: "bg-[var(--theme-warning)]",
        },
        info: {
            icon: "text-[var(--theme-accent)]",
            bg: "bg-[var(--theme-accent)]/10",
            border: "border-[var(--theme-accent)]/30",
            progress: "bg-[var(--theme-accent)]",
        },
    };

    const styles = typeStyles[toast.type];

    return (
        <div
            className={`
                relative overflow-hidden
                w-[360px] min-h-[60px]
                glass-floating rounded-xl
                border ${styles.border}
                ${styles.bg}
                transform transition-all duration-300 ease-out
                ${isExiting ? "opacity-0 translate-x-full scale-95" : "opacity-100 translate-x-0 scale-100"}
                animate-toast-enter
                group
            `}
            role="alert"
            aria-live="polite"
        >
            {/* Content */}
            <div className="flex items-start gap-3 p-4 pr-10">
                {/* Icon */}
                <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
                    {ToastIcons[toast.type]}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-theme-primary leading-tight">
                        {toast.title}
                    </p>
                    {toast.message && (
                        <p className="mt-1 text-xs text-theme-secondary leading-snug line-clamp-2">
                            {toast.message}
                        </p>
                    )}
                </div>

                {/* Close button */}
                <button
                    onClick={handleRemove}
                    className="
                        absolute top-3 right-3
                        w-6 h-6 rounded-md
                        flex items-center justify-center
                        text-theme-muted hover:text-theme-primary
                        hover:bg-theme-surface-hover
                        transition-all duration-150
                        opacity-0 group-hover:opacity-100
                    "
                    aria-label="Dismiss notification"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Progress bar */}
            {toast.duration !== 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-theme-surface-hover">
                    <div
                        className={`h-full ${styles.progress} transition-all duration-50 ease-linear`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
};

// Toast container that renders all toasts
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
    if (toasts.length === 0) return null;

    return (
        <div
            className="
                fixed top-[calc(var(--titlebar-h)+16px)] right-4
                z-[9999]
                flex flex-col gap-3
                pointer-events-none
            "
        >
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
                </div>
            ))}
        </div>
    );
};

// Provider component
export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts((prev) => [...prev, { ...toast, id }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

// Convenience functions for common toast types
export const toast = {
    success: (title: string, message?: string, duration?: number) => ({
        type: "success" as const,
        title,
        message,
        duration,
    }),
    error: (title: string, message?: string, duration?: number) => ({
        type: "error" as const,
        title,
        message,
        duration: duration ?? 6000, // Errors stay longer
    }),
    warning: (title: string, message?: string, duration?: number) => ({
        type: "warning" as const,
        title,
        message,
        duration: duration ?? 5000,
    }),
    info: (title: string, message?: string, duration?: number) => ({
        type: "info" as const,
        title,
        message,
        duration,
    }),
};
