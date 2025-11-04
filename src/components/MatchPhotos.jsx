import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import TeamLogo from './TeamLogo';

const MatchPhotos = ({ photos, teams, isAuthenticated, onDeletePhoto }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (photos.length === 0 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % photos.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [photos.length, isPaused]);

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + photos.length) % photos.length);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % photos.length);
  };

  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  const handleDelete = () => {
    if (confirm('Delete this photo?')) {
      onDeletePhoto(currentPhoto.id);
    }
  };

  const getTeam = (teamId) => {
    return teams.find(t => t.id === teamId);
  };

  const getTeamName = (teamId) => {
    const team = getTeam(teamId);
    return team ? team.name : 'Unknown Team';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatMatchScore = (photo) => {
    const setScores = [];

    // Add Set 1
    if (photo.set1Team1 !== undefined && photo.set1Team2 !== undefined &&
        photo.set1Team1 !== '' && photo.set1Team2 !== '') {
      setScores.push(`${photo.set1Team1}-${photo.set1Team2}`);
    }

    // Add Set 2
    if (photo.set2Team1 !== undefined && photo.set2Team2 !== undefined &&
        photo.set2Team1 !== '' && photo.set2Team2 !== '') {
      setScores.push(`${photo.set2Team1}-${photo.set2Team2}`);
    }

    // Add Set 3 with tiebreaker notation if applicable
    if (photo.set3Team1 !== undefined && photo.set3Team2 !== undefined &&
        photo.set3Team1 !== '' && photo.set3Team2 !== '') {
      const set3Score = `${photo.set3Team1}-${photo.set3Team2}`;
      const tbNotation = photo.set3IsTiebreaker ? ' TB' : '';
      setScores.push(set3Score + tbNotation);
    }

    if (setScores.length === 0) return '';

    return `(${setScores.join(', ')})`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Photo Container */}
        <div className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] bg-gray-900 flex items-center justify-center">
          <img
            src={currentPhoto.imageData}
            alt="Match photo"
            className="max-w-full max-h-full object-contain transition-opacity duration-500"
          />

          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Delete Button (Directors Only) */}
          {isAuthenticated && (
            <button
              onClick={handleDelete}
              className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full transition-all"
              title="Delete photo"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Caption */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="flex justify-between items-start">
            <div>
              {currentPhoto.winner ? (
                <>
                  <div className="flex items-center gap-2 text-lg">
                    {currentPhoto.winner === 'team1' ? (
                      <>
                        <TeamLogo
                          team={getTeam(currentPhoto.team1Id)}
                          size="sm"
                          showBorder={!!getTeam(currentPhoto.team1Id)?.logo}
                        />
                        <span className="font-bold text-green-300">
                          {currentPhoto.team1Name || getTeamName(currentPhoto.team1Id)}
                        </span>
                        <span className="font-semibold"> def. </span>
                        <TeamLogo
                          team={getTeam(currentPhoto.team2Id)}
                          size="sm"
                          showBorder={!!getTeam(currentPhoto.team2Id)?.logo}
                        />
                        <span className="font-semibold">
                          {currentPhoto.team2Name || getTeamName(currentPhoto.team2Id)}
                        </span>
                      </>
                    ) : (
                      <>
                        <TeamLogo
                          team={getTeam(currentPhoto.team2Id)}
                          size="sm"
                          showBorder={!!getTeam(currentPhoto.team2Id)?.logo}
                        />
                        <span className="font-bold text-green-300">
                          {currentPhoto.team2Name || getTeamName(currentPhoto.team2Id)}
                        </span>
                        <span className="font-semibold"> def. </span>
                        <TeamLogo
                          team={getTeam(currentPhoto.team1Id)}
                          size="sm"
                          showBorder={!!getTeam(currentPhoto.team1Id)?.logo}
                        />
                        <span className="font-semibold">
                          {currentPhoto.team1Name || getTeamName(currentPhoto.team1Id)}
                        </span>
                      </>
                    )}
                    {formatMatchScore(currentPhoto) && (
                      <span className="font-semibold text-blue-100"> {formatMatchScore(currentPhoto)}</span>
                    )}
                  </div>
                  <p className="text-sm text-blue-100 mt-1">
                    {formatDate(currentPhoto.matchDate)}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 font-semibold text-lg">
                    <TeamLogo
                      team={getTeam(currentPhoto.team1Id)}
                      size="sm"
                      showBorder={!!getTeam(currentPhoto.team1Id)?.logo}
                    />
                    <span>{currentPhoto.team1Name || getTeamName(currentPhoto.team1Id)}</span>
                    <span>vs</span>
                    <TeamLogo
                      team={getTeam(currentPhoto.team2Id)}
                      size="sm"
                      showBorder={!!getTeam(currentPhoto.team2Id)?.logo}
                    />
                    <span>{currentPhoto.team2Name || getTeamName(currentPhoto.team2Id)}</span>
                  </div>
                  <p className="text-sm text-blue-100 mt-1">
                    {formatDate(currentPhoto.matchDate)}
                  </p>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <p className="text-sm text-blue-200">
                {currentIndex + 1} / {photos.length}
              </p>
            )}
          </div>
        </div>

        {/* Navigation Dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-24 md:bottom-28 lg:bottom-32 left-1/2 -translate-x-1/2 flex gap-2 bg-black bg-opacity-50 px-3 py-2 rounded-full">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-white w-6'
                    : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                }`}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchPhotos;
