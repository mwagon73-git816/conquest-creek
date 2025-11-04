import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * LogoPreviewModal - Full-screen modal for previewing team logos
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {string} props.logoUrl - Logo image URL (base64)
 * @param {string} props.teamName - Team name for alt text
 */
const LogoPreviewModal = ({ isOpen, onClose, logoUrl, teamName }) => {
  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Handle ESC key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-2 transition-all z-10"
        title="Close preview (ESC)"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image container */}
      <div
        className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image
      >
        <img
          src={logoUrl}
          alt={`${teamName} logo (full size)`}
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
};

export default LogoPreviewModal;
