import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for auto-saving data after user stops editing
 *
 * @param {function} saveFunction - Async function to call to save data (should return Promise)
 * @param {any} data - The data to watch for changes
 * @param {object} options - Configuration options
 * @param {number} options.delay - Milliseconds to wait after last change (default 2000)
 * @param {boolean} options.enabled - Whether auto-save is enabled (default true)
 * @param {function} options.onSuccess - Callback when save succeeds
 * @param {function} options.onError - Callback when save fails
 *
 * @returns {object} - { isSaving, lastSaved, hasUnsavedChanges, triggerSave, error }
 *
 * @example
 * const { isSaving, lastSaved, hasUnsavedChanges } = useAutoSave(
 *   async (data) => await updateTeamName(data),
 *   teamNameData,
 *   { delay: 2000 }
 * );
 */
export const useAutoSave = (saveFunction, data, options = {}) => {
  const {
    delay = 2000,
    enabled = true,
    onSuccess = null,
    onError = null
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);

  // Refs to track timeouts and previous data
  const timeoutRef = useRef(null);
  const previousDataRef = useRef(data);
  const isFirstRenderRef = useRef(true);

  /**
   * Perform the save operation
   */
  const performSave = useCallback(async () => {
    if (!enabled || !hasUnsavedChanges) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveFunction(data);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);

      if (onSuccess) {
        onSuccess();
      }

      console.log('✅ Auto-save successful');
    } catch (err) {
      console.error('❌ Auto-save failed:', err);
      setError(err);

      if (onError) {
        onError(err);
      }
    } finally {
      setIsSaving(false);
    }
  }, [saveFunction, data, enabled, hasUnsavedChanges, onSuccess, onError]);

  /**
   * Trigger save immediately (skip debounce)
   */
  const triggerSave = useCallback(() => {
    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    performSave();
  }, [performSave]);

  /**
   * Effect to handle data changes and debounced saves
   */
  useEffect(() => {
    // Skip on first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousDataRef.current = data;
      return;
    }

    // Skip if not enabled
    if (!enabled) return;

    // Check if data actually changed
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);

    if (dataChanged) {
      setHasUnsavedChanges(true);
      previousDataRef.current = data;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for debounced save
      timeoutRef.current = setTimeout(() => {
        performSave();
      }, delay);

      console.log(`⏱️ Auto-save scheduled in ${delay}ms...`);
    }

    // Cleanup timeout on unmount or data change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, delay, performSave]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    triggerSave,
    error
  };
};

/**
 * Hook variant for form fields that saves on blur instead of debounce
 *
 * @param {function} saveFunction - Async function to call to save data
 * @param {any} data - The data to save
 * @param {object} options - Configuration options
 *
 * @returns {object} - { isSaving, lastSaved, onBlur, error }
 *
 * @example
 * const { isSaving, onBlur } = useAutoSaveOnBlur(
 *   async (data) => await updateCaption(data),
 *   captionData
 * );
 *
 * <input onBlur={onBlur} ... />
 */
export const useAutoSaveOnBlur = (saveFunction, data, options = {}) => {
  const { onSuccess = null, onError = null } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  const previousDataRef = useRef(data);

  const onBlur = useCallback(async () => {
    // Check if data actually changed
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);

    if (!dataChanged) {
      console.log('ℹ️ No changes detected, skipping save');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveFunction(data);
      setLastSaved(new Date());
      previousDataRef.current = data;

      if (onSuccess) {
        onSuccess();
      }

      console.log('✅ Auto-save on blur successful');
    } catch (err) {
      console.error('❌ Auto-save on blur failed:', err);
      setError(err);

      if (onError) {
        onError(err);
      }
    } finally {
      setIsSaving(false);
    }
  }, [saveFunction, data, onSuccess, onError]);

  return {
    isSaving,
    lastSaved,
    onBlur,
    error
  };
};

export default useAutoSave;
