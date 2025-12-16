// Clear Ground - Google Apps Script Backend
// Version 3.2 - Added Attunements support

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
