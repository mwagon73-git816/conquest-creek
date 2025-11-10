import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, ChevronLeft, ChevronRight, Trash2, Image as ImageIcon, Filter } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import { imageStorage } from '../services/storage';

const MediaGallery = ({
  photos,
  teams,
  isAuthenticated,
  userRole,
  onAddPhoto,
  onDeletePhoto,
  maxPhotos = 50
}) => {
  // State for upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadTeam1Id, setUploadTeam1Id] = useState('');
  const [uploadTeam2Id, setUploadTeam2Id] = useState('');
  const [uploadDate, setUploadDate] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // State for lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // State for filtering and sorting
  const [sortBy, setSortBy] = useState('newest'); // 'newest' or 'oldest'
  const [filterTeam, setFilterTeam] = useState(''); // team ID or empty for all
  const [showFilters, setShowFilters] = useState(false);

  // Ref for file input
  const fileInputRef = useRef(null);

  // Calculate sorted and filtered photos
  const getFilteredPhotos = () => {
    let filtered = [...photos];

    // Filter by team
    if (filterTeam) {
      filtered = filtered.filter(photo =>
        photo.team1Id === filterTeam || photo.team2Id === filterTeam
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.uploadTimestamp || a.matchDate);
      const dateB = new Date(b.uploadTimestamp || b.matchDate);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  const filteredPhotos = getFilteredPhotos();

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        handleLightboxPrev();
      } else if (e.key === 'ArrowRight') {
        handleLightboxNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, lightboxIndex, filteredPhotos.length]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a JPG, JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size (5 MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('File size must be less than 5 MB');
      return;
    }

    setUploadFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Resize and compress image
  const processImage = (imageDataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions (max 1920x1080)
        let width = img.width;
        let height = img.height;
        const maxWidth = 1920;
        const maxHeight = 1080;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to target 300-500KB
        let quality = 0.9;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Iteratively reduce quality if needed
        while (compressedDataUrl.length > 500 * 1024 * 1.37 && quality > 0.5) {
          quality -= 0.05;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressedDataUrl);
      };
      img.src = imageDataUrl;
    });
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile) return;

    setIsProcessing(true);
    setUploadError('');

    try {
      // Process image
      const processedImage = await processImage(uploadPreview);

      // Generate unique photo ID and storage path
      const photoId = Date.now().toString();
      const storagePath = `photos/${photoId}.jpg`;

      // Upload to Firebase Storage
      const imageUrl = await imageStorage.uploadImage(processedImage, storagePath);

      // Create photo object with URL instead of base64
      const newPhoto = {
        id: photoId,
        imageUrl: imageUrl, // Store download URL instead of base64
        storagePath: storagePath, // Store path for deletion
        caption: uploadCaption.trim() || null,
        team1Id: uploadTeam1Id || null,
        team2Id: uploadTeam2Id || null,
        team1Name: uploadTeam1Id ? getTeamName(uploadTeam1Id) : null,
        team2Name: uploadTeam2Id ? getTeamName(uploadTeam2Id) : null,
        matchDate: uploadDate || new Date().toISOString().split('T')[0],
        uploadTimestamp: new Date().toISOString(),
        winner: null, // No winner for gallery photos
        // Empty set scores for non-match photos
        set1Team1: '',
        set1Team2: '',
        set2Team1: '',
        set2Team2: '',
        set3Team1: '',
        set3Team2: '',
        set3IsTiebreaker: false
      };

      // Add photo
      await onAddPhoto(newPhoto);

      // Reset form
      handleCloseUploadModal();
    } catch (error) {
      setUploadError('Error uploading image. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset upload modal
  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadPreview('');
    setUploadCaption('');
    setUploadTeam1Id('');
    setUploadTeam2Id('');
    setUploadDate('');
    setUploadError('');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open lightbox
  const handleOpenLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Lightbox navigation
  const handleLightboxPrev = () => {
    setLightboxIndex((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  const handleLightboxNext = () => {
    setLightboxIndex((prev) => (prev + 1) % filteredPhotos.length);
  };

  // Delete photo
  const handleDelete = async (photoId) => {
    const photo = photos.find(p => p.id === photoId);
    const photoInfo = getPhotoInfo(photo);

    if (confirm(`Delete this photo?\n\n"${photoInfo}"\n\nThis will permanently remove it from the gallery and cannot be undone.`)) {
      try {
        // Delete from Firebase Storage if it has a storage path
        if (photo?.storagePath) {
          await imageStorage.deleteImage(photo.storagePath);
        }

        // Delete from database (this will also log the deletion)
        onDeletePhoto(photoId);
        setLightboxOpen(false);

        // Show success message
        alert('✅ Photo deleted successfully.');
      } catch (error) {
        console.error('Error deleting photo:', error);
        alert('❌ Error deleting photo. Please try again.');
      }
    }
  };

  // Get team name
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  // Get photo display info
  const getPhotoInfo = (photo) => {
    // If has match data, show match caption
    if (photo.team1Id && photo.team2Id) {
      const team1 = photo.team1Name || getTeamName(photo.team1Id);
      const team2 = photo.team2Name || getTeamName(photo.team2Id);
      return `${team1} vs ${team2}`;
    }

    // If has custom caption, show that
    if (photo.caption) {
      return photo.caption;
    }

    // Default
    return 'Match Photo';
  };

  // Touch handlers for swipe on mobile
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleLightboxNext();
    } else if (isRightSwipe) {
      handleLightboxPrev();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  // Can upload (directors or captains)
  const canUpload = isAuthenticated && (userRole === 'director' || userRole === 'captain');

  // Can delete (directors only)
  const canDelete = isAuthenticated && userRole === 'director';

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Media Gallery</h2>
            <p className="text-blue-100">Browse all match photos and moments</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Storage info */}
            <div className="text-sm text-blue-100 text-right">
              <div className="font-semibold">{photos.length} of {maxPhotos} photos</div>
              <div className="text-xs">
                {photos.length >= maxPhotos ? 'Storage full' : `${maxPhotos - photos.length} remaining`}
              </div>
            </div>
            {/* Upload button */}
            {canUpload && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Upload Photo
              </button>
            )}
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded text-sm flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>

          {showFilters && (
            <>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-blue-700 text-white px-3 py-1 rounded text-sm border border-blue-500 focus:outline-none focus:border-blue-300"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>

              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="bg-blue-700 text-white px-3 py-1 rounded text-sm border border-blue-500 focus:outline-none focus:border-blue-300"
              >
                <option value="">All Teams</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>

              {(filterTeam || sortBy !== 'newest') && (
                <button
                  onClick={() => {
                    setSortBy('newest');
                    setFilterTeam('');
                  }}
                  className="text-blue-100 hover:text-white text-sm underline"
                >
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Photo Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            {photos.length === 0 ? 'No photos yet' : 'No photos match your filters'}
          </h3>
          <p className="text-gray-500">
            {photos.length === 0
              ? canUpload
                ? 'Upload your first match photo to get started'
                : 'Photos will appear here when uploaded by directors or captains'
              : 'Try adjusting your filters to see more photos'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.map((photo, index) => (
            <div
              key={photo.id}
              className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform transition-all hover:scale-105 hover:shadow-xl"
              onClick={() => handleOpenLightbox(index)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-gray-900 group">
                <img
                  src={photo.imageUrl || photo.imageData}
                  alt={getPhotoInfo(photo)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Delete Button (Directors Only) */}
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo.id);
                    }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Delete photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Caption */}
              <div className="p-3">
                <p className="font-semibold text-sm text-gray-800 truncate">
                  {getPhotoInfo(photo)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(photo.uploadTimestamp || photo.matchDate)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">Upload Photo</h3>
              <button
                onClick={handleCloseUploadModal}
                className="text-gray-500 hover:text-gray-700"
                disabled={isProcessing}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* File Input */}
              {!uploadPreview ? (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Photo *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, JPEG, PNG, or WebP. Max 5 MB. Will be resized to 1920x1080 if larger.
                  </p>
                </div>
              ) : (
                <>
                  {/* Preview */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Preview
                    </label>
                    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                      <img
                        src={uploadPreview}
                        alt="Preview"
                        className="w-full h-64 object-contain"
                      />
                      <button
                        onClick={() => {
                          setUploadFile(null);
                          setUploadPreview('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                        disabled={isProcessing}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Caption / Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={uploadCaption}
                      onChange={(e) => setUploadCaption(e.target.value)}
                      placeholder="e.g., Championship finals, Team celebration..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isProcessing}
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If left blank, will show team names or "Match Photo"
                    </p>
                  </div>

                  {/* Teams */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Team 1 (Optional)
                      </label>
                      <select
                        value={uploadTeam1Id}
                        onChange={(e) => setUploadTeam1Id(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isProcessing}
                      >
                        <option value="">Select team...</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Team 2 (Optional)
                      </label>
                      <select
                        value={uploadTeam2Id}
                        onChange={(e) => setUploadTeam2Id(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isProcessing}
                      >
                        <option value="">Select team...</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Match Date */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Match Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isProcessing}
                    />
                  </div>
                </>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {uploadError}
                </div>
              )}

              {/* Storage Warning */}
              {photos.length >= maxPhotos && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  Storage limit reached. Uploading will remove the oldest photo.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={handleCloseUploadModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && filteredPhotos.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50"
          onClick={() => setLightboxOpen(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close Button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Delete Button (Directors Only) */}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(filteredPhotos[lightboxIndex].id);
              }}
              className="absolute top-4 right-16 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full z-10"
              title="Delete photo"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          {/* Main Content */}
          <div
            className="w-full h-full flex flex-col items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Container */}
            <div className="relative w-full max-w-6xl flex-1 flex items-center justify-center">
              <img
                src={filteredPhotos[lightboxIndex].imageUrl || filteredPhotos[lightboxIndex].imageData}
                alt={getPhotoInfo(filteredPhotos[lightboxIndex])}
                className="max-w-full max-h-full object-contain"
              />

              {/* Navigation Arrows */}
              {filteredPhotos.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLightboxPrev();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLightboxNext();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </button>
                </>
              )}
            </div>

            {/* Photo Info */}
            <div className="w-full max-w-6xl mt-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-lg font-semibold">
                    {getPhotoInfo(filteredPhotos[lightboxIndex])}
                  </p>
                  <p className="text-sm text-gray-300 mt-1">
                    {formatDate(filteredPhotos[lightboxIndex].uploadTimestamp || filteredPhotos[lightboxIndex].matchDate)}
                  </p>
                </div>
                {filteredPhotos.length > 1 && (
                  <p className="text-sm text-gray-300">
                    {lightboxIndex + 1} / {filteredPhotos.length}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
