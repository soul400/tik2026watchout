"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface SupportPrivacyContextType {
  hideSupportNumbers: boolean;
  toggleHideSupportNumbers: () => void;
  setHideSupportNumbers: (hide: boolean) => void;
}

const SupportPrivacyContext = createContext<SupportPrivacyContextType>({
  hideSupportNumbers: false,
  toggleHideSupportNumbers: () => {},
  setHideSupportNumbers: () => {},
});

const STORAGE_KEY = "livepulse_hide_support_numbers";

export function SupportPrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hideSupportNumbers, setHideSupportNumbersState] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Load user preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setHideSupportNumbersState(stored === "true");
      }
    } catch {
      // localStorage may fail in private browsing mode
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const setHideSupportNumbers = (hide: boolean) => {
    setHideSupportNumbersState(hide);
    try {
      localStorage.setItem(STORAGE_KEY, hide ? "true" : "false");
    } catch {
      // quiet fallback
    }
  };

  const toggleHideSupportNumbers = () => {
    setHideSupportNumbers(!hideSupportNumbers);
  };

  return (
    <SupportPrivacyContext.Provider
      value={{
        hideSupportNumbers,
        toggleHideSupportNumbers,
        setHideSupportNumbers,
      }}
    >
      {children}
    </SupportPrivacyContext.Provider>
  );
}

export function useSupportPrivacy() {
  const context = useContext(SupportPrivacyContext);
  if (!context) {
    throw new Error("useSupportPrivacy must be used within a SupportPrivacyProvider");
  }
  return context;
}
