import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '../components/Toast';

/**
 * Notification Context
 * Provides app-wide notification system with toast messages
 */
const NotificationContext = createContext(null);

/**
 * Custom hook to use notifications
 * @returns {object} - { showSuccess, showError, showInfo, showNotification }
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

/**
 * Notification Provider Component
 * Wraps the app and provides notification functionality to all children
 */
export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  /**
   * Show a notification
   * @param {string} type - 'success', 'error', 'info'
   * @param {string} message - Message to display
   * @param {number} duration - Optional custom duration in ms
   */
  const showNotification = useCallback((type, message, duration) => {
    const id = Date.now() + Math.random(); // Unique ID for each toast
    const newToast = {
      id,
      type,
      message,
      duration
    };

    setToasts((prevToasts) => [...prevToasts, newToast]);

    // Return the ID in case caller wants to manually dismiss
    return id;
  }, []);

  /**
   * Show success notification (green, auto-dismiss after 3s)
   * @param {string} message - Success message
   * @param {number} duration - Optional custom duration
   */
  const showSuccess = useCallback((message, duration) => {
    return showNotification('success', message, duration);
  }, [showNotification]);

  /**
   * Show error notification (red, auto-dismiss after 5s)
   * @param {string} message - Error message
   * @param {number} duration - Optional custom duration
   */
  const showError = useCallback((message, duration) => {
    return showNotification('error', message, duration);
  }, [showNotification]);

  /**
   * Show info notification (blue, auto-dismiss after 3s)
   * @param {string} message - Info message
   * @param {number} duration - Optional custom duration
   */
  const showInfo = useCallback((message, duration) => {
    return showNotification('info', message, duration);
  }, [showNotification]);

  /**
   * Dismiss a specific notification
   * @param {number} id - Toast ID to dismiss
   */
  const dismissNotification = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Dismiss all notifications
   */
  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    showSuccess,
    showError,
    showInfo,
    showNotification,
    dismissNotification,
    dismissAll
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={dismissNotification} />
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
