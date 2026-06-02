"use client";

interface WatchlistModalProps {
  isOpen: boolean;
  message: string;
  isLoading: boolean;
  onClose: () => void;
}

export function WatchlistModal({ isOpen, message, isLoading, onClose }: WatchlistModalProps) {
  if (!isOpen) return null;

  const isSuccess = message.startsWith("✓");

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0d1117",
          border: `1px solid ${isSuccess ? "#22c55e" : "#ef4444"}`,
          borderRadius: 8,
          padding: "20px 24px",
          maxWidth: 320,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #253347", borderTop: `3px solid ${isSuccess ? "#22c55e" : "#ef4444"}`, animation: "spin 1s linear infinite" }} />
        )}

        {!isLoading && (
          <div style={{ fontSize: 32 }}>
            {isSuccess ? "✓" : "✗"}
          </div>
        )}

        <div
          style={{
            fontSize: 14,
            color: isSuccess ? "#4ade80" : "#f87171",
            fontWeight: 600,
            textAlign: "center",
            fontFamily: "'JetBrains Mono','IBM Plex Mono',monospace",
          }}
        >
          {message}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
