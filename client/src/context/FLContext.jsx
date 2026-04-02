/**
 * FL State Context — Global state for Federated Learning
 * 
 * Persists across page navigation using:
 * 1. React Context for real-time state
 * 2. localStorage for persistence across browser refreshes
 */

import React, { createContext, useState, useCallback, useEffect } from 'react';

export const FLContext = createContext(null);

const STORAGE_KEY = 'fl_state';

// Default initial state
const defaultState = {
  rounds: [],
  analytics: null,
  flStatus: null,
  appStatus: null,
  datasetPath: '',
  logs: [],
  training: false,
  clientId: 'client_1',
};

export function FLContextProvider({ children }) {
  const [state, setState] = useState(() => {
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultState;
    } catch (e) {
      console.warn('[FLContext] Failed to restore from localStorage:', e);
      return defaultState;
    }
  });

  // Auto-save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[FLContext] Failed to save to localStorage:', e);
    }
  }, [state]);

  // ── Update methods (memoized to prevent unnecessary re-renders) ──────────

  const setRounds = useCallback((rounds) => {
    setState((prev) => ({ ...prev, rounds }));
  }, []);

  const setAnalytics = useCallback((analytics) => {
    setState((prev) => ({ ...prev, analytics }));
  }, []);

  const setFlStatus = useCallback((flStatus) => {
    setState((prev) => ({ ...prev, flStatus }));
  }, []);

  const setAppStatus = useCallback((appStatus) => {
    setState((prev) => ({ ...prev, appStatus }));
  }, []);

  const setDatasetPath = useCallback((datasetPath) => {
    setState((prev) => ({ ...prev, datasetPath }));
  }, []);

  const setLogs = useCallback((logs) => {
    setState((prev) => ({ ...prev, logs }));
  }, []);

  const addLog = useCallback((line) => {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, line],
    }));
  }, []);

  const clearLogs = useCallback(() => {
    setState((prev) => ({ ...prev, logs: [] }));
  }, []);

  const setTraining = useCallback((training) => {
    setState((prev) => ({ ...prev, training }));
  }, []);

  const setClientId = useCallback((clientId) => {
    setState((prev) => ({ ...prev, clientId }));
  }, []);

  const clearState = useCallback(() => {
    setState(defaultState);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = {
    // State
    ...state,
    // Actions
    setRounds,
    setAnalytics,
    setFlStatus,
    setAppStatus,
    setDatasetPath,
    setLogs,
    addLog,
    clearLogs,
    setTraining,
    setClientId,
    clearState,
  };

  return (
    <FLContext.Provider value={value}>
      {children}
    </FLContext.Provider>
  );
}

/**
 * Hook to use FL context.
 * Throws error if used outside FLContextProvider.
 */
export function useFLContext() {
  const context = React.useContext(FLContext);
  if (!context) {
    throw new Error('useFLContext must be used within FLContextProvider');
  }
  return context;
}
