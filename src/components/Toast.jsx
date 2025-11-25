import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

/**
 * Toast Notification Component
 * Displays temporary notification messages with automatic dismiss
 *
 * @param {string} type - Type of notification: 'success', 'error', 'info'
 * @param {string} message - Message to display
 * @param {function} onClose - Callback when notification is dismissed
 * @param {number} duration - Auto-dismiss duration in ms (default: 3000 for success/info, 5000 for error)
 */
const Toast = ({ id, type = 'info', message, onClose, duration }) => {
  // Auto-dismiss after duration
  useEffect(() => {
    const defaultDuration = type === 'error' ? 5000 : 3000;
    const dismissTime = duration || defaultDuration;

    const timer = setTimeout(() => {
      onClose(id);
    }, dismissTime);

    return () => clearTimeout(timer);
  }, [id, type, duration, onClose]);

  // Handle manual dismiss
  const handleDismiss = () => {
    onClose(id);
  };

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Get styles based on type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-600',
          icon: <CheckCircle className="w-5 h-5" />,
          iconBg: 'bg-green-700'
        };
      case 'error':
        return {
          bg: 'bg-red-600',
          icon: <XCircle className="w-5 h-5" />,
          iconBg: 'bg-red-700'
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-600',
          icon: <Info className="w-5 h-5" />,
          iconBg: 'bg-blue-700'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`${styles.bg} text-white rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[320px] max-w-md w-full sm:w-auto animate-slide-in-right`}
    >
      {/* Icon */}
      <div className={`${styles.iconBg} rounded-full p-1 flex-shrink-0`}>
        {styles.icon}
      </div>

      {/* Message */}
      <div className="flex-1 pt-0.5">
        <p className="text-sm font-medium leading-tight">{message}</p>
      </div>

      {/* Close Button */}
      <button
        onClick={handleDismiss}
        aria-label="Close notification"
        className="flex-shrink-0 hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
        style={{ minWidth: '44px', minHeight: '44px' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Toast Container Component
 * Manages and displays multiple toast notifications
 */
export const ToastContainer = ({ toasts, onClose }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onClose={onClose}
            duration={toast.duration}
          />
        </div>
      ))}
    </div>
  );
};

export default Toast;
