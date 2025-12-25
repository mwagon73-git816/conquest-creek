import React, { useEffect } from 'react';
import { X, Trophy } from 'lucide-react';

/**
 * ChampionshipModal - Displays detailed Championship Weekend information
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 */
const ChampionshipModal = ({ isOpen, onClose }) => {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="relative bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Header with Close Button */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end z-10">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-all"
            title="Close (ESC)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-6 space-y-8">
          {/* Epic Battle Background - Full Color */}
          <div
            className="rounded-lg relative overflow-hidden min-h-[350px] sm:min-h-[450px]"
            style={{
              backgroundImage: 'url(/images/epic-tennis-battle.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
          </div>

          <hr className="border-gray-300 my-6" />

          {/* Qualifying for the Championship */}
          <section className="space-y-4">
            <h4 className="text-lg sm:text-xl font-bold text-blue-700 mb-4 pb-2 border-b-2 border-blue-200">
              Qualifying for the Championship
            </h4>

            <div className="space-y-4">
              {/* Top 2 Advance */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-bold text-gray-900 mb-2">Top 2 Advance</p>
                <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                  Based on total points (wins + bonuses). No minimum matches required, as bonuses
                  incentivize activity. Ties broken by comparing sets won, then if needed, games won.
                  If still tied, will look at team spirit points.
                </p>
              </div>

              {/* Merit-Based */}
              <div className="mt-4">
                <ul className="space-y-3">
                  <li className="flex gap-3 text-gray-700 text-sm sm:text-base">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <div>
                      <span className="font-bold">Merit-Based:</span> Focuses on well-rounded performance.
                    </div>
                  </li>
                  <li className="flex gap-3 text-gray-700 text-sm sm:text-base">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <div>
                      <span className="font-bold">Reasoning:</span> This ensures the strongest and spirited
                      teams advance, aligning with the tournament's goals of competition and community.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="border-gray-300" />

          {/* Championship Phase */}
          <section className="space-y-4">
            <div>
              <h4 className="text-lg sm:text-xl font-bold text-blue-700 mb-2 pb-2 border-blue-200">
                Championship Phase: Laver Cup Drama
              </h4>
              <p className="text-gray-600 text-sm sm:text-base font-semibold italic mt-2">
                February 7, 2026
              </p>
            </div>

            <div className="space-y-4">
              {/* Format Overview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-bold text-gray-900 mb-2">Single Day Showdown</p>
                <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                  Top 2 teams play a best-of-6 doubles series at varied levels (6.0–8.0).
                  First 3 matches: 1 point each; next 4: 2 points each. First to majority wins.
                  Use full rosters if possible, rotate players; on-court coaching applies.
                </p>
              </div>

              {/* Date/Time */}
              <div className="bg-green-50 border-l-4 border-green-400 p-4">
                <p className="font-bold text-gray-900 mb-1">When</p>
                <p className="text-gray-700 text-sm sm:text-base">
                  The Championship will be played on <span className="font-semibold">February 7, 2026</span>.
                </p>
              </div>

              {/* Match Schedule */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 sm:p-6 border border-blue-200">
                <h5 className="font-bold text-gray-900 text-base sm:text-lg mb-4 text-center">Match Schedule</h5>

                {/* Matches 1-3 */}
                <div className="mb-6">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="font-bold text-blue-700 mb-3 text-sm sm:text-base">Matches 1-3 (1 point each)</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                        <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                        <span>7.0 ladies doubles</span>
                      </li>
                      <li className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                        <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                        <span>6.0 mens doubles</span>
                      </li>
                      <li className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                        <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                        <span>7.0 mens doubles</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Matches 4-7 */}
                <div>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="font-bold text-purple-700 mb-3 text-sm sm:text-base">Matches 4-7 (2 points each)</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                        <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                        <span>7.0 mixed doubles</span>
                      </li>
                      <li className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                        <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                        <span>7.5 mens doubles</span>
                      </li>
                      <li className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                        <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">6</span>
                        <span>8.0 mens doubles</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Officiating */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-bold text-gray-900 mb-2">Officiating</p>
                <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                  The Championship matches will have a chair umpire and linespeople if possible.
                  The officials will only render a line-call decision if asked by the players.
                </p>
              </div>

              {/* Reasoning */}
              <div className="mt-4">
                <ul className="space-y-3">
                  <li className="flex gap-3 text-gray-700 text-sm sm:text-base">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <div>
                      <span className="font-bold">Reasoning:</span> The format builds tension like
                      professional events, while tying into the party maximizes attendance and fun,
                      ending the tournament on a high note.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="border-gray-300" />

          {/* Prizes and Perks */}
          <section className="space-y-4">
            <h4 className="text-lg sm:text-xl font-bold text-blue-700 mb-4 pb-2 border-b-2 border-blue-200">
              Prizes and Perks
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Trophy */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
                <div className="text-center mb-2">
                  <div className="text-3xl">🏆</div>
                </div>
                <p className="font-bold text-gray-900 text-center mb-2 text-sm sm:text-base">Trophy</p>
                <p className="text-gray-700 text-center text-xs sm:text-sm leading-relaxed">
                  One grand trophy for the winners
                </p>
              </div>

              {/* Awards */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="text-center mb-2">
                  <div className="text-3xl">🎖️</div>
                </div>
                <p className="font-bold text-gray-900 text-center mb-2 text-sm sm:text-base">Awards</p>
                <p className="text-gray-700 text-center text-xs sm:text-sm leading-relaxed">
                  "Most Active Team", "Team Spirit" honors
                </p>
              </div>

              {/* Finals Weekend */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="text-center mb-2">
                  <div className="text-3xl">🎾</div>
                </div>
                <p className="font-bold text-gray-900 text-center mb-2 text-sm sm:text-base">Finals Weekend</p>
                <p className="text-gray-700 text-center text-xs sm:text-sm leading-relaxed">
                  Courts reserved by Everett. Will include catering
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChampionshipModal;
