// Clear Ground - Google Apps Script Backend
// Version 3.5 - Push Notifications with server-side scheduler

// ============================================
// CONFIGURATION
// ============================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  
  // Auto-create sheet if it doesn't exist
  if (!sheet) {
    sheet = createSheet(name);
  }
  
  return sheet;
}

function createSheet(name) {
  const ss = getSpreadsheet();
  const sheet = ss.insertSheet(name);
  
  // Set up headers based on sheet type
  switch(name) {
    case 'Intentions':
      sheet.appendRow([
        'intention_id', 'user_id', 'network_connected', 'connected_at',
        'release_beliefs', 'release_emotions', 'release_trauma',
        'raise_consciousness', 'raise_intelligences',
        'realize_health', 'realize_wealth', 'realize_relationships', 'realize_other',
        'updated_at'
      ]);
      break;
    case 'Transmissions':
      sheet.appendRow(['transmission_id', 'user_id', 'name', 'is_default', 'created_at']);
      // Add default transmissions
      const defaults = ['VortexHealing', 'Divine Energy', 'Kundalini', 'RASA', 'Other'];
      const now = new Date().toISOString();
      defaults.forEach((name, i) => {
        sheet.appendRow(['T_DEFAULT_' + i, '', name, 'TRUE', now]);
      });
      break;
    case 'AwakenSessions':
      sheet.appendRow([
        'session_id', 'user_id', 'practice_id', 'started_at', 'completed_at',
        'spaciousness_1', 'spaciousness_2', 'me_found', 'clarity',
        'me_location', 'me_intensity', 'subject_object', 'me_comparison',
        'did_second_cycle', 'reflection'
      ]);
      break;
    case 'SignalSettings':
      sheet.appendRow([
        'user_id', 'signals_per_day', 'window_start', 'window_end',
        'categories_enabled', 'category_ratios', 'category_order', 'category_index',
        'notifications_enabled', 'updated_at'
      ]);
      break;
    case 'SignalHistory':
      sheet.appendRow([
        'record_id', 'user_id', 'lesson_id', 'category', 'status',
        'is_favorite', 'rating', 'shown_at', 'completed_at'
      ]);
      break;
    case 'Attunements':
      sheet.appendRow([
        'attunement_id', 'name', 'description', 'usage_instructions',
        'duration', 'series_id', 'series_name', 'level',
        'visible', 'created_at', 'updated_at'
      ]);
      break;
    case 'UserAttunements':
      sheet.appendRow([
        'record_id', 'user_id', 'attunement_id', 'attuned_at', 'level'
      ]);
      break;
    case 'ShadowProgress':
      sheet.appendRow([
        'user_id', 'integrate_completed', 'integrate_skipped',
        'process_completed', 'process_skipped', 'deep_clean_data', 'updated_at'
      ]);
      break;
    case 'LiberationProgress':
      sheet.appendRow([
        'user_id', 'total_rounds', 'current_streak', 'last_completed_date', 'updated_at'
      ]);
      break;
    case 'PushSettings':
      sheet.appendRow([
        'user_id', 'settings', 'mindful_alerts', 'timezone', 'onesignal_player_id', 'updated_at'
      ]);
      break;
    case 'ScheduledNotifications':
      sheet.appendRow([
        'notification_id', 'user_id', 'alert_id', 'scheduled_time', 'message', 'sent', 'created_at'
      ]);
      break;
    case 'DailyCheckins':
      sheet.appendRow([
        'checkin_id', 'user_id', 'date', 'mood', 'stress', 'thoughts', 'presence', 'vitality', 'tags', 'note', 'vibe_score', 'created_at'
      ]);
      break;
    case 'InsightCooldowns':
      sheet.appendRow([
        'user_id', 'last_global_insight', 'mood_improve', 'mood_decline', 'stress_improve', 'stress_decline',
        'thoughts_improve', 'thoughts_decline', 'presence_improve', 'presence_decline', 
        'vitality_improve', 'vitality_decline', 'vibe_improve', 'vibe_decline'
      ]);
      break;
  }
  
  return sheet;
}

// ============================================
// WEB APP ENTRY POINTS
// ============================================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = e.parameter;
    const action = params.action;
    
    let result;
    
    switch(action) {
      // User operations
      case 'getUsers':
        result = getUsers();
        break;
      case 'addUser':
        result = addUser(params.name, params.notes);
        break;
      case 'updateUser':
        result = updateUser(params.userId, params.name, params.notes, params.status);
        break;
        
      // Marker operations
      case 'getMarkers':
        result = getMarkers(params.category);
        break;
      case 'addMarker':
        result = addMarker(params.category, params.subcategory, params.name, params.description);
        break;
      case 'updateMarker':
        result = updateMarker(params.markerId, params.name, params.description, params.status);
        break;
        
      // Progress operations
      case 'getProgress':
        result = getProgress(params.userId, params.markerId, params.limit);
        break;
      case 'getLatestProgress':
        result = getLatestProgress(params.userId, params.markerId);
        break;
      case 'saveProgress':
        result = saveProgress(params.userId, params.markerId, params.previousValue, params.sensedValue, params.notes);
        break;
        
      // Session operations
      case 'getSessions':
        result = getSessions(params.userId, params.limit);
        break;
      case 'saveSession':
        result = saveSession(params.userId, params.markerId, params.startTime, params.endTime, params.durationMinutes, params.energyType, params.intensity, params.notes);
        break;
        
      // Playlist operations
      case 'getPlaylists':
        result = getPlaylists(params.userId);
        break;
      case 'savePlaylist':
        result = savePlaylist(params.userId, params.name, params.itemsJson, params.totalDuration);
        break;
      case 'updatePlaylist':
        result = updatePlaylist(params.playlistId, params.name, params.itemsJson, params.totalDuration);
        break;
      case 'deletePlaylist':
        result = deletePlaylist(params.playlistId);
        break;
        
      // Intentions operations (NEW)
      case 'getIntentions':
        result = getIntentions(params.userId);
        break;
      case 'saveIntentions':
        result = saveIntentions(params);
        break;
        
      // Transmissions operations (NEW)
      case 'getTransmissions':
        result = getTransmissions(params.userId);
        break;
      case 'addTransmission':
        result = addTransmission(params.userId, params.name);
        break;
      case 'deleteTransmission':
        result = deleteTransmission(params.transmissionId);
        break;
        
      // Awaken Sessions operations
      case 'getAwakenSessions':
        result = getAwakenSessions(params.userId, params.practiceId, params.limit);
        break;
      case 'saveAwakenSession':
        result = saveAwakenSession(params);
        break;
        
      // Signal operations
      case 'getSignalSettings':
        result = getSignalSettings(params.userId);
        break;
      case 'saveSignalSettings':
        result = saveSignalSettings(params);
        break;
      case 'getSignalHistory':
        result = getSignalHistory(params.userId, params.limit);
        break;
      case 'saveSignalHistory':
        result = saveSignalHistory(params);
        break;
        
      // Attunement operations
      case 'getAttunements':
        result = getAttunements();
        break;
      case 'saveAttunement':
        result = saveAttunement(params);
        break;
      case 'deleteAttunement':
        result = deleteAttunement(params.attunementId);
        break;
      case 'getUserAttunements':
        result = getUserAttunements(params.userId);
        break;
      case 'saveUserAttunement':
        result = saveUserAttunement(params);
        break;
        
      // Shadow progress operations
      case 'getShadowProgress':
        result = getShadowProgress(params.userId);
        break;
      case 'saveShadowProgress':
        result = saveShadowProgress(params);
        break;
        
      // Liberation progress operations
      case 'getLiberationProgress':
        result = getLiberationProgress(params.userId);
        break;
      case 'saveLiberationProgress':
        result = saveLiberationProgress(params);
        break;
        
      // Daily Check-in operations
      case 'saveCheckin':
        result = saveCheckin(params);
        break;
      case 'getCheckins':
        result = getCheckins(params.userId, params.startDate, params.endDate);
        break;
        
      // Push notification operations
      case 'getPushSettings':
        result = getPushSettings(params.userId);
        break;
      case 'savePushSettings':
        result = savePushSettings(params);
        break;
      case 'sendInstantNotification':
        result = sendInstantNotification(params.userId, params.title, params.message);
        break;
        
      // Config operations
      case 'getConfig':
        result = getConfig();
        break;
      case 'saveConfig':
        result = saveConfig(params.key, params.value);
        break;
        
      default:
        result = { error: 'Unknown action: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// USER FUNCTIONS
// ============================================

function getUsers() {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const users = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // Has user_id
      users.push({
        user_id: String(data[i][0]),
        name: data[i][1],
        created_date: data[i][2],
        last_active: data[i][3],
        status: data[i][4],
        notes: data[i][5]
      });
    }
  }
  
  return { success: true, users: users };
}

function addUser(name, notes) {
  const sheet = getSheet('Users');
  const lastRow = sheet.getLastRow();
  const userId = 'U' + (lastRow).toString().padStart(4, '0');
  const now = new Date().toISOString().split('T')[0];
  
  sheet.appendRow([userId, name, now, now, 'active', notes || '']);
  
  return { success: true, userId: userId };
}

function updateUser(userId, name, notes, status) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      if (name) sheet.getRange(i + 1, 2).setValue(name);
      if (notes !== undefined) sheet.getRange(i + 1, 6).setValue(notes);
      if (status) sheet.getRange(i + 1, 5).setValue(status);
      sheet.getRange(i + 1, 4).setValue(new Date().toISOString().split('T')[0]);
      return { success: true };
    }
  }
  
  return { error: 'User not found' };
}

// ============================================
// MARKER FUNCTIONS
// ============================================

function getMarkers(category) {
  const sheet = getSheet('Markers');
  const data = sheet.getDataRange().getValues();
  const markers = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][7] !== 'archived') { // Has marker_id and not archived
      if (!category || data[i][1] === category) {
        markers.push({
          marker_id: String(data[i][0]),
          category: data[i][1],
          subcategory: data[i][2],
          name: data[i][3],
          description: data[i][4],
          measurement_type: data[i][5],
          is_custom: data[i][6],
          status: data[i][7]
        });
      }
    }
  }
  
  return { success: true, markers: markers };
}

function addMarker(category, subcategory, name, description) {
  const sheet = getSheet('Markers');
  const lastRow = sheet.getLastRow();
  const markerId = 'custom_' + Date.now();
  
  sheet.appendRow([markerId, category, subcategory || '', name, description || '', 'percentage', 'TRUE', 'active']);
  
  return { success: true, markerId: markerId };
}

function updateMarker(markerId, name, description, status) {
  const sheet = getSheet('Markers');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(markerId)) {
      if (name) sheet.getRange(i + 1, 4).setValue(name);
      if (description !== undefined) sheet.getRange(i + 1, 5).setValue(description);
      if (status) sheet.getRange(i + 1, 8).setValue(status);
      return { success: true };
    }
  }
  
  return { error: 'Marker not found' };
}

// ============================================
// PROGRESS FUNCTIONS
// ============================================

function getProgress(userId, markerId, limit) {
  const sheet = getSheet('Progress');
  const data = sheet.getDataRange().getValues();
  const progress = [];
  const maxResults = limit ? parseInt(limit) : 100;
  
  for (let i = data.length - 1; i >= 1; i--) {
    // Convert both to string for comparison
    if (String(data[i][2]) === String(userId) && (!markerId || String(data[i][3]) === String(markerId))) {
      progress.push({
        progress_id: String(data[i][0]),
        timestamp: data[i][1],
        user_id: String(data[i][2]),
        marker_id: String(data[i][3]),
        previous_value: data[i][4],
        sensed_value: data[i][5],
        notes: data[i][6]
      });
      if (progress.length >= maxResults) break;
    }
  }
  
  return { success: true, progress: progress };
}

function getLatestProgress(userId, markerId) {
  const sheet = getSheet('Progress');
  const data = sheet.getDataRange().getValues();
  
  // Search from bottom up for most recent
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][2]) === String(userId) && String(data[i][3]) === String(markerId)) {
      return {
        success: true,
        progress: {
          progress_id: String(data[i][0]),
          timestamp: data[i][1],
          user_id: String(data[i][2]),
          marker_id: String(data[i][3]),
          previous_value: data[i][4],
          sensed_value: data[i][5],
          notes: data[i][6]
        }
      };
    }
  }
  
  return { success: true, progress: null };
}

function saveProgress(userId, markerId, previousValue, sensedValue, notes) {
  const sheet = getSheet('Progress');
  const progressId = 'P' + Date.now();
  const timestamp = new Date().toISOString();
  
  sheet.appendRow([progressId, timestamp, userId, markerId, previousValue || '', sensedValue, notes || '']);
  
  // Update user last_active
  updateUserLastActive(userId);
  
  return { success: true, progressId: progressId };
}

function updateUserLastActive(userId) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      sheet.getRange(i + 1, 4).setValue(new Date().toISOString().split('T')[0]);
      break;
    }
  }
}

// ============================================
// SESSION FUNCTIONS
// ============================================

function getSessions(userId, limit) {
  const sheet = getSheet('Sessions');
  const data = sheet.getDataRange().getValues();
  const sessions = [];
  const maxResults = limit ? parseInt(limit) : 100;
  
  for (let i = data.length - 1; i >= 1; i--) {
    // Convert both to string for comparison
    if (String(data[i][1]) === String(userId)) {
      sessions.push({
        session_id: String(data[i][0]),
        user_id: String(data[i][1]),
        marker_id: String(data[i][2]),
        start_time: data[i][3],
        end_time: data[i][4],
        duration_minutes: data[i][5],
        energy_type: data[i][6],
        intensity: data[i][7],
        notes: data[i][8]
      });
      if (sessions.length >= maxResults) break;
    }
  }
  
  return { success: true, sessions: sessions };
}

function saveSession(userId, markerId, startTime, endTime, durationMinutes, energyType, intensity, notes) {
  const sheet = getSheet('Sessions');
  const sessionId = 'S' + Date.now();
  
  sheet.appendRow([sessionId, userId, markerId || '', startTime, endTime, durationMinutes, energyType || '', intensity || '', notes || '']);
  
  // Update user last_active
  updateUserLastActive(userId);
  
  return { success: true, sessionId: sessionId };
}

// ============================================
// PLAYLIST FUNCTIONS
// ============================================

function getPlaylists(userId) {
  const sheet = getSheet('Playlists');
  const data = sheet.getDataRange().getValues();
  const playlists = [];
  
  for (let i = 1; i < data.length; i++) {
    // Convert both to string for comparison
    if (String(data[i][1]) === String(userId) || !userId) {
      playlists.push({
        playlist_id: String(data[i][0]),
        user_id: String(data[i][1]),
        name: data[i][2],
        items_json: data[i][3],
        total_duration_minutes: data[i][4],
        times_used: data[i][5],
        created_date: data[i][6]
      });
    }
  }
  
  return { success: true, playlists: playlists };
}

function savePlaylist(userId, name, itemsJson, totalDuration) {
  const sheet = getSheet('Playlists');
  const playlistId = 'PL' + Date.now();
  const createdDate = new Date().toISOString().split('T')[0];
  
  sheet.appendRow([playlistId, userId, name, itemsJson, totalDuration, 0, createdDate]);
  
  return { success: true, playlistId: playlistId };
}

function updatePlaylist(playlistId, name, itemsJson, totalDuration) {
  const sheet = getSheet('Playlists');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(playlistId)) {
      if (name) sheet.getRange(i + 1, 3).setValue(name);
      if (itemsJson) sheet.getRange(i + 1, 4).setValue(itemsJson);
      if (totalDuration) sheet.getRange(i + 1, 5).setValue(totalDuration);
      return { success: true };
    }
  }
  
  return { error: 'Playlist not found' };
}

function deletePlaylist(playlistId) {
  const sheet = getSheet('Playlists');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(playlistId)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { error: 'Playlist not found' };
}

function incrementPlaylistUsage(playlistId) {
  const sheet = getSheet('Playlists');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(playlistId)) {
      const currentCount = data[i][5] || 0;
      sheet.getRange(i + 1, 6).setValue(currentCount + 1);
      return { success: true };
    }
  }
  
  return { error: 'Playlist not found' };
}

// ============================================
// INTENTIONS FUNCTIONS (NEW)
// ============================================

function getIntentions(userId) {
  const sheet = getSheet('Intentions');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(userId)) {
      return {
        success: true,
        intentions: {
          intention_id: String(data[i][0]),
          user_id: String(data[i][1]),
          network_connected: data[i][2] === true || data[i][2] === 'TRUE',
          connected_at: data[i][3],
          release_beliefs: data[i][4] || '',
          release_emotions: data[i][5] || '',
          release_trauma: data[i][6] || '',
          raise_consciousness: data[i][7] || '',
          raise_intelligences: data[i][8] || '',
          realize_health: data[i][9] || '',
          realize_wealth: data[i][10] || '',
          realize_relationships: data[i][11] || '',
          realize_other: data[i][12] || '',
          updated_at: data[i][13]
        }
      };
    }
  }
  
  // No intentions found for user, return empty
  return { success: true, intentions: null };
}

function saveIntentions(params) {
  const sheet = getSheet('Intentions');
  const data = sheet.getDataRange().getValues();
  const userId = params.userId;
  const now = new Date().toISOString();
  
  // Check if user already has intentions
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(userId)) {
      // Update existing row
      const row = i + 1;
      
      if (params.network_connected !== undefined) {
        sheet.getRange(row, 3).setValue(params.network_connected === 'true' || params.network_connected === true);
        // Set connected_at timestamp if just connected
        if ((params.network_connected === 'true' || params.network_connected === true) && !data[i][3]) {
          sheet.getRange(row, 4).setValue(now);
        }
      }
      if (params.release_beliefs !== undefined) sheet.getRange(row, 5).setValue(params.release_beliefs);
      if (params.release_emotions !== undefined) sheet.getRange(row, 6).setValue(params.release_emotions);
      if (params.release_trauma !== undefined) sheet.getRange(row, 7).setValue(params.release_trauma);
      if (params.raise_consciousness !== undefined) sheet.getRange(row, 8).setValue(params.raise_consciousness);
      if (params.raise_intelligences !== undefined) sheet.getRange(row, 9).setValue(params.raise_intelligences);
      if (params.realize_health !== undefined) sheet.getRange(row, 10).setValue(params.realize_health);
      if (params.realize_wealth !== undefined) sheet.getRange(row, 11).setValue(params.realize_wealth);
      if (params.realize_relationships !== undefined) sheet.getRange(row, 12).setValue(params.realize_relationships);
      if (params.realize_other !== undefined) sheet.getRange(row, 13).setValue(params.realize_other);
      
      // Always update timestamp
      sheet.getRange(row, 14).setValue(now);
      
      return { success: true, updated: true };
    }
  }
  
  // Create new intentions row
  const intentionId = 'INT_' + Date.now();
  const networkConnected = params.network_connected === 'true' || params.network_connected === true;
  const connectedAt = networkConnected ? now : '';
  
  sheet.appendRow([
    intentionId,
    userId,
    networkConnected,
    connectedAt,
    params.release_beliefs || '',
    params.release_emotions || '',
    params.release_trauma || '',
    params.raise_consciousness || '',
    params.raise_intelligences || '',
    params.realize_health || '',
    params.realize_wealth || '',
    params.realize_relationships || '',
    params.realize_other || '',
    now
  ]);
  
  return { success: true, intentionId: intentionId, created: true };
}

// ============================================
// TRANSMISSIONS FUNCTIONS (NEW)
// ============================================

function getTransmissions(userId) {
  const sheet = getSheet('Transmissions');
  const data = sheet.getDataRange().getValues();
  const transmissions = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // Has transmission_id
      const isDefault = data[i][3] === true || data[i][3] === 'TRUE';
      const transmissionUserId = data[i][1] ? String(data[i][1]) : null;
      
      // Include if: default transmission OR belongs to this user
      if (isDefault || transmissionUserId === String(userId)) {
        transmissions.push({
          transmission_id: String(data[i][0]),
          user_id: transmissionUserId,
          name: data[i][2],
          is_default: isDefault,
          created_at: data[i][4]
        });
      }
    }
  }
  
  return { success: true, transmissions: transmissions };
}

function addTransmission(userId, name) {
  const sheet = getSheet('Transmissions');
  const transmissionId = 'T_' + Date.now();
  const now = new Date().toISOString();
  
  sheet.appendRow([transmissionId, userId, name, 'FALSE', now]);
  
  return { success: true, transmissionId: transmissionId };
}

function deleteTransmission(transmissionId) {
  const sheet = getSheet('Transmissions');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(transmissionId)) {
      // Don't allow deleting default transmissions
      if (data[i][3] === true || data[i][3] === 'TRUE') {
        return { error: 'Cannot delete default transmission' };
      }
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { error: 'Transmission not found' };
}

// ============================================
// AWAKEN SESSIONS FUNCTIONS
// ============================================

function getAwakenSessions(userId, practiceId, limit) {
  const sheet = getSheet('AwakenSessions');
  const data = sheet.getDataRange().getValues();
  const sessions = [];
  const maxResults = limit ? parseInt(limit) : 50;
  
  for (let i = data.length - 1; i >= 1; i--) {
    // Filter by userId and optionally by practiceId
    if (String(data[i][1]) === String(userId)) {
      if (!practiceId || String(data[i][2]) === String(practiceId)) {
        sessions.push({
          session_id: String(data[i][0]),
          user_id: String(data[i][1]),
          practice_id: data[i][2],
          started_at: data[i][3],
          completed_at: data[i][4],
          spaciousness_1: data[i][5],
          spaciousness_2: data[i][6],
          me_found: data[i][7],
          clarity: data[i][8],
          me_location: data[i][9],
          me_intensity: data[i][10],
          subject_object: data[i][11],
          me_comparison: data[i][12],
          did_second_cycle: data[i][13],
          reflection: data[i][14]
        });
        if (sessions.length >= maxResults) break;
      }
    }
  }
  
  // Count completed sessions for this practice
  let completedCount = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(userId) && 
        (!practiceId || String(data[i][2]) === String(practiceId)) &&
        data[i][4]) { // has completed_at
      completedCount++;
    }
  }
  
  return { 
    success: true, 
    sessions: sessions,
    completedCount: completedCount
  };
}

function saveAwakenSession(params) {
  const sheet = getSheet('AwakenSessions');
  const sessionId = 'AWS_' + Date.now();
  const now = new Date().toISOString();
  
  sheet.appendRow([
    sessionId,
    params.userId,
    params.practiceId || '2pf-full',
    params.startedAt || now,
    params.completedAt || now,
    params.spaciousness_1 || '',
    params.spaciousness_2 || '',
    params.me_found || '',
    params.clarity || '',
    params.me_location || '',
    params.me_intensity || '',
    params.subject_object || '',
    params.me_comparison || '',
    params.did_second_cycle || 'false',
    params.reflection || ''
  ]);
  
  // Update user last_active
  updateUserLastActive(params.userId);
  
  return { success: true, sessionId: sessionId };
}

// ============================================
// CONFIG FUNCTIONS
// ============================================

function getConfig() {
  const sheet = getSheet('Config');
  const data = sheet.getDataRange().getValues();
  const config = {};
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      config[data[i][0]] = data[i][1];
    }
  }
  
  return { success: true, config: config };
}

function saveConfig(key, value) {
  const sheet = getSheet('Config');
  const data = sheet.getDataRange().getValues();
  
  // Check if key exists
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return { success: true };
    }
  }
  
  // Add new key
  sheet.appendRow([key, value]);
  return { success: true };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getCategories() {
  const sheet = getSheet('Markers');
  const data = sheet.getDataRange().getValues();
  const categories = new Set();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) {
      categories.add(data[i][1]);
    }
  }
  
  return { success: true, categories: Array.from(categories).sort() };
}

// Test function - run this to verify setup
function testSetup() {
  const users = getUsers();
  const markers = getMarkers();
  const transmissions = getTransmissions('1');
  
  Logger.log('Users found: ' + users.users.length);
  Logger.log('Markers found: ' + markers.markers.length);
  Logger.log('Transmissions found: ' + transmissions.transmissions.length);
  
  return {
    usersCount: users.users.length,
    markersCount: markers.markers.length,
    transmissionsCount: transmissions.transmissions.length,
    status: 'Setup verified successfully!'
  };
}

// Initialize sheets - run once to set up new sheets
function initializeNewSheets() {
  getSheet('Intentions');
  getSheet('Transmissions');
  getSheet('AwakenSessions');
  getSheet('SignalSettings');
  getSheet('SignalHistory');
  Logger.log('New sheets created successfully!');
}

// ============================================
// SIGNAL FUNCTIONS
// ============================================

function getSignalSettings(userId) {
  const sheet = getSheet('SignalSettings');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      return {
        success: true,
        settings: {
          user_id: String(data[i][0]),
          signals_per_day: data[i][1] || 1,
          window_start: data[i][2] || 8,
          window_end: data[i][3] || 20,
          categories_enabled: data[i][4] ? JSON.parse(data[i][4]) : ['recognize', 'create'],
          category_ratios: data[i][5] ? JSON.parse(data[i][5]) : { recognize: 50, create: 50 },
          category_order: data[i][6] ? JSON.parse(data[i][6]) : { recognize: 'sequential', create: 'sequential' },
          category_index: data[i][7] ? JSON.parse(data[i][7]) : { recognize: 0, create: 0 },
          notifications_enabled: data[i][8] !== false,
          updated_at: data[i][9]
        }
      };
    }
  }
  
  // Return defaults if not found
  return {
    success: true,
    settings: null
  };
}

function saveSignalSettings(params) {
  const sheet = getSheet('SignalSettings');
  const data = sheet.getDataRange().getValues();
  const userId = params.userId;
  const now = new Date().toISOString();
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      rowIndex = i + 1;
      break;
    }
  }
  
  const rowData = [
    userId,
    parseInt(params.signalsPerDay) || 1,
    parseInt(params.windowStart) || 8,
    parseInt(params.windowEnd) || 20,
    params.categoriesEnabled || '["recognize","create"]',
    params.categoryRatios || '{"recognize":50,"create":50}',
    params.categoryOrder || '{"recognize":"sequential","create":"sequential"}',
    params.categoryIndex || '{"recognize":0,"create":0}',
    params.notificationsEnabled !== 'false',
    now
  ];
  
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return { success: true };
}

function getSignalHistory(userId, limit) {
  const sheet = getSheet('SignalHistory');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const history = [];
  const maxResults = parseInt(limit) || 100;
  
  for (let i = data.length - 1; i >= 1 && history.length < maxResults; i--) {
    if (String(data[i][1]) === String(userId)) {
      history.push({
        record_id: String(data[i][0]),
        user_id: String(data[i][1]),
        lesson_id: data[i][2],
        category: data[i][3],
        status: data[i][4],
        is_favorite: data[i][5] === true || data[i][5] === 'TRUE',
        rating: data[i][6] || null,
        shown_at: data[i][7],
        completed_at: data[i][8]
      });
    }
  }
  
  return { success: true, history: history };
}

function saveSignalHistory(params) {
  const sheet = getSheet('SignalHistory');
  const recordId = params.recordId || 'SIG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  // Check if updating existing record
  if (params.recordId) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(params.recordId)) {
        const rowIndex = i + 1;
        const rowData = [
          params.recordId,
          params.userId,
          params.lessonId,
          params.category,
          params.status,
          params.isFavorite === true || params.isFavorite === 'true',
          params.rating || '',
          params.shownAt,
          params.completedAt || ''
        ];
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
        return { success: true, record_id: params.recordId };
      }
    }
  }
  
  // New record
  sheet.appendRow([
    recordId,
    params.userId,
    params.lessonId,
    params.category,
    params.status,
    params.isFavorite === true || params.isFavorite === 'true',
    params.rating || '',
    params.shownAt || new Date().toISOString(),
    params.completedAt || ''
  ]);
  
  return { success: true, record_id: recordId };
}

// ============================================
// ATTUNEMENT FUNCTIONS
// ============================================

function getAttunements() {
  const sheet = getSheet('Attunements');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { attunements: [] };
  }
  
  const headers = data[0];
  const attunements = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    attunements.push({
      id: row[0],
      name: row[1],
      description: row[2],
      usageInstructions: row[3],
      duration: row[4],
      seriesId: row[5],
      seriesName: row[6],
      level: row[7],
      visible: row[8] === true || row[8] === 'TRUE' || row[8] === 'true',
      createdAt: row[9],
      updatedAt: row[10]
    });
  }
  
  return { attunements: attunements };
}

function saveAttunement(params) {
  const sheet = getSheet('Attunements');
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  
  // Check if updating existing attunement
  if (params.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const rowIndex = i + 1;
        const rowData = [
          params.id,
          params.name,
          params.description || '',
          params.usageInstructions || '',
          params.duration || 30,
          params.seriesId || '',
          params.seriesName || '',
          params.level || 1,
          params.visible !== false,
          data[i][9], // Keep original createdAt
          now
        ];
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
        return { success: true, attunement_id: params.id };
      }
    }
  }
  
  // New attunement
  const attunementId = params.id || 'att-' + Date.now();
  sheet.appendRow([
    attunementId,
    params.name,
    params.description || '',
    params.usageInstructions || '',
    params.duration || 30,
    params.seriesId || '',
    params.seriesName || '',
    params.level || 1,
    params.visible !== false,
    now,
    now
  ]);
  
  return { success: true, attunement_id: attunementId };
}

function deleteAttunement(attunementId) {
  const sheet = getSheet('Attunements');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === attunementId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { error: 'Attunement not found' };
}

function getUserAttunements(userId) {
  const sheet = getSheet('UserAttunements');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { userAttunements: [] };
  }
  
  const userAttunements = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1] === userId) {
      userAttunements.push({
        recordId: row[0],
        attunementId: row[2],
        attunedAt: row[3],
        level: row[4]
      });
    }
  }
  
  return { userAttunements: userAttunements };
}

function saveUserAttunement(params) {
  const sheet = getSheet('UserAttunements');
  const recordId = 'UA_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  sheet.appendRow([
    recordId,
    params.userId,
    params.attunementId,
    params.attunedAt || new Date().toISOString(),
    params.level || 1
  ]);
  
  return { success: true, record_id: recordId };
}

// ============================================
// SHADOW PROGRESS FUNCTIONS
// ============================================

function getShadowProgress(userId) {
  const sheet = getSheet('ShadowProgress');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { shadowProgress: null };
  }
  
  // Helper to parse array data (handles both JSON and comma-separated formats)
  function parseArrayData(value) {
    if (!value || value === '[]') return [];
    
    // If it's already an array (shouldn't happen from sheet, but just in case)
    if (Array.isArray(value)) return value;
    
    const str = String(value).trim();
    
    // Try JSON parse first
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (e) {
      // Not valid JSON - try comma-separated format
      if (str.includes(',') || /^\d+$/.test(str)) {
        // It's a comma-separated list of numbers like "1,2,3,4,5"
        return str.split(',').map(s => {
          const num = parseInt(s.trim(), 10);
          return isNaN(num) ? s.trim() : num;
        }).filter(v => v !== '');
      }
      return [];
    }
  }
  
  // Helper to parse object data
  function parseObjectData(value) {
    if (!value || value === '{}' || value === '[object Object]') return {};
    
    try {
      const parsed = JSON.parse(String(value));
      if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      return {};
    } catch (e) {
      return {};
    }
  }
  
  // Convert userId to string for comparison
  const userIdStr = String(userId);
  
  // Find ALL rows for this user, return the one with most progress (latest)
  let bestRow = null;
  let bestProgress = -1;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]) === userIdStr) {
      // Calculate total progress for this row
      const integrateCompleted = parseArrayData(row[1]);
      const processCompleted = parseArrayData(row[3]);
      const totalProgress = integrateCompleted.length + processCompleted.length;
      
      if (totalProgress > bestProgress) {
        bestProgress = totalProgress;
        bestRow = row;
      }
    }
  }
  
  if (bestRow) {
    return {
      shadowProgress: {
        integrateCompleted: parseArrayData(bestRow[1]),
        integrateSkipped: parseArrayData(bestRow[2]),
        processCompleted: parseArrayData(bestRow[3]),
        processSkipped: parseArrayData(bestRow[4]),
        deepClean: parseObjectData(bestRow[5])
      }
    };
  }
  
  return { shadowProgress: null };
}

function saveShadowProgress(params) {
  const sheet = getSheet('ShadowProgress');
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  
  // Helper to ensure proper JSON string
  function ensureJsonArray(value) {
    if (!value) return '[]';
    if (typeof value === 'string') {
      // Already a string - check if it's valid JSON
      try {
        JSON.parse(value);
        return value; // Valid JSON, use as is
      } catch (e) {
        // Not valid JSON - might be comma-separated, convert to JSON array
        if (value.includes(',') || /^\d+$/.test(value)) {
          const arr = value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
          return JSON.stringify(arr);
        }
        return '[]';
      }
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return '[]';
  }
  
  function ensureJsonObject(value) {
    if (!value) return '{}';
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return value;
      } catch (e) {
        return '{}';
      }
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return '{}';
  }
  
  const rowData = [
    params.userId,
    ensureJsonArray(params.integrateCompleted),
    ensureJsonArray(params.integrateSkipped),
    ensureJsonArray(params.processCompleted),
    ensureJsonArray(params.processSkipped),
    ensureJsonObject(params.deepClean),
    now
  ];
  
  // Check for existing record - use string comparison
  const userIdStr = String(params.userId);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userIdStr) {
      const rowIndex = i + 1;
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return { success: true };
    }
  }
  
  // New record
  sheet.appendRow(rowData);
  
  return { success: true };
}

// ============================================
// LIBERATION PROGRESS
// ============================================

function getLiberationProgress(userId) {
  const sheet = getSheet('LiberationProgress');
  const data = sheet.getDataRange().getValues();
  
  // Use string comparison
  const userIdStr = String(userId);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userIdStr) {
      return {
        liberationProgress: {
          totalRounds: data[i][1] || 0,
          currentStreak: data[i][2] || 0,
          lastCompletedDate: data[i][3] || null,
          updatedAt: data[i][4]
        }
      };
    }
  }
  
  return { liberationProgress: null };
}

function saveLiberationProgress(params) {
  const sheet = getSheet('LiberationProgress');
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  
  // Use string comparison
  const userIdStr = String(params.userId);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userIdStr) {
      const rowIndex = i + 1;
      const rowData = [
        params.userId,
        params.totalRounds || 0,
        params.currentStreak || 0,
        params.lastCompletedDate || '',
        now
      ];
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return { success: true };
    }
  }
  
  // New record
  sheet.appendRow([
    params.userId,
    params.totalRounds || 0,
    params.currentStreak || 0,
    params.lastCompletedDate || '',
    now
  ]);
  
  return { success: true };
}

// ============================================
// DAILY CHECK-IN
// ============================================

function saveCheckin(params) {
  const sheet = getSheet('DailyCheckins');
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  
  const userIdStr = String(params.userId);
  const date = params.date;
  
  // Check if check-in already exists for this user and date
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === userIdStr && data[i][2] === date) {
      // Update existing check-in
      const rowData = [
        data[i][0], // Keep existing checkin_id
        params.userId,
        date,
        params.mood || 5,
        params.stress || 5,
        params.thoughts || 5,
        params.presence || 5,
        params.vitality || 5,
        params.tags || '[]',
        params.note || '',
        params.vibeScore || 50,
        now
      ];
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      
      // Check for baseline shifts (async, don't block response)
      try {
        checkBaselineShifts(params.userId);
      } catch (e) {
        console.error('Baseline check error:', e);
      }
      
      return { success: true, checkinId: data[i][0] };
    }
  }
  
  // New check-in
  const checkinId = 'CHK_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  sheet.appendRow([
    checkinId,
    params.userId,
    date,
    params.mood || 5,
    params.stress || 5,
    params.thoughts || 5,
    params.presence || 5,
    params.vitality || 5,
    params.tags || '[]',
    params.note || '',
    params.vibeScore || 50,
    now
  ]);
  
  // Check for baseline shifts (async, don't block response)
  try {
    checkBaselineShifts(params.userId);
  } catch (e) {
    console.error('Baseline check error:', e);
  }
  
  return { success: true, checkinId: checkinId };
}

function getCheckins(userId, startDate, endDate) {
  const sheet = getSheet('DailyCheckins');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { checkins: [] };
  }
  
  const userIdStr = String(userId);
  const checkins = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]) !== userIdStr) continue;
    
    const date = row[2];
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;
    
    let tags = [];
    try {
      tags = JSON.parse(row[8] || '[]');
    } catch (e) {
      tags = [];
    }
    
    checkins.push({
      checkinId: row[0],
      userId: row[1],
      date: row[2],
      mood: row[3],
      stress: row[4],
      thoughts: row[5],
      presence: row[6],
      vitality: row[7],
      tags: tags,
      note: row[9],
      vibeScore: row[10],
      createdAt: row[11]
    });
  }
  
  // Sort by date descending (most recent first)
  checkins.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return { checkins: checkins };
}

// ============================================
// BASELINE SHIFT DETECTION
// ============================================

// Thresholds for detecting shifts
const BASELINE_THRESHOLDS = {
  mood: 1.0,      // 0-10 scale
  stress: 1.0,    // 0-10 scale (inverted)
  thoughts: 1.0,  // 0-10 scale (inverted)
  presence: 1.0,  // 0-10 scale
  vitality: 1.0,  // 0-10 scale
  vibe: 7         // 0-100 scale
};

// Cooldown periods in days
const GLOBAL_COOLDOWN_DAYS = 7;
const METRIC_COOLDOWN_DAYS = 30;

// Check for baseline shifts after a check-in
function checkBaselineShifts(userId) {
  console.log('Checking baseline shifts for user:', userId);
  
  // Get last 28 days of check-ins
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const result = getCheckins(userId, startDate, endDate);
  const checkins = result.checkins || [];
  
  console.log('Check-ins in last 28 days:', checkins.length);
  
  // Need at least 4 check-ins for MA7 and 14 for MA28
  if (checkins.length < 4) {
    console.log('Not enough check-ins for baseline calculation');
    return;
  }
  
  // Calculate baselines for each metric
  const baselines = calculateBaselines(checkins);
  console.log('Baselines calculated:', JSON.stringify(baselines));
  
  // Check cooldowns
  const cooldowns = getInsightCooldowns(userId);
  const now = new Date();
  
  // Check global cooldown (7 days)
  if (cooldowns.lastGlobalInsight) {
    const lastGlobal = new Date(cooldowns.lastGlobalInsight);
    const daysSince = (now - lastGlobal) / (1000 * 60 * 60 * 24);
    if (daysSince < GLOBAL_COOLDOWN_DAYS) {
      console.log('Global cooldown active, days since last:', daysSince.toFixed(1));
      return;
    }
  }
  
  // Find the best insight to send
  const insight = findBestInsight(baselines, cooldowns, now);
  
  if (insight) {
    console.log('Sending insight:', insight.metric, insight.type);
    sendBaselineInsight(userId, insight, baselines);
  } else {
    console.log('No qualifying insights found');
  }
}

// Calculate MA7 and MA28 for each metric
function calculateBaselines(checkins) {
  // Sort by date descending (most recent first)
  const sorted = [...checkins].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Get check-ins from last 7 and 28 days
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now - 28 * 24 * 60 * 60 * 1000);
  
  const last7 = sorted.filter(c => new Date(c.date) >= sevenDaysAgo);
  const last28 = sorted.filter(c => new Date(c.date) >= twentyEightDaysAgo);
  
  const baselines = {};
  
  const metrics = ['mood', 'stress', 'thoughts', 'presence', 'vitality', 'vibe'];
  
  metrics.forEach(metric => {
    // Calculate MA7 (need at least 4 entries)
    let ma7 = null;
    if (last7.length >= 4) {
      if (metric === 'vibe') {
        ma7 = last7.reduce((sum, c) => sum + (c.vibeScore || 50), 0) / last7.length;
      } else if (metric === 'stress' || metric === 'thoughts') {
        // Invert: lower raw = better = higher pos
        ma7 = 10 - (last7.reduce((sum, c) => sum + (c[metric] || 5), 0) / last7.length);
      } else {
        ma7 = last7.reduce((sum, c) => sum + (c[metric] || 5), 0) / last7.length;
      }
    }
    
    // Calculate MA28 (need at least 14 entries)
    let ma28 = null;
    if (last28.length >= 14) {
      if (metric === 'vibe') {
        ma28 = last28.reduce((sum, c) => sum + (c.vibeScore || 50), 0) / last28.length;
      } else if (metric === 'stress' || metric === 'thoughts') {
        // Invert: lower raw = better = higher pos
        ma28 = 10 - (last28.reduce((sum, c) => sum + (c[metric] || 5), 0) / last28.length);
      } else {
        ma28 = last28.reduce((sum, c) => sum + (c[metric] || 5), 0) / last28.length;
      }
    }
    
    baselines[metric] = { ma7, ma28 };
  });
  
  return baselines;
}

// Get insight cooldowns for a user
function getInsightCooldowns(userId) {
  const sheet = getSheet('InsightCooldowns');
  const data = sheet.getDataRange().getValues();
  const userIdStr = String(userId);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userIdStr) {
      return {
        lastGlobalInsight: data[i][1],
        moodImprove: data[i][2],
        moodDecline: data[i][3],
        stressImprove: data[i][4],
        stressDecline: data[i][5],
        thoughtsImprove: data[i][6],
        thoughtsDecline: data[i][7],
        presenceImprove: data[i][8],
        presenceDecline: data[i][9],
        vitalityImprove: data[i][10],
        vitalityDecline: data[i][11],
        vibeImprove: data[i][12],
        vibeDecline: data[i][13],
        rowIndex: i + 1
      };
    }
  }
  
  return {}; // No cooldowns found
}

// Save insight cooldown
function saveInsightCooldown(userId, metric, type, now) {
  const sheet = getSheet('InsightCooldowns');
  const data = sheet.getDataRange().getValues();
  const userIdStr = String(userId);
  const nowStr = now.toISOString();
  
  // Column mapping
  const columns = {
    moodImprove: 2, moodDecline: 3,
    stressImprove: 4, stressDecline: 5,
    thoughtsImprove: 6, thoughtsDecline: 7,
    presenceImprove: 8, presenceDecline: 9,
    vitalityImprove: 10, vitalityDecline: 11,
    vibeImprove: 12, vibeDecline: 13
  };
  
  const colKey = metric + (type === 'improve' ? 'Improve' : 'Decline');
  const colIndex = columns[colKey];
  
  // Find or create row
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userIdStr) {
      // Update global and specific cooldown
      sheet.getRange(i + 1, 2).setValue(nowStr); // last_global_insight
      if (colIndex) {
        sheet.getRange(i + 1, colIndex + 1).setValue(nowStr);
      }
      return;
    }
  }
  
  // Create new row
  const newRow = [userId, nowStr, '', '', '', '', '', '', '', '', '', '', '', ''];
  if (colIndex) {
    newRow[colIndex] = nowStr;
  }
  sheet.appendRow(newRow);
}

// Find the best insight to send
function findBestInsight(baselines, cooldowns, now) {
  const candidates = [];
  
  const metrics = ['mood', 'stress', 'thoughts', 'presence', 'vitality', 'vibe'];
  
  metrics.forEach(metric => {
    const { ma7, ma28 } = baselines[metric];
    if (ma7 === null || ma28 === null) return;
    
    const threshold = BASELINE_THRESHOLDS[metric];
    const diff = ma7 - ma28;
    
    // Check improvement
    if (diff >= threshold) {
      const cooldownKey = metric + 'Improve';
      const lastSent = cooldowns[cooldownKey];
      if (!lastSent || (now - new Date(lastSent)) / (1000 * 60 * 60 * 24) >= METRIC_COOLDOWN_DAYS) {
        candidates.push({ metric, type: 'improve', diff, ma7, ma28 });
      }
    }
    
    // Check decline
    if (diff <= -threshold) {
      const cooldownKey = metric + 'Decline';
      const lastSent = cooldowns[cooldownKey];
      if (!lastSent || (now - new Date(lastSent)) / (1000 * 60 * 60 * 24) >= METRIC_COOLDOWN_DAYS) {
        candidates.push({ metric, type: 'decline', diff: Math.abs(diff), ma7, ma28 });
      }
    }
  });
  
  if (candidates.length === 0) return null;
  
  // Prioritize improvements over declines, then by magnitude
  const improvements = candidates.filter(c => c.type === 'improve');
  const declines = candidates.filter(c => c.type === 'decline');
  
  if (improvements.length > 0) {
    // Return improvement with largest diff
    return improvements.sort((a, b) => b.diff - a.diff)[0];
  } else if (declines.length > 0) {
    // Return decline with largest diff
    return declines.sort((a, b) => b.diff - a.diff)[0];
  }
  
  return null;
}

// Send baseline insight notification
function sendBaselineInsight(userId, insight, baselines) {
  // Get user's player ID
  const pushData = getPushSettings(userId);
  if (!pushData.pushSettings || !pushData.pushSettings.onesignalPlayerId) {
    console.log('No player ID for baseline insight');
    return;
  }
  
  const playerId = pushData.pushSettings.onesignalPlayerId;
  const { metric, type, ma7, ma28 } = insight;
  
  // Format values
  const formatValue = (val, isVibe) => isVibe ? Math.round(val) : val.toFixed(1);
  const isVibe = metric === 'vibe';
  const ma7Str = formatValue(ma7, isVibe);
  const ma28Str = formatValue(ma28, isVibe);
  
  // Notification messages
  const messages = {
    improve: {
      mood: `New normal noticed: your mood has been higher lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      stress: `New normal noticed: your stress has been lower lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      thoughts: `New normal noticed: your mind has been quieter lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      presence: `New normal noticed: your presence has been higher lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      vitality: `New normal noticed: your energy has been higher lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      vibe: `New normal noticed: your Vibe Score has been higher lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`
    },
    decline: {
      mood: `Mood has been a bit lower than your baseline lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      stress: `Looks like stress has been higher than your baseline lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      thoughts: `Looks like your mind has been busier than your baseline lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      presence: `Presence has been a bit lower than your baseline lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      vitality: `Energy has been lower than your baseline lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`,
      vibe: `Your Vibe Score has dipped below your baseline lately. (7-day avg ${ma7Str} vs 28-day avg ${ma28Str})`
    }
  };
  
  const message = messages[type][metric];
  
  // Send notification
  const success = sendOneSignalNotification(playerId, 'Clear Ground', message);
  
  if (success) {
    // Save cooldown
    saveInsightCooldown(userId, metric, type, new Date());
    console.log('Baseline insight sent:', metric, type);
  }
}

// ============================================
// PUSH NOTIFICATION SETTINGS & SCHEDULER
// ============================================

// OneSignal Configuration
const ONESIGNAL_APP_ID = '4a340707-5574-45b1-b514-e7469737cef5';
const ONESIGNAL_REST_API_KEY = 'YOUR_REST_API_KEY_HERE'; // Set this in Script Properties

function getOneSignalApiKey() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('ONESIGNAL_REST_API_KEY') || ONESIGNAL_REST_API_KEY;
}

function getPushSettings(userId) {
  const sheet = getSheet('PushSettings');
  const data = sheet.getDataRange().getValues();
  
  // Convert userId to string for comparison
  const userIdStr = String(userId);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userIdStr) {
      return {
        pushSettings: {
          settings: JSON.parse(data[i][1] || '{}'),
          mindfulAlerts: JSON.parse(data[i][2] || '[]'),
          timezone: data[i][3] || 'UTC',
          onesignalPlayerId: data[i][4] || '',
          updatedAt: data[i][5]
        }
      };
    }
  }
  
  return { pushSettings: null };
}

function savePushSettings(params) {
  const sheet = getSheet('PushSettings');
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  
  // Handle settings - might be string or object
  let settingsStr = params.settings;
  if (typeof settingsStr === 'object') {
    settingsStr = JSON.stringify(settingsStr);
  } else if (typeof settingsStr !== 'string') {
    settingsStr = '{}';
  }
  
  // Handle mindfulAlerts - might be string or array
  let alertsStr = params.mindfulAlerts;
  if (Array.isArray(alertsStr)) {
    alertsStr = JSON.stringify(alertsStr);
  } else if (typeof alertsStr !== 'string') {
    alertsStr = '[]';
  }
  
  const rowData = [
    params.userId,
    settingsStr,
    alertsStr,
    params.timezone || 'UTC',
    params.onesignalPlayerId || '',
    now
  ];
  
  console.log('Saving push settings for user:', params.userId);
  console.log('Settings:', settingsStr);
  console.log('Alerts:', alertsStr);
  console.log('Player ID:', params.onesignalPlayerId);
  
  // Check for existing record - use string comparison
  const userIdStr = String(params.userId);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userIdStr) {
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      // Regenerate schedules for this user
      generateUserSchedules(params.userId);
      return { success: true };
    }
  }
  
  // New record
  sheet.appendRow(rowData);
  generateUserSchedules(params.userId);
  
  return { success: true };
}

// ============================================
// SCHEDULE GENERATION
// ============================================

// Generate random notification times for a user's mindful alerts
function generateUserSchedules(userId) {
  console.log('Generating schedules for user:', userId);
  
  const pushData = getPushSettings(userId);
  if (!pushData.pushSettings) {
    console.log('No push settings found for user');
    return;
  }
  
  const alerts = pushData.pushSettings.mindfulAlerts || [];
  const timezone = pushData.pushSettings.timezone || 'UTC';
  const schedSheet = getSheet('ScheduledNotifications');
  
  console.log('Found', alerts.length, 'mindful alerts');
  console.log('Alerts:', JSON.stringify(alerts));
  
  if (alerts.length === 0) {
    console.log('No alerts to schedule');
    return;
  }
  
  // Clear existing unsent schedules for this user
  clearUserSchedules(userId);
  
  // Get today in user's timezone
  const now = new Date();
  const today = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = Utilities.formatDate(tomorrow, timezone, 'yyyy-MM-dd');
  
  console.log('Scheduling for dates:', today, tomorrowStr);
  
  // Generate schedules for today and tomorrow
  let scheduledCount = 0;
  [today, tomorrowStr].forEach(dateStr => {
    alerts.forEach(alert => {
      if (!alert.enabled) {
        console.log('Alert disabled:', alert.name);
        return;
      }
      
      console.log('Generating times for alert:', alert.name, 'frequency:', alert.frequency);
      
      const times = generateRandomTimes(
        alert.frequency,
        alert.startTime,
        alert.endTime,
        dateStr,
        timezone
      );
      
      console.log('Generated', times.length, 'times for', dateStr);
      
      times.forEach(scheduledTime => {
        const notifId = 'N_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        schedSheet.appendRow([
          notifId,
          userId,
          alert.id,
          scheduledTime.toISOString(),
          alert.message,
          'false',
          new Date().toISOString()
        ]);
        scheduledCount++;
      });
    });
  });
  
  console.log('Total scheduled notifications:', scheduledCount);
}

// Generate random times within a time window
function generateRandomTimes(frequency, startTime, endTime, dateStr, timezone) {
  const times = [];
  
  // Parse start and end times
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  // Calculate total minutes in window
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const windowMinutes = endMinutes - startMinutes;
  
  if (windowMinutes <= 0 || frequency <= 0) return times;
  
  // Generate random times, ensuring minimum spacing
  const minSpacing = Math.floor(windowMinutes / (frequency + 1));
  const usedSlots = [];
  
  for (let i = 0; i < frequency; i++) {
    let attempts = 0;
    let randomMinute;
    
    do {
      randomMinute = startMinutes + Math.floor(Math.random() * windowMinutes);
      attempts++;
    } while (
      attempts < 50 &&
      usedSlots.some(slot => Math.abs(slot - randomMinute) < Math.min(minSpacing, 15))
    );
    
    usedSlots.push(randomMinute);
    
    // Convert to Date object
    const hour = Math.floor(randomMinute / 60);
    const minute = randomMinute % 60;
    
    // Create date representing LOCAL time, then convert to UTC
    const dateTime = new Date(dateStr + 'T' + 
      String(hour).padStart(2, '0') + ':' + 
      String(minute).padStart(2, '0') + ':00Z'); // Z means UTC
    
    // Adjust from local time to UTC
    // tzOffset is (UTC - Local), so for Helsinki (UTC+2) it's -120
    // To convert local to UTC: add the offset (subtracts the hours)
    const tzOffset = getTimezoneOffset(timezone, dateTime);
    dateTime.setMinutes(dateTime.getMinutes() + tzOffset);
    
    times.push(dateTime);
  }
  
  return times.sort((a, b) => a - b);
}

// Get timezone offset in minutes
function getTimezoneOffset(timezone, date) {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return (utcDate - tzDate) / 60000;
  } catch (e) {
    return 0; // Default to UTC if timezone invalid
  }
}

// Clear unsent schedules for a user
function clearUserSchedules(userId) {
  const sheet = getSheet('ScheduledNotifications');
  const data = sheet.getDataRange().getValues();
  
  // Use string comparison
  const userIdStr = String(userId);
  
  // Find rows to delete (from bottom up to maintain indices)
  const rowsToDelete = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === userIdStr && (data[i][5] === 'false' || data[i][5] === false || data[i][5] === 'FALSE')) {
      rowsToDelete.push(i + 1);
    }
  }
  
  // Delete from bottom up
  rowsToDelete.reverse().forEach(row => {
    sheet.deleteRow(row);
  });
}

// ============================================
// NOTIFICATION DISPATCHER (Called by trigger)
// ============================================

// This function runs every 5 minutes via time-based trigger
function processScheduledNotifications() {
  console.log('processScheduledNotifications running at:', new Date().toISOString());
  
  const sheet = getSheet('ScheduledNotifications');
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  
  console.log('Total notifications in sheet:', data.length - 1);
  
  // Check notifications that should fire within ±3 minutes of now
  const windowMs = 3 * 60 * 1000; // 3 minutes
  let checkedCount = 0;
  let sentCount = 0;
  let expiredCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const notifId = row[0];
    const userId = row[1];
    const alertId = row[2];
    const scheduledTime = new Date(row[3]);
    const message = row[4];
    const sent = row[5] === 'true' || row[5] === true || row[5] === 'TRUE';
    
    if (sent || row[5] === 'expired') continue;
    
    checkedCount++;
    const timeDiff = scheduledTime.getTime() - now.getTime();
    
    // If within window (past or up to 3 min in future)
    if (timeDiff >= -windowMs && timeDiff <= windowMs) {
      console.log('Notification due:', notifId, 'scheduled:', scheduledTime.toISOString(), 'diff:', timeDiff);
      
      // Get user's OneSignal player ID and mindful alerts
      const pushData = getPushSettings(userId);
      const playerId = pushData.pushSettings?.onesignalPlayerId;
      const alerts = pushData.mindfulAlerts || [];
      
      // Find the alert to get its redirect
      const alert = alerts.find(a => a.id === alertId);
      const redirect = alert?.redirect || '';
      
      console.log('User', userId, 'player ID:', playerId, 'redirect:', redirect);
      
      if (playerId) {
        // Send notification with redirect
        const success = sendOneSignalNotification(
          playerId,
          'Clear Ground',
          message,
          redirect
        );
        
        console.log('Send result:', success);
        
        // Mark as sent
        if (success) {
          sheet.getRange(i + 1, 6).setValue('true');
          sentCount++;
        }
      } else {
        console.log('No player ID for user:', userId);
      }
    }
    
    // Clean up old notifications (older than 1 hour)
    if (timeDiff < -60 * 60 * 1000) {
      sheet.getRange(i + 1, 6).setValue('expired');
      expiredCount++;
    }
  }
  
  console.log('Checked:', checkedCount, 'Sent:', sentCount, 'Expired:', expiredCount);
  
  // Generate tomorrow's schedules if needed
  generateNextDaySchedulesIfNeeded();
}

// Send notification via OneSignal API
function sendOneSignalNotification(playerId, title, message, redirect) {
  const apiKey = getOneSignalApiKey();
  
  if (apiKey === 'YOUR_REST_API_KEY_HERE') {
    console.log('OneSignal API key not configured');
    return false;
  }
  
  try {
    // Build URL with redirect parameter if provided
    let url = 'https://my.clearground.org/';
    if (redirect) {
      url += '?redirect=' + encodeURIComponent(redirect);
    }
    
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: [playerId],
      headings: { en: title },
      contents: { en: message },
      url: url
    };
    
    // Add action buttons if redirect is specified
    if (redirect) {
      payload.buttons = [
        { id: 'done', text: 'Done' },
        { id: 'go', text: "Let's go" }
      ];
      payload.web_buttons = [
        { id: 'done', text: 'Done', url: 'https://my.clearground.org/' },
        { id: 'go', text: "Let's go", url: url }
      ];
    }
    
    const response = UrlFetchApp.fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    console.log('OneSignal response:', result);
    
    return result.id !== undefined;
  } catch (e) {
    console.error('OneSignal send error:', e);
    return false;
  }
}

// Send instant notification for a user (called from frontend)
function sendInstantNotification(userId, title, message) {
  console.log('sendInstantNotification called:', userId, title, message);
  
  // Get user's player ID
  const pushData = getPushSettings(userId);
  if (!pushData.pushSettings || !pushData.pushSettings.onesignalPlayerId) {
    console.log('No player ID for user:', userId);
    return { success: false, error: 'No player ID found' };
  }
  
  const playerId = pushData.pushSettings.onesignalPlayerId;
  console.log('Sending to player:', playerId);
  
  const success = sendOneSignalNotification(playerId, title, message);
  
  return { success: success };
}

// Generate next day's schedules
function generateNextDaySchedulesIfNeeded() {
  const pushSheet = getSheet('PushSettings');
  const pushData = pushSheet.getDataRange().getValues();
  
  // Check each user
  for (let i = 1; i < pushData.length; i++) {
    const userId = pushData[i][0];
    const alerts = JSON.parse(pushData[i][2] || '[]');
    const timezone = pushData[i][3] || 'UTC';
    
    if (alerts.length === 0) continue;
    
    // Check if we need to generate schedules
    const schedSheet = getSheet('ScheduledNotifications');
    const schedData = schedSheet.getDataRange().getValues();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = Utilities.formatDate(tomorrow, timezone, 'yyyy-MM-dd');
    
    // Check if user has schedules for tomorrow
    const hasTomorrowSchedules = schedData.some(row => 
      row[1] === userId && 
      row[5] === 'false' &&
      new Date(row[3]).toISOString().startsWith(tomorrowStr)
    );
    
    if (!hasTomorrowSchedules) {
      generateUserSchedules(userId);
    }
  }
}

// ============================================
// STANDARD REMINDERS (Habits, Signal, Shadow)
// ============================================

// Process daily reminders - runs once per hour
function processDailyReminders() {
  const pushSheet = getSheet('PushSettings');
  const pushData = pushSheet.getDataRange().getValues();
  const now = new Date();
  
  console.log('Processing daily reminders at:', now.toISOString());
  
  for (let i = 1; i < pushData.length; i++) {
    const userId = pushData[i][0];
    const settings = JSON.parse(pushData[i][1] || '{}');
    const timezone = pushData[i][3] || 'UTC';
    const playerId = pushData[i][4];
    
    console.log('User', userId, 'settings:', JSON.stringify(settings));
    
    if (!playerId) {
      console.log('User', userId, 'has no player ID, skipping');
      continue;
    }
    
    const currentHour = parseInt(Utilities.formatDate(now, timezone, 'HH'));
    const currentMinute = parseInt(Utilities.formatDate(now, timezone, 'mm'));
    
    console.log('User', userId, 'current time:', currentHour + ':' + currentMinute, 'timezone:', timezone);
    
    // Only send if within first 10 minutes of the hour
    if (currentMinute > 10) {
      console.log('User', userId, 'minute > 10, skipping');
      continue;
    }
    
    // Check habits reminder
    if (settings.habits) {
      const [targetHour] = settings.habitsTime.split(':').map(Number);
      if (currentHour === targetHour) {
        sendOneSignalNotification(playerId, 'Clear Ground', 'Time to check your daily habits ✓');
      }
    }
    
    // Check signal reminder
    if (settings.signal) {
      const [targetHour] = settings.signalTime.split(':').map(Number);
      if (currentHour === targetHour) {
        sendOneSignalNotification(playerId, 'Clear Ground', "Your daily signal is waiting 📡");
      }
    }
    
    // Check shadow reminder
    if (settings.shadow) {
      const [targetHour] = settings.shadowTime.split(':').map(Number);
      if (currentHour === targetHour) {
        sendOneSignalNotification(playerId, 'Clear Ground', 'Time for shadow work ☯');
      }
    }
    
    // Check daily check-in reminder
    if (settings.checkin) {
      const [targetHour] = (settings.checkinTime || '20:00').split(':').map(Number);
      console.log('User', userId, 'check-in enabled, target hour:', targetHour, 'current hour:', currentHour);
      if (currentHour === targetHour) {
        // Check if user already completed check-in today
        const today = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
        const checkinsResult = getCheckins(userId, today, today);
        console.log('User', userId, 'check-ins today:', checkinsResult.checkins?.length || 0);
        if (!checkinsResult.checkins || checkinsResult.checkins.length === 0) {
          console.log('Sending check-in reminder to user', userId);
          sendOneSignalNotification(playerId, 'Clear Ground', '20 seconds to log your vibe ◉');
        }
      }
    } else {
      console.log('User', userId, 'check-in reminder not enabled');
    }
  }
}

// Debug function to check push settings for a user
function debugUserPushSettings(userId) {
  const sheet = getSheet('PushSettings');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      const settings = JSON.parse(data[i][1] || '{}');
      console.log('User push settings for', userId, ':', JSON.stringify(settings, null, 2));
      console.log('Raw settings cell:', data[i][1]);
      console.log('Timezone:', data[i][3]);
      console.log('Player ID:', data[i][4]);
      return { settings, timezone: data[i][3], playerId: data[i][4] };
    }
  }
  console.log('No push settings found for user', userId);
  return null;
}

// Test check-in reminder for a specific user
function testCheckinReminder(userId) {
  const userSettings = debugUserPushSettings(userId);
  if (!userSettings) {
    console.log('No settings found');
    return;
  }
  
  const { settings, timezone, playerId } = userSettings;
  console.log('Check-in enabled:', settings.checkin);
  console.log('Check-in time:', settings.checkinTime);
  
  if (settings.checkin && playerId) {
    console.log('Sending test check-in notification...');
    const result = sendOneSignalNotification(playerId, 'Clear Ground', '20 seconds to log your vibe ◉ (test)');
    console.log('Send result:', result);
    return result;
  } else {
    console.log('Check-in not enabled or no player ID');
    return false;
  }
}

// ============================================
// TRIGGER SETUP (Run once manually)
// ============================================

// Run this function once to set up the time-based triggers
function setupNotificationTriggers() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processScheduledNotifications' ||
        trigger.getHandlerFunction() === 'processDailyReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new triggers
  
  // Run every 5 minutes for mindful alerts (random timing)
  ScriptApp.newTrigger('processScheduledNotifications')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  // Run every hour for standard reminders
  ScriptApp.newTrigger('processDailyReminders')
    .timeBased()
    .everyHours(1)
    .create();
  
  console.log('Notification triggers set up successfully!');
  return { success: true, message: 'Triggers created: 5-min for mindful alerts, hourly for reminders' };
}

// View current triggers
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  return triggers.map(t => ({
    function: t.getHandlerFunction(),
    type: t.getEventType().toString()
  }));
}

// ============================================
// DEBUG/TEST FUNCTIONS
// ============================================

// Migrate/fix corrupted ShadowProgress data
function migrateShadowProgressData() {
  const sheet = getSheet('ShadowProgress');
  const data = sheet.getDataRange().getValues();
  
  console.log('Migrating ShadowProgress data, rows:', data.length - 1);
  
  // Helper to convert comma-separated to JSON array
  function fixArrayData(value) {
    if (!value || value === '[]') return '[]';
    
    const str = String(value).trim();
    
    // Already valid JSON?
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return str;
    } catch (e) {}
    
    // Convert comma-separated to JSON array
    if (str.includes(',') || /^\d+$/.test(str)) {
      const arr = str.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      return JSON.stringify(arr);
    }
    
    return '[]';
  }
  
  // Process each row (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const userId = row[0];
    
    if (!userId) continue;
    
    const fixedRow = [
      userId,
      fixArrayData(row[1]), // integrate_completed
      fixArrayData(row[2]), // integrate_skipped
      fixArrayData(row[3]), // process_completed
      fixArrayData(row[4]), // process_skipped
      '{}', // deep_clean_data - reset since it was corrupted
      new Date().toISOString()
    ];
    
    console.log('Fixing row', i, ':', {
      before: { col1: row[1], col3: row[3], col5: row[5] },
      after: { col1: fixedRow[1], col3: fixedRow[3], col5: fixedRow[5] }
    });
    
    sheet.getRange(i + 1, 1, 1, fixedRow.length).setValues([fixedRow]);
  }
  
  console.log('Migration complete');
  return { success: true, rowsFixed: data.length - 1 };
}

// Clean up duplicate ShadowProgress rows - keep only the one with most progress per user
function cleanupShadowProgressDuplicates() {
  const sheet = getSheet('ShadowProgress');
  const data = sheet.getDataRange().getValues();
  
  console.log('Cleaning up ShadowProgress duplicates, total rows:', data.length - 1);
  
  // Helper to parse array and get length
  function getArrayLength(value) {
    if (!value || value === '[]') return 0;
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (e) {
      // Try comma-separated
      if (String(value).includes(',')) {
        return String(value).split(',').length;
      }
      return 0;
    }
  }
  
  // Group rows by userId, find the best one for each
  const userRows = {};
  for (let i = 1; i < data.length; i++) {
    const userId = String(data[i][0]);
    if (!userId) continue;
    
    const progress = getArrayLength(data[i][1]) + getArrayLength(data[i][3]);
    
    if (!userRows[userId] || progress > userRows[userId].progress) {
      userRows[userId] = {
        rowIndex: i + 1,
        progress: progress,
        data: data[i]
      };
    }
  }
  
  console.log('Unique users found:', Object.keys(userRows).length);
  
  // Get all rows to delete (all except the best one per user)
  const rowsToDelete = [];
  for (let i = 1; i < data.length; i++) {
    const userId = String(data[i][0]);
    if (userId && userRows[userId] && userRows[userId].rowIndex !== i + 1) {
      rowsToDelete.push(i + 1);
    }
  }
  
  console.log('Rows to delete:', rowsToDelete.length);
  
  // Delete from bottom up
  rowsToDelete.sort((a, b) => b - a).forEach(row => {
    sheet.deleteRow(row);
  });
  
  console.log('Cleanup complete');
  return { 
    success: true, 
    usersKept: Object.keys(userRows).length,
    rowsDeleted: rowsToDelete.length 
  };
}

// Clear all scheduled notifications and regenerate with correct timezone
function resetAllSchedules() {
  console.log('Resetting all scheduled notifications...');
  
  // Clear ScheduledNotifications sheet (keep header)
  const schedSheet = getSheet('ScheduledNotifications');
  const lastRow = schedSheet.getLastRow();
  if (lastRow > 1) {
    schedSheet.deleteRows(2, lastRow - 1);
  }
  console.log('Cleared old schedules');
  
  // Regenerate for all users with push settings
  const pushSheet = getSheet('PushSettings');
  const pushData = pushSheet.getDataRange().getValues();
  
  let usersProcessed = 0;
  for (let i = 1; i < pushData.length; i++) {
    const userId = pushData[i][0];
    if (userId) {
      console.log('Regenerating schedules for user:', userId);
      generateUserSchedules(userId);
      usersProcessed++;
    }
  }
  
  // Check results
  const newCount = schedSheet.getLastRow() - 1;
  console.log('Done! Users processed:', usersProcessed, 'New schedules:', newCount);
  
  return { success: true, usersProcessed: usersProcessed, schedulesCreated: newCount };
}

// Test sending a notification (run manually to test)
function testSendNotification() {
  const sheet = getSheet('PushSettings');
  const data = sheet.getDataRange().getValues();
  
  // Find first user with a player ID
  for (let i = 1; i < data.length; i++) {
    const playerId = data[i][4]; // onesignal_player_id column
    if (playerId && playerId.length > 10) {
      console.log('Sending test notification to player:', playerId);
      const result = sendOneSignalNotification(
        playerId,
        'Test Notification',
        'If you see this, push notifications are working!'
      );
      console.log('Result:', result);
      return { success: result, playerId: playerId };
    }
  }
  
  return { error: 'No user with player ID found' };
}

// Debug: View all push settings
function debugPushSettings() {
  const sheet = getSheet('PushSettings');
  const data = sheet.getDataRange().getValues();
  
  console.log('PushSettings rows:', data.length - 1);
  
  for (let i = 1; i < data.length; i++) {
    console.log('Row', i, ':', {
      userId: data[i][0],
      settings: data[i][1],
      mindfulAlerts: data[i][2],
      timezone: data[i][3],
      playerId: data[i][4],
      updatedAt: data[i][5]
    });
  }
  
  return { rows: data.length - 1 };
}

// Debug: Manually trigger schedule generation for a user
function debugGenerateSchedules() {
  const sheet = getSheet('PushSettings');
  const data = sheet.getDataRange().getValues();
  
  if (data.length > 1) {
    const userId = data[1][0];
    console.log('Generating schedules for:', userId);
    generateUserSchedules(userId);
    
    // Check what was created
    const schedSheet = getSheet('ScheduledNotifications');
    const schedData = schedSheet.getDataRange().getValues();
    console.log('Scheduled notifications:', schedData.length - 1);
    
    return { userId: userId, scheduledCount: schedData.length - 1 };
  }
  
  return { error: 'No users found' };
}
