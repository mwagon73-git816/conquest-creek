import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, X, Upload, Image as ImageIcon, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { ACTION_TYPES } from '../services/activityLogger';
import { formatNTRP, formatDynamic, formatDate } from '../utils/formatters';
import { tournamentStorage } from '../services/storage';

const MatchEntry = ({ teams, matches, setMatches, challenges, onChallengesChange, isAuthenticated, setActiveTab, players, captains, onAddPhoto, loginName, userRole, userTeamId, editingMatch, setEditingMatch, addLog }) => {
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [matchFormData, setMatchFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    level: '7.0',
    team1Id: '',
    team2Id: '',
    set1Team1: '',
    set1Team2: '',
    set2Team1: '',
    set2Team2: '',
    set3Team1: '',
    set3Team2: '',
    set3IsTiebreaker: false,
    team1Players: [],
    team2Players: [],
    notes: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [allowPlayerEdit, setAllowPlayerEdit] = useState(false);

  // Pre-populate form when editing a match
  useEffect(() => {
    if (editingMatch) {
      // Skip this effect for pending matches - they're handled in handleEnterPendingResults
      if (editingMatch.isPendingMatch) {
        return;
      }

      setMatchFormData({
        date: editingMatch.date || new Date().toISOString().split('T')[0],
        level: editingMatch.level || '7.0',
        team1Id: editingMatch.team1Id ? editingMatch.team1Id.toString() : '',
        team2Id: editingMatch.team2Id ? editingMatch.team2Id.toString() : '',
        set1Team1: editingMatch.set1Team1 || '',
        set1Team2: editingMatch.set1Team2 || '',
        set2Team1: editingMatch.set2Team1 || '',
        set2Team2: editingMatch.set2Team2 || '',
        set3Team1: editingMatch.set3Team1 || '',
        set3Team2: editingMatch.set3Team2 || '',
        set3IsTiebreaker: editingMatch.set3IsTiebreaker || false,
        team1Players: editingMatch.team1Players || [],
        team2Players: editingMatch.team2Players || [],
        notes: editingMatch.notes || ''
      });
      setShowMatchForm(true);
    }
  }, [editingMatch]);

  // Debug: Track form data changes
  useEffect(() => {
    console.log('🔄 Form Data Changed:', matchFormData);
    console.log('   Team 1 ID:', matchFormData.team1Id);
    console.log('   Team 2 ID:', matchFormData.team2Id);
    console.log('   Team 1 Players:', matchFormData.team1Players);
    console.log('   Team 2 Players:', matchFormData.team2Players);
  }, [matchFormData]);

  // Calculate match results from set scores
  const calculateMatchResults = () => {
    const { set1Team1, set1Team2, set2Team1, set2Team2, set3Team1, set3Team2, set3IsTiebreaker } = matchFormData;

    // Convert to numbers
    const s1t1 = parseInt(set1Team1) || 0;
    const s1t2 = parseInt(set1Team2) || 0;
    const s2t1 = parseInt(set2Team1) || 0;
    const s2t2 = parseInt(set2Team2) || 0;
    const s3t1 = parseInt(set3Team1) || 0;
    const s3t2 = parseInt(set3Team2) || 0;

    // Determine set winners
    const set1Winner = s1t1 > s1t2 ? 1 : (s1t2 > s1t1 ? 2 : 0);
    const set2Winner = s2t1 > s2t2 ? 1 : (s2t2 > s2t1 ? 2 : 0);
    const set3Winner = s3t1 > s3t2 ? 1 : (s3t2 > s3t1 ? 2 : 0);

    // Count sets won
    let team1Sets = 0;
    let team2Sets = 0;
    if (set1Winner === 1) team1Sets++;
    if (set1Winner === 2) team2Sets++;
    if (set2Winner === 1) team1Sets++;
    if (set2Winner === 2) team2Sets++;
    if (set3Winner === 1) team1Sets++;
    if (set3Winner === 2) team2Sets++;

    // Calculate games won
    let team1Games = s1t1 + s2t1;
    let team2Games = s1t2 + s2t2;

    // Add set 3 games
    if (set3Team1 !== '' && set3Team2 !== '') {
      if (set3IsTiebreaker) {
        // 10-point tiebreaker: count actual tiebreaker points
        // e.g., 10-7 = 10 games for team1, 7 games for team2
        team1Games += s3t1;
        team2Games += s3t2;
      } else {
        // Regular set: count actual games
        team1Games += s3t1;
        team2Games += s3t2;
      }
    }

    // Determine match winner
    let winner = '';
    if (team1Sets > team2Sets) {
      winner = 'team1';
    } else if (team2Sets > team1Sets) {
      winner = 'team2';
    }

    return {
      winner,
      team1Sets: team1Sets.toString(),
      team2Sets: team2Sets.toString(),
      team1Games: team1Games.toString(),
      team2Games: team2Games.toString(),
      isValid: set1Winner !== 0 && set2Winner !== 0 && winner !== ''
    };
  };

  const getMatchResultsDisplay = () => {
    const results = calculateMatchResults();
    if (!results.isValid) return null;

    const team1Name = teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1';
    const team2Name = teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2';
    const winnerName = results.winner === 'team1' ? team1Name : team2Name;

    const setScores = [];
    if (matchFormData.set1Team1 && matchFormData.set1Team2) {
      setScores.push(`${matchFormData.set1Team1}-${matchFormData.set1Team2}`);
    }
    if (matchFormData.set2Team1 && matchFormData.set2Team2) {
      setScores.push(`${matchFormData.set2Team1}-${matchFormData.set2Team2}`);
    }
    if (matchFormData.set3Team1 && matchFormData.set3Team2) {
      const set3Label = matchFormData.set3IsTiebreaker ? ' (TB)' : '';
      setScores.push(`${matchFormData.set3Team1}-${matchFormData.set3Team2}${set3Label}`);
    }

    return {
      winnerName,
      setScores: setScores.join(', '),
      team1Sets: results.team1Sets,
      team2Sets: results.team2Sets
    };
  };

  const sendMatchNotifications = async (matchData, isEditing = false) => {
    // Send emails if captain is entering or editing a match
    if (userRole !== 'captain' || !captains) {
      return { success: true, message: '' };
    }

    try {
      // Find opponent team ID (the team that's not the captain's team)
      const opponentTeamId = matchData.team1Id === userTeamId ? matchData.team2Id : matchData.team1Id;

      // Find both captains
      const enteringCaptain = captains.find(c =>
        c.teamId === userTeamId &&
        c.status === 'active' &&
        c.email
      );

      const opponentCaptain = captains.find(c =>
        c.teamId === opponentTeamId &&
        c.status === 'active' &&
        c.email
      );

      // Get team names
      const senderTeam = teams.find(t => t.id === userTeamId)?.name || 'Unknown Team';
      const recipientTeam = teams.find(t => t.id === opponentTeamId)?.name || 'Unknown Team';

      // Format match scores
      const setScores = [];
      if (matchData.set1Team1 && matchData.set1Team2) {
        setScores.push(`${matchData.set1Team1}-${matchData.set1Team2}`);
      }
      if (matchData.set2Team1 && matchData.set2Team2) {
        setScores.push(`${matchData.set2Team1}-${matchData.set2Team2}`);
      }
      if (matchData.set3Team1 && matchData.set3Team2) {
        const tbLabel = matchData.set3IsTiebreaker ? ' (TB)' : '';
        setScores.push(`${matchData.set3Team1}-${matchData.set3Team2}${tbLabel}`);
      }
      const matchScores = setScores.join(', ');

      let emailsSent = 0;
      let emailsFailed = 0;

      // Determine email type based on whether we're editing
      const emailType = isEditing ? 'edit' : 'confirmation';
      const emailTypeVerify = isEditing ? 'edit' : 'verification';

      // Send email to entering captain (confirmation or edit notification)
      if (enteringCaptain) {
        try {
          const confirmResponse = await fetch('/.netlify/functions/send-match-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipientEmail: enteringCaptain.email,
              recipientName: enteringCaptain.name,
              senderTeam: senderTeam,
              recipientTeam: recipientTeam,
              matchScores: matchScores,
              matchDate: matchData.date,
              matchLevel: matchData.level,
              emailType: emailType,
              editorName: loginName
            })
          });

          if (confirmResponse.ok) {
            console.log(`${isEditing ? 'Edit' : 'Confirmation'} email sent to entering captain`);
            emailsSent++;
          } else {
            console.error(`Failed to send ${isEditing ? 'edit' : 'confirmation'} email:`, await confirmResponse.text());
            emailsFailed++;
          }
        } catch (error) {
          console.error(`Error sending ${isEditing ? 'edit' : 'confirmation'} email:`, error);
          emailsFailed++;
        }
      }

      // Send email to opponent captain (verification or edit notification)
      if (opponentCaptain) {
        try {
          const verifyResponse = await fetch('/.netlify/functions/send-match-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipientEmail: opponentCaptain.email,
              recipientName: opponentCaptain.name,
              senderTeam: senderTeam,
              recipientTeam: recipientTeam,
              matchScores: matchScores,
              matchDate: matchData.date,
              matchLevel: matchData.level,
              emailType: emailTypeVerify,
              editorName: loginName
            })
          });

          if (verifyResponse.ok) {
            console.log(`${isEditing ? 'Edit' : 'Verification'} email sent to opponent captain`);
            emailsSent++;
          } else {
            console.error(`Failed to send ${isEditing ? 'edit' : 'verification'} email:`, await verifyResponse.text());
            emailsFailed++;
          }
        } catch (error) {
          console.error(`Error sending ${isEditing ? 'edit' : 'verification'} email:`, error);
          emailsFailed++;
        }
      }

      // Return results
      if (emailsSent === 2) {
        const message = isEditing
          ? 'Match updated. Notification emails sent to both captains.'
          : 'Match saved. Confirmation emails sent to both captains.';
        return { success: true, message };
      } else if (emailsSent > 0) {
        const message = isEditing
          ? 'Match updated but some email notifications failed.'
          : 'Match saved but some email notifications failed.';
        return { success: true, message };
      } else if (emailsFailed > 0) {
        const message = isEditing
          ? 'Match updated but email notifications failed.'
          : 'Match saved but email notifications failed.';
        return { success: false, message };
      } else {
        const message = isEditing
          ? 'Match updated. No captains with emails found.'
          : 'Match saved. No captains with emails found.';
        return { success: true, message };
      }

    } catch (error) {
      console.error('Error sending match notifications:', error);
      return { success: false, message: 'Match saved but email notifications failed.' };
    }
  };

  const handleSaveMatch = async () => {
    if (!matchFormData.team1Id || !matchFormData.team2Id) {
      alert('⚠️ Please select both teams.');
      return;
    }
    if (matchFormData.team1Id === matchFormData.team2Id) {
      alert('⚠️ Teams must be different.');
      return;
    }

    // Validate set scores
    const results = calculateMatchResults();
    if (!results.isValid) {
      alert('⚠️ Please enter valid set scores.\n\nYou must enter scores for at least 2 sets with clear winners.');
      return;
    }

    // Determine if this is a pending match or a regular edit
    const isPendingMatch = editingMatch && editingMatch.isPendingMatch;

    // RACE CONDITION PROTECTION: For pending matches, verify challenge is still accepted
    if (isPendingMatch) {
      try {
        console.log('🔍 Verifying pending match challenge status...');
        const latestChallengesData = await tournamentStorage.getChallenges();

        if (latestChallengesData) {
          const latestChallenges = JSON.parse(latestChallengesData.data);
          const latestChallenge = latestChallenges.find(c => c.id === editingMatch.id);

          // Check if challenge still exists
          if (!latestChallenge) {
            alert('⚠️ Challenge Not Found!\n\nThis pending match challenge has been deleted by another user.\n\nPlease refresh the page to see current pending matches.');
            setShowMatchForm(false);
            setEditingMatch(null);
            return;
          }

          // Check if challenge has already been completed
          if (latestChallenge.status === 'completed') {
            const completedBy = latestChallenge.completedBy || 'another captain';
            alert(`⚠️ Match Already Entered!\n\nThis match has already been entered by ${completedBy}.\n\nPlease refresh the page to see current pending matches.`);
            setShowMatchForm(false);
            setEditingMatch(null);
            return;
          }

          // Check if challenge is no longer accepted (reverted to open)
          if (latestChallenge.status !== 'accepted') {
            alert(`⚠️ Challenge Status Changed!\n\nThis challenge is no longer accepted (status: ${latestChallenge.status}).\n\nPlease refresh the page to see current challenges.`);
            setShowMatchForm(false);
            setEditingMatch(null);
            return;
          }

          console.log('✅ Challenge is still accepted, proceeding with match entry');
        }
      } catch (error) {
        console.error('Error checking challenge status:', error);
        alert('⚠️ Error verifying challenge status.\n\nPlease try again or refresh the page.');
        return;
      }
    }

    // For pending matches, generate a NEW match ID. For edits, use existing ID.
    const matchId = (editingMatch && !isPendingMatch) ? editingMatch.id : Date.now();

    const matchData = {
      date: matchFormData.date,
      level: matchFormData.level,
      team1Id: parseInt(matchFormData.team1Id),
      team2Id: parseInt(matchFormData.team2Id),
      winner: results.winner,
      team1Sets: results.team1Sets,
      team2Sets: results.team2Sets,
      team1Games: results.team1Games,
      team2Games: results.team2Games,
      set1Team1: matchFormData.set1Team1,
      set1Team2: matchFormData.set1Team2,
      set2Team1: matchFormData.set2Team1,
      set2Team2: matchFormData.set2Team2,
      set3Team1: matchFormData.set3Team1,
      set3Team2: matchFormData.set3Team2,
      set3IsTiebreaker: matchFormData.set3IsTiebreaker,
      team1Players: matchFormData.team1Players,
      team2Players: matchFormData.team2Players,
      notes: matchFormData.notes.trim(),
      timestamp: new Date().toISOString(),
      fromChallenge: isPendingMatch // Flag to indicate this came from a challenge
    };

    // Debug: Log match save information
    console.log('=== Match Save Debug ===');
    console.log('Is Pending Match:', isPendingMatch);
    console.log('Match ID:', matchId);
    console.log('Team 1 ID:', matchData.team1Id, '(type:', typeof matchData.team1Id, ')');
    console.log('Team 2 ID:', matchData.team2Id, '(type:', typeof matchData.team2Id, ')');
    console.log('Team 1 Players:', matchData.team1Players);
    console.log('Team 2 Players:', matchData.team2Players);
    console.log('Set 3 Team 1 Score:', matchFormData.set3Team1);
    console.log('Set 3 Team 2 Score:', matchFormData.set3Team2);
    console.log('Set 3 Is Tiebreaker:', matchFormData.set3IsTiebreaker);
    console.log('Total Team 1 Sets:', results.team1Sets);
    console.log('Total Team 2 Sets:', results.team2Sets);
    console.log('Total Team 1 Games:', results.team1Games);
    console.log('Total Team 2 Games:', results.team2Games);
    console.log('Winner:', results.winner);
    console.log('Match Data to Save:', matchData);
    console.log('=======================');

    // For pending matches or new matches, ADD to array. For edits, UPDATE existing.
    if (editingMatch && !isPendingMatch) {
      // This is editing an existing match
      console.log('📝 Updating existing match with ID:', editingMatch.id);
      setMatches(matches.map(m =>
        m.id === editingMatch.id
          ? {...m, ...matchData}
          : m
      ));
    } else {
      // This is a new match (either from "Add Match" or from pending challenge)
      console.log('➕ Creating new match with ID:', matchId);
      console.log('Current matches count:', matches.length);
      const newMatch = {
        id: matchId,
        ...matchData
      };
      const updatedMatches = [...matches, newMatch];
      setMatches(updatedMatches);
      console.log('Updated matches count:', updatedMatches.length);
      console.log('✅ Match added to array');
    }

    // Handle photo upload if present
    if (photoFile && photoPreview && onAddPhoto) {
      // Get team names for display
      const team1 = teams.find(t => t.id === parseInt(matchFormData.team1Id));
      const team2 = teams.find(t => t.id === parseInt(matchFormData.team2Id));

      const photoData = {
        id: Date.now() + Math.random(), // Unique ID for photo
        matchId: matchId,
        imageData: photoPreview,
        team1Id: parseInt(matchFormData.team1Id),
        team2Id: parseInt(matchFormData.team2Id),
        team1Name: team1 ? team1.name : 'Team 1',
        team2Name: team2 ? team2.name : 'Team 2',
        matchDate: matchFormData.date,
        uploaderName: loginName,
        uploadTimestamp: new Date().toISOString(),
        // Store all match scoring details
        winner: results.winner,
        set1Team1: matchFormData.set1Team1,
        set1Team2: matchFormData.set1Team2,
        set2Team1: matchFormData.set2Team1,
        set2Team2: matchFormData.set2Team2,
        set3Team1: matchFormData.set3Team1,
        set3Team2: matchFormData.set3Team2,
        set3IsTiebreaker: matchFormData.set3IsTiebreaker
      };
      onAddPhoto(photoData);
    }

    // Send email notifications if captain
    // For pending matches being entered, treat as new (not edit)
    const isEditForEmail = editingMatch && !isPendingMatch;
    const emailResult = await sendMatchNotifications(matchData, isEditForEmail);

    // If this was from a pending match (challenge), remove it from challenges array
    if (isPendingMatch && challenges && onChallengesChange) {
      console.log('=== REMOVING CHALLENGE AFTER MATCH ENTRY ===');
      console.log('Before removal - Total challenges:', challenges.length);
      console.log('Challenge IDs before:', challenges.map(c => ({ id: c.id, status: c.status })));
      console.log('Challenge to remove ID:', editingMatch.id);
      console.log('Match ID created:', matchId);

      // OPTION 1: Mark as completed (preserves history)
      const updatedChallenges = challenges.map(c => {
        if (c.id === editingMatch.id) {
          return {
            ...c,
            status: 'completed',
            matchId: matchId,
            completedAt: new Date().toISOString(),
            completedBy: loginName || 'Unknown'
          };
        }
        return c;
      });

      // OPTION 2: Remove entirely (cleaner, no history)
      // Uncomment this line and comment out the above if you want to remove instead of mark completed
      // const updatedChallenges = challenges.filter(c => c.id !== editingMatch.id);

      onChallengesChange(updatedChallenges);

      console.log('After update - Total challenges:', updatedChallenges.length);
      console.log('Challenge IDs after:', updatedChallenges.map(c => ({ id: c.id, status: c.status })));
      console.log('Challenge removed from pending?', !updatedChallenges.find(c => c.id === editingMatch.id && c.status === 'accepted'));
      console.log('✅ Challenge marked as completed');
      console.log('==========================================');

      // Add to activity log if available
      if (addLog) {
        const team1Name = teams.find(t => t.id === matchData.team1Id)?.name || 'Team 1';
        const team2Name = teams.find(t => t.id === matchData.team2Id)?.name || 'Team 2';
        await addLog(
          ACTION_TYPES.MATCH_CREATED,
          {
            matchId: matchId,
            teams: `${team1Name} vs ${team2Name}`,
            fromChallenge: true
          },
          matchId
        );
      }
    }

    // Show appropriate success message with SAVE DATA reminder
    if (isPendingMatch) {
      alert(
        '✅ Match results saved successfully!\n\n' +
        '⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.\n\n' +
        'Your changes will be lost if you close the browser without saving.'
      );
    } else if (userRole === 'captain' && emailResult.message) {
      alert(
        emailResult.message + '\n\n' +
        '⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.'
      );
    } else if (!editingMatch) {
      alert(
        '✅ Match saved successfully!\n\n' +
        '⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.'
      );
    }

    // Final verification
    console.log('=== Match Save Complete ===');
    console.log('Match ID:', matchId);
    console.log('Match saved as:', isPendingMatch ? 'NEW from challenge' : (editingMatch ? 'EDITED existing' : 'NEW'));
    if (isPendingMatch) {
      console.log('Challenge marked as completed');
    }
    console.log('Don\'t forget to click "Save Data" to persist to Firebase!');
    console.log('==========================');

    setShowMatchForm(false);
    setEditingMatch(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAllowPlayerEdit(false);

    // Reset form data after modal closes (delay to allow animation)
    setTimeout(() => {
      setMatchFormData({
        date: new Date().toISOString().split('T')[0],
        level: '7.0',
        team1Id: '',
        team2Id: '',
        set1Team1: '',
        set1Team2: '',
        set2Team1: '',
        set2Team2: '',
        set3Team1: '',
        set3Team2: '',
        set3IsTiebreaker: false,
        team1Players: [],
        team2Players: [],
        notes: ''
      });
    }, 300);
  };

  const handleAddNewMatch = () => {
    setShowMatchForm(true);
    setEditingMatch(null);
    setMatchFormData({
      date: new Date().toISOString().split('T')[0],
      level: '7.0',
      team1Id: userRole === 'captain' && userTeamId ? userTeamId.toString() : '', // Auto-select captain's team
      team2Id: '',
      set1Team1: '',
      set1Team2: '',
      set2Team1: '',
      set2Team2: '',
      set3Team1: '',
      set3Team2: '',
      set3IsTiebreaker: false,
      team1Players: [],
      team2Players: [],
      notes: ''
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setAllowPlayerEdit(false);
  };

  const getTeamPlayers = (teamId) => {
    if (!teamId || !players) return [];
    return players.filter(p => p.teamId === parseInt(teamId) && p.status === 'active');
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('⚠️ Invalid file type.\n\nPlease upload an image file (PNG, JPG, or WEBP).');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('⚠️ File size exceeds 5MB limit.\n\nPlease select a smaller image file.');
      return;
    }

    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePlayerToggle = (playerId, teamNumber) => {
    const field = teamNumber === 1 ? 'team1Players' : 'team2Players';
    const currentPlayers = matchFormData[field];

    if (currentPlayers.includes(playerId)) {
      setMatchFormData({
        ...matchFormData,
        [field]: currentPlayers.filter(id => id !== playerId)
      });
    } else {
      setMatchFormData({
        ...matchFormData,
        [field]: [...currentPlayers, playerId]
      });
    }
  };

  const team1Players = getTeamPlayers(matchFormData.team1Id);
  const team2Players = getTeamPlayers(matchFormData.team2Id);

  // Get pending matches from accepted challenges
  const getPendingMatches = () => {
    if (!challenges) return [];
    if (!isAuthenticated) return [];

    const accepted = challenges.filter(c => c.status === 'accepted');

    if (userRole === 'director') {
      return accepted;
    }

    if (userRole === 'captain') {
      return accepted.filter(c =>
        c.challengerTeamId === userTeamId || c.challengedTeamId === userTeamId
      );
    }

    return [];
  };

  // Check if user can enter results for a pending match
  const canEnterResults = (pendingMatch) => {
    if (!isAuthenticated) return false;
    if (userRole === 'director') return true;
    if (userRole === 'captain' && userTeamId) {
      return pendingMatch.challengerTeamId === userTeamId ||
             pendingMatch.challengedTeamId === userTeamId;
    }
    return false;
  };

  // Handle entering results for a pending match
  const handleEnterPendingResults = (pendingMatch) => {
    console.log('=== ENTERING PENDING MATCH RESULTS ===');
    console.log('Pending Match:', pendingMatch);
    console.log('Challenging Team ID:', pendingMatch?.challengerTeamId);
    console.log('Challenged Team ID:', pendingMatch?.challengedTeamId);
    console.log('Challenging Players:', pendingMatch?.challengerPlayers);
    console.log('Challenged Players:', pendingMatch?.challengedPlayers);
    console.log('All Teams:', teams);
    console.log('All Players:', players);

    // Find the team objects
    const team1 = teams.find(t => t.id === pendingMatch.challengerTeamId);
    const team2 = teams.find(t => t.id === pendingMatch.challengedTeamId);
    console.log('Found Team 1:', team1);
    console.log('Found Team 2:', team2);

    // Verify player IDs exist in players array
    if (pendingMatch.challengerPlayers) {
      console.log('Team 1 Player Lookup:');
      pendingMatch.challengerPlayers.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        console.log(`  Player ID ${playerId}:`, player ? `${player.firstName} ${player.lastName}` : 'NOT FOUND');
      });
    }

    if (pendingMatch.challengedPlayers) {
      console.log('Team 2 Player Lookup:');
      pendingMatch.challengedPlayers.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        console.log(`  Player ID ${playerId}:`, player ? `${player.firstName} ${player.lastName}` : 'NOT FOUND');
      });
    }

    // Pre-fill the form with pending match data
    setMatchFormData({
      date: pendingMatch.acceptedDate || new Date().toISOString().split('T')[0],
      level: pendingMatch.acceptedLevel || pendingMatch.proposedLevel,
      team1Id: pendingMatch.challengerTeamId.toString(),
      team2Id: pendingMatch.challengedTeamId.toString(),
      set1Team1: '',
      set1Team2: '',
      set2Team1: '',
      set2Team2: '',
      set3Team1: '',
      set3Team2: '',
      set3IsTiebreaker: false,
      team1Players: pendingMatch.challengerPlayers || [],
      team2Players: pendingMatch.challengedPlayers || [],
      notes: pendingMatch.notes || ''
    });

    console.log('Match Form Data Set:', {
      team1Id: pendingMatch.challengerTeamId.toString(),
      team2Id: pendingMatch.challengedTeamId.toString(),
      team1Players: pendingMatch.challengerPlayers || [],
      team2Players: pendingMatch.challengedPlayers || []
    });

    // Store reference to the pending match so we can update it after saving
    setEditingMatch({ ...pendingMatch, isPendingMatch: true });
    setShowMatchForm(true);
  };

  // Handle deleting a pending match (directors only)
  const handleDeletePendingMatch = (pendingMatch) => {
    if (userRole !== 'director') {
      alert('⚠️ Only tournament directors can delete pending matches.');
      return;
    }

    const team1Name = getTeamName(pendingMatch.challengerTeamId);
    const team2Name = getTeamName(pendingMatch.challengedTeamId);
    const matchDescription = `${team1Name} vs ${team2Name} (Level ${pendingMatch.acceptedLevel || pendingMatch.proposedLevel})`;

    if (!confirm(`Are you sure you want to delete this pending match?\n\n${matchDescription}\n\nThis action cannot be undone.`)) {
      return;
    }

    // Remove the challenge from the challenges array
    const updatedChallenges = challenges.filter(c => c.id !== pendingMatch.id);
    onChallengesChange(updatedChallenges);

    // Log the deletion
    addLog(
      ACTION_TYPES.PENDING_MATCH_DELETED,
      {
        matchDescription,
        team1Name,
        team2Name,
        challengerTeamId: pendingMatch.challengerTeamId,
        challengedTeamId: pendingMatch.challengedTeamId,
        level: pendingMatch.acceptedLevel || pendingMatch.proposedLevel,
        scheduledDate: pendingMatch.acceptedDate
      },
      pendingMatch.id,
      pendingMatch,
      null
    );

    alert('✅ Pending match deleted successfully.');
  };

  // Helper function to get team name
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  // Helper function to get player names
  const getPlayerNames = (playerIds) => {
    if (!playerIds || playerIds.length === 0) return [];
    return playerIds.map(id => {
      const player = players.find(p => p.id === id);
      return player ? {
        name: `${player.firstName} ${player.lastName}`,
        rating: player.ntrpRating,
        gender: player.gender
      } : null;
    }).filter(p => p !== null);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Record Match Result
        </h2>
        {isAuthenticated && !showMatchForm && (userRole !== 'captain' || userTeamId) && (
          <button
            onClick={handleAddNewMatch}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Match
          </button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="text-sm text-yellow-800">Directors must login to record matches.</p>
        </div>
      )}

      {isAuthenticated && userRole === 'captain' && !userTeamId && (
        <div className="bg-orange-50 border border-orange-300 rounded p-4">
          <p className="text-sm text-orange-800">
            <strong>You are not assigned to a team.</strong>
            <br />
            Please contact the tournament directors to be assigned to a team before you can enter matches.
          </p>
        </div>
      )}

      {/* Pending Matches Section - Only for authenticated users */}
      {isAuthenticated && (userRole !== 'captain' || userTeamId) && getPendingMatches().length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2 text-orange-700">
            <Clock className="w-5 h-5" />
            Pending Matches ({getPendingMatches().length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            These matches have been accepted and are waiting for results to be entered.
          </p>

          <div className="space-y-4">
            {getPendingMatches().map(pendingMatch => {
              const team1Players = getPlayerNames(pendingMatch.challengerPlayers);
              const team2Players = getPlayerNames(pendingMatch.challengedPlayers);
              const combinedNTRP1 = pendingMatch.combinedNTRP || 0;
              const combinedNTRP2 = pendingMatch.challengedCombinedNTRP || 0;

              return (
                <div
                  key={pendingMatch.id}
                  className="bg-orange-50 border-2 border-orange-300 rounded-lg p-5 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Match Title */}
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-lg font-bold text-gray-900">
                          {getTeamName(pendingMatch.challengerTeamId)} vs {getTeamName(pendingMatch.challengedTeamId)}
                        </h4>
                        <span className="px-2 py-1 bg-orange-200 text-orange-900 text-xs font-medium rounded">
                          Level {pendingMatch.acceptedLevel || pendingMatch.proposedLevel}
                        </span>
                        <span className="px-2 py-1 bg-yellow-200 text-yellow-900 text-xs font-medium rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      </div>

                      {/* Players */}
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-700 mb-1">
                              {getTeamName(pendingMatch.challengerTeamId)}:
                            </div>
                            {team1Players.map((player, idx) => (
                              <div key={idx} className="text-gray-600">
                                • {player.name} ({player.gender}) {player.rating} NTRP
                              </div>
                            ))}
                            {combinedNTRP1 > 0 && (
                              <div className="text-green-600 font-medium mt-1">
                                Combined: {combinedNTRP1.toFixed(1)} NTRP
                              </div>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="font-semibold text-gray-700 mb-1">
                              {getTeamName(pendingMatch.challengedTeamId)}:
                            </div>
                            {team2Players.map((player, idx) => (
                              <div key={idx} className="text-gray-600">
                                • {player.name} ({player.gender}) {player.rating} NTRP
                              </div>
                            ))}
                            {combinedNTRP2 > 0 && (
                              <div className="text-green-600 font-medium mt-1">
                                Combined: {combinedNTRP2.toFixed(1)} NTRP
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Match Details */}
                        <div className="flex gap-4 mt-3 pt-3 border-t border-orange-200">
                          {pendingMatch.acceptedDate && (
                            <div className="flex items-center gap-1 text-gray-700">
                              <Calendar className="w-4 h-4" />
                              <span>Scheduled: {formatDate(pendingMatch.acceptedDate)}</span>
                            </div>
                          )}
                          {pendingMatch.notes && (
                            <div className="text-gray-700">
                              <strong>Notes:</strong> {pendingMatch.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="ml-4 flex flex-col gap-2">
                      {canEnterResults(pendingMatch) && (
                        <button
                          onClick={() => handleEnterPendingResults(pendingMatch)}
                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
                        >
                          <Check className="w-4 h-4" />
                          Enter Results
                        </button>
                      )}
                      {userRole === 'director' && (
                        <button
                          onClick={() => handleDeletePendingMatch(pendingMatch)}
                          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
                          title="Delete pending match"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Match Entry Modal */}
      {isAuthenticated && (userRole !== 'captain' || userTeamId) && showMatchForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    {editingMatch && editingMatch.isPendingMatch ? 'Enter Match Results' : (editingMatch ? 'Edit Match' : 'Record New Match')}
                  </h3>
                  {editingMatch && editingMatch.isPendingMatch && (
                    <div className="mt-2 text-lg font-semibold text-gray-700 flex items-center gap-2">
                      <span>{teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1'}</span>
                      <span className="text-blue-600">vs</span>
                      <span>{teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2'}</span>
                      <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                        Level {matchFormData.level}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowMatchForm(false);
                    setEditingMatch(null);
                    setAllowPlayerEdit(false);
                    setPhotoFile(null);
                    setPhotoPreview(null);

                    // Reset form data after modal closes
                    setTimeout(() => {
                      setMatchFormData({
                        date: new Date().toISOString().split('T')[0],
                        level: '7.0',
                        team1Id: '',
                        team2Id: '',
                        set1Team1: '',
                        set1Team2: '',
                        set2Team1: '',
                        set2Team2: '',
                        set3Team1: '',
                        set3Team2: '',
                        set3IsTiebreaker: false,
                        team1Players: [],
                        team2Players: [],
                        notes: ''
                      });
                    }, 300);
                  }}
                  className="text-gray-500 hover:text-gray-700 ml-4"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Special layout for pending match entry */}
              {editingMatch && editingMatch.isPendingMatch ? (
                (() => {
                  // Debug logging for modal rendering
                  console.log('=== MODAL RENDERING DEBUG ===');
                  console.log('Match Form Data:', matchFormData);
                  console.log('Team 1 ID:', matchFormData.team1Id);
                  console.log('Team 2 ID:', matchFormData.team2Id);
                  console.log('Team 1 Player IDs:', matchFormData.team1Players);
                  console.log('Team 2 Player IDs:', matchFormData.team2Players);

                  // Get team1Players and team2Players for the roster
                  const allTeam1Players = getTeamPlayers(matchFormData.team1Id);
                  const allTeam2Players = getTeamPlayers(matchFormData.team2Id);

                  console.log('All Team 1 Players Available:', allTeam1Players);
                  console.log('All Team 2 Players Available:', allTeam2Players);

                  // Get the actual selected player objects
                  const selectedTeam1Players = matchFormData.team1Players
                    .map(playerId => {
                      const player = players.find(p => p.id === playerId);
                      console.log(`Team 1 - Looking for player ${playerId}:`, player);
                      return player;
                    })
                    .filter(p => p !== undefined);

                  const selectedTeam2Players = matchFormData.team2Players
                    .map(playerId => {
                      const player = players.find(p => p.id === playerId);
                      console.log(`Team 2 - Looking for player ${playerId}:`, player);
                      return player;
                    })
                    .filter(p => p !== undefined);

                  console.log('Selected Team 1 Players:', selectedTeam1Players);
                  console.log('Selected Team 2 Players:', selectedTeam2Players);

                  return (
                    <div className="space-y-6">
                      {/* Players Section */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-900">Match Players</h4>
                          {!allowPlayerEdit && (
                            <button
                              onClick={() => {
                                console.log('Change Players clicked');
                                setAllowPlayerEdit(true);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700 underline"
                            >
                              Change Players
                            </button>
                          )}
                        </div>

                        {allowPlayerEdit && (
                          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-yellow-900">⚠️ Changing players from originally agreed upon</p>
                              <p className="text-xs text-yellow-700 mt-1">Select different players if substitutions were made</p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          {/* Team 1 Players */}
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2">
                              {teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1'} Players:
                            </div>
                            {!allowPlayerEdit ? (
                              <div className="space-y-2">
                                {selectedTeam1Players.length > 0 ? (
                                  selectedTeam1Players.map(player => (
                                    <div key={player.id} className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                                      <span className="text-sm">
                                        • {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)} NTRP)
                                        </span>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                    ⚠️ No players found for this team
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2 border border-blue-200 rounded p-2 bg-white max-h-40 overflow-y-auto">
                                {allTeam1Players.length > 0 ? (
                                  allTeam1Players.map(player => (
                                    <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={matchFormData.team1Players.includes(player.id)}
                                        onChange={() => handlePlayerToggle(player.id, 1)}
                                        className="w-4 h-4"
                                      />
                                      <span className="text-sm">
                                        {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.gender}) {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)}
                                        </span>
                                      </span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">
                                    No active players on this team
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Team 2 Players */}
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2">
                              {teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2'} Players:
                            </div>
                            {!allowPlayerEdit ? (
                              <div className="space-y-2">
                                {selectedTeam2Players.length > 0 ? (
                                  selectedTeam2Players.map(player => (
                                    <div key={player.id} className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                                      <span className="text-sm">
                                        • {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)} NTRP)
                                        </span>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                    ⚠️ No players found for this team
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2 border border-purple-200 rounded p-2 bg-white max-h-40 overflow-y-auto">
                                {allTeam2Players.length > 0 ? (
                                  allTeam2Players.map(player => (
                                    <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 p-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={matchFormData.team2Players.includes(player.id)}
                                        onChange={() => handlePlayerToggle(player.id, 2)}
                                        className="w-4 h-4"
                                      />
                                      <span className="text-sm">
                                        {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.gender}) {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)}
                                        </span>
                                      </span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">
                                    No active players on this team
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                  {/* Match Date */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-900">
                      Match Date Played <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={matchFormData.date}
                      onChange={(e) => setMatchFormData({...matchFormData, date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Set Scores Section - Matches Regular Form Styling */}
                  <div className="bg-green-100 border-2 border-green-400 rounded-lg p-4">
                    <h4 className="font-semibold text-lg mb-3">Set Scores *</h4>

                    {/* Set 1 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 1:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set1Team1}
                          onChange={(e) => setMatchFormData({...matchFormData, set1Team1: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set1Team2}
                          onChange={(e) => setMatchFormData({...matchFormData, set1Team2: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Set 2 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 2:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set2Team1}
                          onChange={(e) => setMatchFormData({...matchFormData, set2Team1: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set2Team2}
                          onChange={(e) => setMatchFormData({...matchFormData, set2Team2: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Set 3 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 3 (if needed):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                          value={matchFormData.set3Team1}
                          onChange={(e) => setMatchFormData({...matchFormData, set3Team1: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                          value={matchFormData.set3Team2}
                          onChange={(e) => setMatchFormData({...matchFormData, set3Team2: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                      </div>
                      {(matchFormData.set3Team1 || matchFormData.set3Team2) && (
                        <label className="flex items-center gap-2 mt-2 text-sm">
                          <input
                            type="checkbox"
                            checked={matchFormData.set3IsTiebreaker}
                            onChange={(e) => setMatchFormData({...matchFormData, set3IsTiebreaker: e.target.checked})}
                            className="w-4 h-4"
                          />
                          <span>Set 3 was a 10-point tiebreaker</span>
                        </label>
                      )}
                    </div>

                    {/* Match Result Display */}
                    {getMatchResultsDisplay() && (
                      <div className="mt-4 p-3 bg-white rounded border-2 border-green-500">
                        <p className="text-sm font-semibold text-green-800 mb-1">Match Result:</p>
                        <p className="text-lg font-bold text-green-900">
                          Winner: {getMatchResultsDisplay().winnerName}
                        </p>
                        <p className="text-sm text-gray-700">
                          {getMatchResultsDisplay().setScores}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Photo Upload Section - Matches Regular Form Styling */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                      <label className="block text-sm font-semibold">Upload Match Photo (Optional)</label>
                    </div>

                    {!photoPreview ? (
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          className="w-full px-3 py-2 border rounded bg-white text-sm"
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Upload a photo from this match. Accepted formats: JPG, PNG, WEBP (max 5MB)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="relative inline-block">
                          <img
                            src={photoPreview}
                            alt="Match photo preview"
                            className="max-w-full h-48 object-cover rounded border-2 border-blue-300"
                          />
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                            title="Remove photo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Photo ready to upload
                        </p>
                      </div>
                    )}
                  </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-semibold mb-1 text-gray-700">Notes (Optional)</label>
                        <textarea
                          value={matchFormData.notes}
                          onChange={(e) => setMatchFormData({...matchFormData, notes: e.target.value})}
                          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="2"
                          placeholder="Match notes..."
                        />
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Original form layout for non-pending matches */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Match Date *</label>
                    <input
                      type="date"
                      value={matchFormData.date}
                      onChange={(e) => setMatchFormData({...matchFormData, date: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Match Level</label>
                    <select
                      value={matchFormData.level}
                      onChange={(e) => setMatchFormData({...matchFormData, level: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="5.0">5.0</option>
                      <option value="5.5">5.5</option>
                      <option value="6.0">6.0</option>
                      <option value="6.5">6.5</option>
                      <option value="7.0">7.0</option>
                      <option value="7.5">7.5</option>
                      <option value="8.0">8.0</option>
                      <option value="8.5">8.5</option>
                      <option value="9.0">9.0</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Team 1 * {userRole === 'captain' && '(Your Team)'}
                    </label>
                    <select
                      value={matchFormData.team1Id}
                      onChange={(e) => setMatchFormData({
                        ...matchFormData,
                        team1Id: e.target.value,
                        team1Players: []
                      })}
                      className="w-full px-3 py-2 border rounded"
                      disabled={userRole === 'captain' || !!editingMatch}
                    >
                      <option value="">Select Team 1...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {userRole === 'captain' && !editingMatch && (
                      <p className="text-xs text-gray-600 mt-1">
                        As captain, you can only enter matches for your team
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Team 2 *</label>
                    <select
                      value={matchFormData.team2Id}
                      onChange={(e) => setMatchFormData({
                        ...matchFormData,
                        team2Id: e.target.value,
                        team2Players: []
                      })}
                      className="w-full px-3 py-2 border rounded"
                      disabled={!!editingMatch}
                    >
                      <option value="">Select Team 2...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Team 1 Players */}
                  {matchFormData.team1Id && team1Players.length > 0 && (
                    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded p-3">
                      <label className="block text-sm font-semibold mb-2">
                        Team 1 Players (Optional - Select who played)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {team1Players.map(player => (
                          <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={matchFormData.team1Players.includes(player.id)}
                              onChange={() => handlePlayerToggle(player.id, 1)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">
                              {player.firstName} {player.lastName} ({player.gender} {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)})
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Team 2 Players */}
                  {matchFormData.team2Id && team2Players.length > 0 && (
                    <div className="col-span-2 bg-purple-50 border border-purple-200 rounded p-3">
                      <label className="block text-sm font-semibold mb-2">
                        Team 2 Players (Optional - Select who played)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {team2Players.map(player => (
                          <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={matchFormData.team2Players.includes(player.id)}
                              onChange={() => handlePlayerToggle(player.id, 2)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">
                              {player.firstName} {player.lastName} ({player.gender} {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)})
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Set Scores Section */}
                  <div className="col-span-2 bg-green-100 border-2 border-green-400 rounded-lg p-4">
                    <h4 className="font-semibold text-lg mb-3">Set Scores *</h4>

                    {/* Set 1 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 1:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set1Team1}
                          onChange={(e) => setMatchFormData({...matchFormData, set1Team1: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set1Team2}
                          onChange={(e) => setMatchFormData({...matchFormData, set1Team2: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Set 2 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 2:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set2Team1}
                          onChange={(e) => setMatchFormData({...matchFormData, set2Team1: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set2Team2}
                          onChange={(e) => setMatchFormData({...matchFormData, set2Team2: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Set 3 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 3 (if needed):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                          value={matchFormData.set3Team1}
                          onChange={(e) => setMatchFormData({...matchFormData, set3Team1: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                          value={matchFormData.set3Team2}
                          onChange={(e) => setMatchFormData({...matchFormData, set3Team2: e.target.value})}
                          className="w-16 px-2 py-2 border rounded text-center"
                          placeholder="0"
                        />
                      </div>
                      {(matchFormData.set3Team1 || matchFormData.set3Team2) && (
                        <label className="flex items-center gap-2 mt-2 text-sm">
                          <input
                            type="checkbox"
                            checked={matchFormData.set3IsTiebreaker}
                            onChange={(e) => setMatchFormData({...matchFormData, set3IsTiebreaker: e.target.checked})}
                            className="w-4 h-4"
                          />
                          <span>Set 3 was a 10-point tiebreaker</span>
                        </label>
                      )}
                    </div>

                    {/* Match Result Display */}
                    {getMatchResultsDisplay() && (
                      <div className="mt-4 p-3 bg-white rounded border-2 border-green-500">
                        <p className="text-sm font-semibold text-green-800 mb-1">Match Result:</p>
                        <p className="text-lg font-bold text-green-900">
                          Winner: {getMatchResultsDisplay().winnerName}
                        </p>
                        <p className="text-sm text-gray-700">
                          {getMatchResultsDisplay().setScores}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
                    <textarea
                      value={matchFormData.notes}
                      onChange={(e) => setMatchFormData({...matchFormData, notes: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                      rows="2"
                      placeholder="Match notes..."
                    />
                  </div>

                  {/* Photo Upload Section */}
                  <div className="col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                      <label className="block text-sm font-semibold">Upload Match Photo (Optional)</label>
                    </div>

                    {!photoPreview ? (
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          className="w-full px-3 py-2 border rounded bg-white text-sm"
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Upload a photo from this match. Accepted formats: JPG, PNG, WEBP (max 5MB)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="relative inline-block">
                          <img
                            src={photoPreview}
                            alt="Match photo preview"
                            className="max-w-full h-48 object-cover rounded border-2 border-blue-300"
                          />
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                            title="Remove photo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Photo ready to upload
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3 sticky bottom-0">
              <button
                onClick={handleSaveMatch}
                className="flex-1 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
              >
                <Check className="w-4 h-4" />
                {editingMatch ? 'Save Match Results' : 'Save Match'}
              </button>
              <button
                onClick={() => {
                  setShowMatchForm(false);
                  setEditingMatch(null);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setAllowPlayerEdit(false);

                  // Reset form data after modal closes
                  setTimeout(() => {
                    setMatchFormData({
                      date: new Date().toISOString().split('T')[0],
                      level: '7.0',
                      team1Id: '',
                      team2Id: '',
                      set1Team1: '',
                      set1Team2: '',
                      set2Team1: '',
                      set2Team2: '',
                      set3Team1: '',
                      set3Team2: '',
                      set3IsTiebreaker: false,
                      team1Players: [],
                      team2Players: [],
                      notes: ''
                    });
                  }, 300);
                }}
                className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchEntry;