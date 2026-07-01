import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "panel";
  contentClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  contentClassName = "",
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Centered Premium Glass Card mode (for wizard)
  if (size === "panel") {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-primary/50 backdrop-blur-md transition-opacity duration-300"
          onClick={onClose}
        />
        {/* Panel */}
        <div
          className="relative z-[101] w-full max-w-6xl h-[85vh] bg-white flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden border border-gray-100"
          style={{ animation: "scaleInModal 0.4s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          {children}
        </div>

        <style>{`
          @keyframes scaleInModal {
            from { transform: scale(0.95); opacity: 0; }
            to   { transform: scale(1);    opacity: 1; }
          }
        `}</style>
      </div>,
      document.body
    );
  }

  const maxWidth = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size as "sm" | "md" | "lg" | "xl"];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      <div
        className="fixed inset-0 bg-primary/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        className={`relative z-[101] w-full ${maxWidth} bg-white rounded-2xl shadow-2xl animate-scale-in flex flex-col max-h-[95vh] sm:max-h-[90vh]`}
      >
        {/* Header */}
        <div
          className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg, #2B2D42 0%, #3d4060 100%)" }}
        >
          <h2 className="text-base sm:text-lg font-heading font-semibold text-white truncate tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-all p-1.5 rounded-lg hover:bg-white/10 hover:scale-110"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className={`p-4 sm:p-6 bg-gray-light flex-1 ${contentClassName ? "" : "overflow-y-auto"} ${footer ? "" : "rounded-b-2xl"} ${contentClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-t border-gray-border flex justify-end gap-2 sm:gap-3 flex-shrink-0 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
