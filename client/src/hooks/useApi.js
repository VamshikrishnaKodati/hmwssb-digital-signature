import { useState, useEffect, useCallback, useRef } from "react";

export const useApi = (apiFunction, options = {}) => {
  const { immediate = false, params = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const execute = useCallback(async (...args) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await apiFunction(...args);
      if (!controller.signal.aborted) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err.response?.data?.message || err.message || "An error occurred";
        setError(message);
      }
      throw err;
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [apiFunction]);

  useEffect(() => {
    if (immediate && params) {
      execute(params);
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset, setData };
};
