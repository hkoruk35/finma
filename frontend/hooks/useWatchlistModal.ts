import { useState, useCallback } from "react";

interface UseWatchlistModalReturn {
  isOpen: boolean;
  selectedTicker: string | null;
  message: string;
  isLoading: boolean;
  openModal: (ticker: string) => void;
  closeModal: () => void;
  addToWatchlist: (ticker: string) => Promise<void>;
}

export function useWatchlistModal(): UseWatchlistModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const openModal = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedTicker(null);
    setMessage("");
  }, []);

  const addToWatchlist = useCallback(async (ticker: string) => {
    setIsLoading(true);
    try {
      // Get current watchlist from localStorage
      const cachedWatchlist = localStorage.getItem("t_wl");
      let watchlist: string[] = [];

      if (cachedWatchlist) {
        try {
          watchlist = JSON.parse(cachedWatchlist);
        } catch {
          watchlist = [];
        }
      }

      // Add ticker if not already there
      if (!watchlist.includes(ticker.toUpperCase())) {
        watchlist.push(ticker.toUpperCase());
      }

      // Update localStorage
      localStorage.setItem("t_wl", JSON.stringify(watchlist));

      // Sync to backend
      const res = await fetch("/api/store/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: watchlist }),
      });

      if (!res.ok) throw new Error("Failed to sync watchlist");

      setMessage(`✓ Watchlist'e eklendi: ${ticker.toUpperCase()}`);

      // Auto-close after 2 seconds
      setTimeout(() => {
        closeModal();
      }, 2000);
    } catch (error) {
      console.error("Watchlist error:", error);
      setMessage("✗ Hata: Eklenemedi");
      setTimeout(() => {
        closeModal();
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  }, [closeModal]);

  return {
    isOpen,
    selectedTicker,
    message,
    isLoading,
    openModal,
    closeModal,
    addToWatchlist,
  };
}
