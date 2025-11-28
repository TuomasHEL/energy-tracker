// Energy Tracker PWA - Main Application
// Version 1.0 - MVP

// ============================================
// CONFIGURATION
// ============================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxb1VSLiVVu72_HsRAB_CaZn0TQjayYaWB2YKNTaTu5g6JhGKHzNRy-jf3riMMnVS80/exec';

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    currentUser: null,
    users: [],
    markers: [],
    categories: [],
    sessions: [],
    progress: [],
    playlists: [],
    
    // Timer state
    timer: {
        isRunning: false,
        isPaused: false,
        startTime: null,
        duration: 0,
        remaining: 0,
        marker: null,
        energyType: '',
        intensity: 'medium',
        notes: '',
        interval: null
    },
    
    // Assessment state
    assessment: {
        marker: null,
        previousValue: null
    },
    
    // Playlist runner state
    playlistRunner: {
        isRunning: false,
        playlist: null,
        currentIndex: 0,
        itemTimer: null
    }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
    showLoading();
    
    try {
        // Load users first
        await loadUsers();
        
        // Set current user from localStorage or default to first
        const savedUserId = localStorage.getItem('currentUserId');
        if (savedUserId && state.users.find(u => u.user_id === savedUserId)) {
            state.currentUser = state.users.find(u => u.user_id === savedUserId);
        } else if (state.users.length > 0) {
            state.currentUser = state.users[0];
        }
        
        // Populate user selector
        populateUserSelector();
        
        // Load markers
        await loadMarkers();
        
        // Load initial data for current user
        if (state.currentUser) {
            await loadUserData();
        }
        
        // Setup event listeners
        setupEventListeners();
        
        // Update dashboard
        updateDashboard();
        
    } catch (error) {
        console.error('Init error:', error);
        showToast('Failed to initialize app', 'error');
    }
    
    hideLoading();
}

// ============================================
// API FUNCTIONS
// ============================================

async function apiCall(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    }
    
    try {
        const response = await fetch(url.toString());
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
    } catch (error) {
        console.error(`API Error (${action}):`, error);
        throw error;
    }
}

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

async function loadUsers() {
    const data = await apiCall('getUsers');
    state.users = data.users.filter(u => u.status === 'active');
}

async function loadMarkers() {
    const data = await apiCall('getMarkers');
    state.markers = data.markers;
    
    // Extract unique categories
    const categorySet = new Set(state.markers.map(m => m.category));
    state.categories = Array.from(categorySet).sort();
    
    // Populate category filters
    populateCategoryFilters();
}

async function loadUserData() {
    if (!state.currentUser) return;
    
    // Load sessions
    const sessionsData = await apiCall('getSessions', { 
        userId: state.currentUser.user_id,
        limit: 50
    });
    state.sessions = sessionsData.sessions;
    
    // Load progress
    const progressData = await apiCall('getProgress', {
        userId: state.currentUser.user_id,
        limit: 100
    });
    state.progress = progressData.progress;
    
    // Load playlists
    const playlistsData = await apiCall('getPlaylists', {
        userId: state.currentUser.user_id
    });
    state.playlists = playlistsData.playlists;
}

// ============================================
// UI POPULATION FUNCTIONS
// ============================================

function populateUserSelector() {
    const select = document.getElementById('currentUser');
    select.innerHTML = state.users.map(u => 
        `<option value="${u.user_id}" ${state.currentUser?.user_id === u.user_id ? 'selected' : ''}>${u.name}</option>`
    ).join('');
}

function populateCategoryFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const markerCategorySelect = document.getElementById('newMarkerCategory');
    
    const options = '<option value="">All Categories</option>' + 
        state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    categoryFilter.innerHTML = options;
    
    // For new marker modal
    markerCategorySelect.innerHTML = 
        '<option value="Custom">Custom</option>' +
        state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    // Populate timer marker select
    populateTimerMarkerSelect();
    
    // Populate progress filter
    populateProgressFilter();
}

function populateTimerMarkerSelect() {
    const select = document.getElementById('timerMarkerSelect');
    
    let options = '<option value="">Select marker...</option>';
    options += '<option value="custom">Custom / General</option>';
    
    state.categories.forEach(category => {
        const categoryMarkers = state.markers.filter(m => m.category === category);
        if (categoryMarkers.length > 0) {
            options += `<optgroup label="${category}">`;
            categoryMarkers.forEach(m => {
                options += `<option value="${m.marker_id}">${m.name}</option>`;
            });
            options += '</optgroup>';
        }
    });
    
    select.innerHTML = options;
}

function populateProgressFilter() {
    const select = document.getElementById('progressMarkerFilter');
    
    let options = '<option value="">All Markers</option>';
    state.markers.forEach(m => {
        options += `<option value="${m.marker_id}">${m.name}</option>`;
    });
    
    select.innerHTML = options;
}

// ============================================
// VIEW MANAGEMENT
// ============================================

function showView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show target view
    document.getElementById(`view${capitalize(viewName)}`).classList.add('active');
    
    // Update nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    // Load view-specific data
    switch(viewName) {
        case 'track':
            renderMarkersList();
            break;
        case 'history':
            renderHistory();
            break;
        case 'settings':
            renderSettings();
            break;
        case 'playlists':
            renderPlaylists();
            break;
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {
    // Stats
    document.getElementById('statTotalMarkers').textContent = state.markers.length;
    
    // Today's sessions
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = state.sessions.filter(s => 
        s.start_time && s.start_time.startsWith(today)
    ).length;
    document.getElementById('statTodaySessions').textContent = todaySessions;
    
    // Total time (last 30 days)
    const totalMinutes = state.sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    document.getElementById('statTotalTime').textContent = `${hours}h ${mins}m`;
    
    // Recent activity
    renderRecentActivity();
}

function renderRecentActivity() {
    const container = document.getElementById('recentActivityList');
    const recentItems = [...state.sessions, ...state.progress]
        .sort((a, b) => {
            const dateA = new Date(a.timestamp || a.start_time);
            const dateB = new Date(b.timestamp || b.start_time);
            return dateB - dateA;
        })
        .slice(0, 5);
    
    if (recentItems.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }
    
    container.innerHTML = recentItems.map(item => {
        const isSession = !!item.session_id;
        const marker = state.markers.find(m => m.marker_id === item.marker_id);
        const name = marker?.name || item.marker_id || 'General';
        const time = formatRelativeTime(item.timestamp || item.start_time);
        
        if (isSession) {
            return `
                <div class="activity-item">
                    <div>
                        <div class="activity-name">⏱ ${name}</div>
                        <div class="activity-details">${item.duration_minutes || 0} min session</div>
                    </div>
                    <div class="activity-time">${time}</div>
                </div>
            `;
        } else {
            return `
                <div class="activity-item">
                    <div>
                        <div class="activity-name">◎ ${name}</div>
                        <div class="activity-details">Tracked: ${item.sensed_value}%</div>
                    </div>
                    <div class="activity-time">${time}</div>
                </div>
            `;
        }
    }).join('');
}

// ============================================
// MARKERS & TRACKING
// ============================================

function renderMarkersList() {
    const container = document.getElementById('markersList');
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    let filteredMarkers = state.markers;
    if (categoryFilter) {
        filteredMarkers = state.markers.filter(m => m.category === categoryFilter);
    }
    
    if (filteredMarkers.length === 0) {
        container.innerHTML = '<p class="empty-state">No markers found</p>';
        return;
    }
    
    // Group by category
    const grouped = {};
    filteredMarkers.forEach(m => {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
    });
    
    let html = '';
    for (const [category, markers] of Object.entries(grouped)) {
        html += `<h3 class="category-header" style="font-size: 0.875rem; color: var(--text-muted); margin: var(--space-md) 0 var(--space-sm);">${category}</h3>`;
        
        markers.forEach(marker => {
            const latestProgress = getLatestProgressForMarker(marker.marker_id);
            const value = latestProgress?.sensed_value;
            
            html += `
                <div class="marker-card ${!value ? 'no-value' : ''}" onclick="openAssessment('${marker.marker_id}')">
                    <div class="marker-header">
                        <span class="marker-name">${marker.name}</span>
                        <span class="marker-value">${value !== undefined ? value + '%' : '—'}</span>
                    </div>
                    <div class="marker-category">${marker.subcategory || ''}</div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

function getLatestProgressForMarker(markerId) {
    return state.progress.find(p => p.marker_id === markerId);
}

// ============================================
// BLIND ASSESSMENT
// ============================================

function openAssessment(markerId) {
    const marker = state.markers.find(m => m.marker_id === markerId);
    if (!marker) return;
    
    state.assessment.marker = marker;
    
    // Get previous value
    const latestProgress = getLatestProgressForMarker(markerId);
    state.assessment.previousValue = latestProgress?.sensed_value || null;
    
    // Update modal
    document.getElementById('assessmentMarkerName').textContent = marker.name;
    document.getElementById('assessmentDescription').textContent = marker.description || '';
    
    // Reset slider to 50
    document.getElementById('sensedValue').value = 50;
    document.getElementById('sensedValueDisplay').textContent = '50';
    document.getElementById('assessmentNotes').value = '';
    
    // Hide previous value reveal
    document.getElementById('previousValueReveal').classList.add('hidden');
    document.getElementById('saveAssessmentBtn').classList.remove('hidden');
    document.getElementById('doneAssessmentBtn').classList.add('hidden');
    
    // Show modal
    document.getElementById('assessmentModal').classList.add('active');
}

function closeAssessmentModal() {
    document.getElementById('assessmentModal').classList.remove('active');
    state.assessment.marker = null;
    state.assessment.previousValue = null;
}

async function saveAssessment() {
    if (!state.assessment.marker || !state.currentUser) return;
    
    const sensedValue = parseInt(document.getElementById('sensedValue').value);
    const notes = document.getElementById('assessmentNotes').value;
    const blindMode = document.getElementById('blindModeToggle').checked;
    
    showLoading();
    
    try {
        await apiCall('saveProgress', {
            userId: state.currentUser.user_id,
            markerId: state.assessment.marker.marker_id,
            previousValue: state.assessment.previousValue || '',
            sensedValue: sensedValue,
            notes: notes
        });
        
        // Add to local state
        state.progress.unshift({
            user_id: state.currentUser.user_id,
            marker_id: state.assessment.marker.marker_id,
            previous_value: state.assessment.previousValue,
            sensed_value: sensedValue,
            notes: notes,
            timestamp: new Date().toISOString()
        });
        
        // If blind mode, reveal previous value
        if (blindMode && state.assessment.previousValue !== null) {
            document.getElementById('revealedPreviousValue').textContent = state.assessment.previousValue + '%';
            document.getElementById('previousValueReveal').classList.remove('hidden');
            document.getElementById('saveAssessmentBtn').classList.add('hidden');
            document.getElementById('doneAssessmentBtn').classList.remove('hidden');
        } else {
            closeAssessmentModal();
            showToast('Assessment saved!', 'success');
        }
        
        // Update UI
        renderMarkersList();
        updateDashboard();
        
    } catch (error) {
        showToast('Failed to save assessment', 'error');
    }
    
    hideLoading();
}

// ============================================
// TIMER
// ============================================

function setDuration(minutes) {
    // Update preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Set custom duration input
    document.getElementById('customDuration').value = minutes;
}

function startTimer() {
    const markerSelect = document.getElementById('timerMarkerSelect');
    const markerId = markerSelect.value;
    const customWork = document.getElementById('customWorkName').value;
    const duration = parseInt(document.getElementById('customDuration').value);
    const energyType = document.getElementById('energyType').value;
    const intensity = document.querySelector('.intensity-btn.active')?.dataset.intensity || 'medium';
    const notes = document.getElementById('timerNotes').value;
    
    if (!markerId && !customWork) {
        showToast('Please select what you\'re working on', 'error');
        return;
    }
    
    if (!duration || duration < 1) {
        showToast('Please set a duration', 'error');
        return;
    }
    
    // Get marker name
    let targetName = customWork || 'General';
    if (markerId && markerId !== 'custom') {
        const marker = state.markers.find(m => m.marker_id === markerId);
        targetName = marker?.name || markerId;
    }
    
    // Set timer state
    state.timer = {
        isRunning: true,
        isPaused: false,
        startTime: new Date(),
        duration: duration * 60, // Convert to seconds
        remaining: duration * 60,
        marker: markerId !== 'custom' ? markerId : null,
        customWork: customWork,
        targetName: targetName,
        energyType: energyType,
        intensity: intensity,
        notes: notes,
        interval: null
    };
    
    // Update UI
    document.getElementById('timerSetup').classList.add('hidden');
    document.getElementById('timerActive').classList.remove('hidden');
    
    document.getElementById('timerTargetName').textContent = targetName;
    document.getElementById('timerEnergyType').textContent = energyType || '—';
    document.getElementById('timerIntensity').textContent = capitalize(intensity);
    document.getElementById('timerNotesDisplay').textContent = notes;
    
    // Start countdown
    updateTimerDisplay();
    state.timer.interval = setInterval(timerTick, 1000);
}

function timerTick() {
    if (!state.timer.isRunning || state.timer.isPaused) return;
    
    state.timer.remaining--;
    updateTimerDisplay();
    
    if (state.timer.remaining <= 0) {
        endTimer(true);
    }
}

function updateTimerDisplay() {
    const remaining = Math.max(0, state.timer.remaining);
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    document.getElementById('timerCountdown').textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    
    const progress = ((state.timer.duration - remaining) / state.timer.duration) * 100;
    document.getElementById('timerProgressBar').style.width = `${progress}%`;
    document.getElementById('timerPercentage').textContent = `${Math.round(progress)}%`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function pauseTimer() {
    state.timer.isPaused = !state.timer.isPaused;
    const btn = document.getElementById('pauseBtn');
    
    if (state.timer.isPaused) {
        btn.innerHTML = '<span class="btn-icon">▶</span> Resume';
    } else {
        btn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
    }
}

async function endTimer(completed = false) {
    clearInterval(state.timer.interval);
    
    const actualDuration = state.timer.duration - state.timer.remaining;
    const durationMinutes = Math.round(actualDuration / 60);
    
    if (durationMinutes > 0 && state.currentUser) {
        showLoading();
        
        try {
            await apiCall('saveSession', {
                userId: state.currentUser.user_id,
                markerId: state.timer.marker || '',
                startTime: state.timer.startTime.toISOString(),
                endTime: new Date().toISOString(),
                durationMinutes: durationMinutes,
                energyType: state.timer.energyType,
                intensity: state.timer.intensity,
                notes: state.timer.notes
            });
            
            // Add to local state
            state.sessions.unshift({
                user_id: state.currentUser.user_id,
                marker_id: state.timer.marker,
                start_time: state.timer.startTime.toISOString(),
                end_time: new Date().toISOString(),
                duration_minutes: durationMinutes,
                energy_type: state.timer.energyType,
                intensity: state.timer.intensity,
                notes: state.timer.notes
            });
            
            showToast(`Session saved: ${durationMinutes} minutes`, 'success');
            updateDashboard();
            
        } catch (error) {
            showToast('Failed to save session', 'error');
        }
        
        hideLoading();
    }
    
    // Reset timer
    resetTimer();
}

function resetTimer() {
    state.timer = {
        isRunning: false,
        isPaused: false,
        startTime: null,
        duration: 0,
        remaining: 0,
        marker: null,
        energyType: '',
        intensity: 'medium',
        notes: '',
        interval: null
    };
    
    document.getElementById('timerSetup').classList.remove('hidden');
    document.getElementById('timerActive').classList.add('hidden');
    
    // Reset form
    document.getElementById('timerMarkerSelect').value = '';
    document.getElementById('customWorkName').value = '';
    document.getElementById('customDuration').value = '';
    document.getElementById('energyType').value = '';
    document.getElementById('timerNotes').value = '';
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.intensity-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.intensity === 'medium');
    });
}

// ============================================
// PLAYLISTS
// ============================================

function renderPlaylists() {
    const container = document.getElementById('playlistsList');
    
    if (state.playlists.length === 0) {
        container.innerHTML = '<p class="empty-state">No playlists yet. Create one!</p>';
        return;
    }
    
    container.innerHTML = state.playlists.map(pl => {
        let items = [];
        try {
            items = JSON.parse(pl.items_json);
        } catch(e) {}
        
        return `
            <div class="playlist-card">
                <div class="playlist-card-header">
                    <span class="playlist-card-name">${pl.name}</span>
                    <span class="playlist-card-duration">${formatDuration(pl.total_duration_minutes)}</span>
                </div>
                <div class="playlist-card-items">${items.length} items</div>
                <div class="playlist-card-actions">
                    <button class="btn small primary" onclick="runPlaylist('${pl.playlist_id}')">▶ Run</button>
                    <button class="btn small secondary" onclick="editPlaylist('${pl.playlist_id}')">Edit</button>
                    <button class="btn small danger" onclick="deletePlaylistConfirm('${pl.playlist_id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function showCreatePlaylist() {
    document.getElementById('playlistModalTitle').textContent = 'Create Playlist';
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistItemsList').innerHTML = '';
    
    // Add first item
    addPlaylistItem();
    
    document.getElementById('playlistModal').classList.add('active');
    document.getElementById('playlistModal').dataset.editId = '';
}

function closePlaylistModal() {
    document.getElementById('playlistModal').classList.remove('active');
}

function addPlaylistItem() {
    const container = document.getElementById('playlistItemsList');
    const itemId = Date.now();
    
    const html = `
        <div class="playlist-item" data-item-id="${itemId}">
            <select class="playlist-item-marker" onchange="updatePlaylistTotal()">
                <option value="">Select...</option>
                <option value="custom">Custom</option>
                ${state.markers.map(m => `<option value="${m.marker_id}">${m.name}</option>`).join('')}
            </select>
            <input type="number" class="playlist-item-duration" placeholder="min" min="1" onchange="updatePlaylistTotal()">
            <button class="remove-item" onclick="removePlaylistItem(${itemId})">×</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
    updatePlaylistTotal();
}

function removePlaylistItem(itemId) {
    const item = document.querySelector(`.playlist-item[data-item-id="${itemId}"]`);
    if (item) item.remove();
    updatePlaylistTotal();
}

function updatePlaylistTotal() {
    const items = document.querySelectorAll('.playlist-item');
    let total = 0;
    
    items.forEach(item => {
        const duration = parseInt(item.querySelector('.playlist-item-duration').value) || 0;
        total += duration;
    });
    
    document.getElementById('playlistTotalDuration').textContent = formatDuration(total);
}

async function savePlaylist() {
    const name = document.getElementById('playlistName').value.trim();
    if (!name) {
        showToast('Please enter a playlist name', 'error');
        return;
    }
    
    const itemElements = document.querySelectorAll('.playlist-item');
    const items = [];
    let totalDuration = 0;
    
    itemElements.forEach(el => {
        const markerId = el.querySelector('.playlist-item-marker').value;
        const duration = parseInt(el.querySelector('.playlist-item-duration').value) || 0;
        
        if (markerId && duration > 0) {
            const marker = state.markers.find(m => m.marker_id === markerId);
            items.push({
                marker_id: markerId,
                name: marker?.name || markerId,
                duration: duration
            });
            totalDuration += duration;
        }
    });
    
    if (items.length === 0) {
        showToast('Please add at least one item', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const editId = document.getElementById('playlistModal').dataset.editId;
        
        if (editId) {
            await apiCall('updatePlaylist', {
                playlistId: editId,
                name: name,
                itemsJson: JSON.stringify(items),
                totalDuration: totalDuration
            });
            
            // Update local state
            const idx = state.playlists.findIndex(p => p.playlist_id === editId);
            if (idx >= 0) {
                state.playlists[idx].name = name;
                state.playlists[idx].items_json = JSON.stringify(items);
                state.playlists[idx].total_duration_minutes = totalDuration;
            }
        } else {
            const result = await apiCall('savePlaylist', {
                userId: state.currentUser.user_id,
                name: name,
                itemsJson: JSON.stringify(items),
                totalDuration: totalDuration
            });
            
            // Add to local state
            state.playlists.push({
                playlist_id: result.playlistId,
                user_id: state.currentUser.user_id,
                name: name,
                items_json: JSON.stringify(items),
                total_duration_minutes: totalDuration,
                times_used: 0
            });
        }
        
        closePlaylistModal();
        renderPlaylists();
        showToast('Playlist saved!', 'success');
        
    } catch (error) {
        showToast('Failed to save playlist', 'error');
    }
    
    hideLoading();
}

function editPlaylist(playlistId) {
    const playlist = state.playlists.find(p => p.playlist_id === playlistId);
    if (!playlist) return;
    
    document.getElementById('playlistModalTitle').textContent = 'Edit Playlist';
    document.getElementById('playlistName').value = playlist.name;
    document.getElementById('playlistModal').dataset.editId = playlistId;
    
    let items = [];
    try {
        items = JSON.parse(playlist.items_json);
    } catch(e) {}
    
    const container = document.getElementById('playlistItemsList');
    container.innerHTML = '';
    
    items.forEach(item => {
        const itemId = Date.now() + Math.random();
        container.insertAdjacentHTML('beforeend', `
            <div class="playlist-item" data-item-id="${itemId}">
                <select class="playlist-item-marker" onchange="updatePlaylistTotal()">
                    <option value="">Select...</option>
                    <option value="custom" ${item.marker_id === 'custom' ? 'selected' : ''}>Custom</option>
                    ${state.markers.map(m => `<option value="${m.marker_id}" ${m.marker_id === item.marker_id ? 'selected' : ''}>${m.name}</option>`).join('')}
                </select>
                <input type="number" class="playlist-item-duration" placeholder="min" min="1" value="${item.duration}" onchange="updatePlaylistTotal()">
                <button class="remove-item" onclick="removePlaylistItem('${itemId}')">×</button>
            </div>
        `);
    });
    
    updatePlaylistTotal();
    document.getElementById('playlistModal').classList.add('active');
}

async function deletePlaylistConfirm(playlistId) {
    if (!confirm('Delete this playlist?')) return;
    
    showLoading();
    
    try {
        await apiCall('deletePlaylist', { playlistId: playlistId });
        
        state.playlists = state.playlists.filter(p => p.playlist_id !== playlistId);
        renderPlaylists();
        showToast('Playlist deleted', 'success');
        
    } catch (error) {
        showToast('Failed to delete playlist', 'error');
    }
    
    hideLoading();
}

function runPlaylist(playlistId) {
    const playlist = state.playlists.find(p => p.playlist_id === playlistId);
    if (!playlist) return;
    
    let items = [];
    try {
        items = JSON.parse(playlist.items_json);
    } catch(e) {
        showToast('Invalid playlist data', 'error');
        return;
    }
    
    if (items.length === 0) {
        showToast('Playlist is empty', 'error');
        return;
    }
    
    state.playlistRunner = {
        isRunning: true,
        playlist: playlist,
        items: items,
        currentIndex: 0,
        itemTimer: null
    };
    
    // Show runner UI
    document.getElementById('playlistsList').classList.add('hidden');
    document.getElementById('playlistRunner').classList.remove('hidden');
    
    document.getElementById('runningPlaylistName').textContent = playlist.name;
    document.getElementById('runnerTotalItems').textContent = items.length;
    
    startPlaylistItem();
}

function startPlaylistItem() {
    const runner = state.playlistRunner;
    const item = runner.items[runner.currentIndex];
    
    document.getElementById('runnerCurrentItem').textContent = runner.currentIndex + 1;
    document.getElementById('runnerItemName').textContent = item.name;
    
    // Render queue
    const queue = runner.items.slice(runner.currentIndex + 1);
    document.getElementById('runnerQueue').innerHTML = queue.map(q => `
        <div class="runner-queue-item">
            <span>${q.name}</span>
            <span>${q.duration}m</span>
        </div>
    `).join('');
    
    // Start item timer
    runner.itemRemaining = item.duration * 60;
    updatePlaylistItemTimer();
    runner.itemTimer = setInterval(() => {
        runner.itemRemaining--;
        updatePlaylistItemTimer();
        
        if (runner.itemRemaining <= 0) {
            clearInterval(runner.itemTimer);
            nextPlaylistItem();
        }
    }, 1000);
}

function updatePlaylistItemTimer() {
    const remaining = state.playlistRunner.itemRemaining;
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    document.getElementById('runnerItemTimer').textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function skipPlaylistItem() {
    clearInterval(state.playlistRunner.itemTimer);
    nextPlaylistItem();
}

function nextPlaylistItem() {
    const runner = state.playlistRunner;
    
    // Save current session (simplified - just log it)
    const currentItem = runner.items[runner.currentIndex];
    console.log('Completed:', currentItem.name);
    
    runner.currentIndex++;
    
    if (runner.currentIndex >= runner.items.length) {
        // Playlist complete
        stopPlaylist();
        showToast('Playlist completed!', 'success');
        return;
    }
    
    startPlaylistItem();
}

function stopPlaylist() {
    clearInterval(state.playlistRunner.itemTimer);
    
    state.playlistRunner = {
        isRunning: false,
        playlist: null,
        items: [],
        currentIndex: 0,
        itemTimer: null
    };
    
    document.getElementById('playlistRunner').classList.add('hidden');
    document.getElementById('playlistsList').classList.remove('hidden');
}

// ============================================
// HISTORY
// ============================================

function showHistoryTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === tab);
    });
    
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`history${capitalize(tab)}Tab`).classList.add('active');
    
    if (tab === 'sessions') {
        renderSessionsHistory();
    } else {
        renderProgressHistory();
    }
}

function renderHistory() {
    renderSessionsHistory();
}

function renderSessionsHistory() {
    const container = document.getElementById('sessionsHistoryList');
    
    if (state.sessions.length === 0) {
        container.innerHTML = '<p class="empty-state">No sessions yet</p>';
        return;
    }
    
    container.innerHTML = state.sessions.map(s => {
        const marker = state.markers.find(m => m.marker_id === s.marker_id);
        const name = marker?.name || s.marker_id || 'General';
        const date = formatDate(s.start_time);
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-item-name">${name}</span>
                    <span class="history-item-date">${date}</span>
                </div>
                <div class="history-item-details">
                    ${s.duration_minutes} min • ${s.energy_type || 'No type'} • ${s.intensity || 'medium'}
                    ${s.notes ? `<br><em>${s.notes}</em>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderProgressHistory() {
    const container = document.getElementById('progressHistoryList');
    const markerFilter = document.getElementById('progressMarkerFilter').value;
    
    let filtered = state.progress;
    if (markerFilter) {
        filtered = state.progress.filter(p => p.marker_id === markerFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">No progress records</p>';
        return;
    }
    
    container.innerHTML = filtered.map(p => {
        const marker = state.markers.find(m => m.marker_id === p.marker_id);
        const name = marker?.name || p.marker_id;
        const date = formatDate(p.timestamp);
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-item-name">${name}</span>
                    <span class="history-item-date">${date}</span>
                </div>
                <div class="history-item-details">
                    ${p.previous_value ? `${p.previous_value}% → ` : ''}${p.sensed_value}%
                    ${p.notes ? `<br><em>${p.notes}</em>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// SETTINGS
// ============================================

function renderSettings() {
    const container = document.getElementById('usersList');
    
    container.innerHTML = state.users.map(u => `
        <div class="user-item">
            <div>
                <div class="user-item-name">${u.name}</div>
                <div class="user-item-date">Added: ${u.created_date}</div>
            </div>
            ${u.user_id !== state.currentUser?.user_id ? 
                `<button class="btn tiny danger" onclick="archiveUser('${u.user_id}')">Archive</button>` : 
                '<span style="color: var(--accent-secondary); font-size: 0.75rem;">Active</span>'
            }
        </div>
    `).join('');
}

function showAddUserModal() {
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserNotes').value = '';
    document.getElementById('addUserModal').classList.add('active');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('active');
}

async function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    const notes = document.getElementById('newUserNotes').value.trim();
    
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const result = await apiCall('addUser', { name, notes });
        
        state.users.push({
            user_id: result.userId,
            name: name,
            notes: notes,
            status: 'active',
            created_date: new Date().toISOString().split('T')[0]
        });
        
        populateUserSelector();
        renderSettings();
        closeAddUserModal();
        showToast('User added!', 'success');
        
    } catch (error) {
        showToast('Failed to add user', 'error');
    }
    
    hideLoading();
}

async function archiveUser(userId) {
    if (!confirm('Archive this user?')) return;
    
    showLoading();
    
    try {
        await apiCall('updateUser', { userId, status: 'archived' });
        
        state.users = state.users.filter(u => u.user_id !== userId);
        populateUserSelector();
        renderSettings();
        showToast('User archived', 'success');
        
    } catch (error) {
        showToast('Failed to archive user', 'error');
    }
    
    hideLoading();
}

function showAddMarkerModal() {
    document.getElementById('newMarkerName').value = '';
    document.getElementById('newMarkerDescription').value = '';
    document.getElementById('newMarkerCategory').value = 'Custom';
    document.getElementById('addMarkerModal').classList.add('active');
}

function closeAddMarkerModal() {
    document.getElementById('addMarkerModal').classList.remove('active');
}

async function addMarker() {
    const category = document.getElementById('newMarkerCategory').value;
    const name = document.getElementById('newMarkerName').value.trim();
    const description = document.getElementById('newMarkerDescription').value.trim();
    
    if (!name) {
        showToast('Please enter a marker name', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const result = await apiCall('addMarker', {
            category,
            subcategory: '',
            name,
            description
        });
        
        state.markers.push({
            marker_id: result.markerId,
            category: category,
            subcategory: '',
            name: name,
            description: description,
            measurement_type: 'percentage',
            is_custom: true,
            status: 'active'
        });
        
        populateCategoryFilters();
        closeAddMarkerModal();
        showToast('Marker added!', 'success');
        
    } catch (error) {
        showToast('Failed to add marker', 'error');
    }
    
    hideLoading();
}

function exportData() {
    const data = {
        user: state.currentUser,
        progress: state.progress,
        sessions: state.sessions,
        playlists: state.playlists,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
}

async function syncData() {
    showLoading();
    
    try {
        await loadUserData();
        updateDashboard();
        showToast('Data synced!', 'success');
    } catch (error) {
        showToast('Sync failed', 'error');
    }
    
    hideLoading();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // User selector
    document.getElementById('currentUser').addEventListener('change', async (e) => {
        const userId = e.target.value;
        state.currentUser = state.users.find(u => u.user_id === userId);
        localStorage.setItem('currentUserId', userId);
        
        showLoading();
        await loadUserData();
        updateDashboard();
        hideLoading();
    });
    
    // Category filter
    document.getElementById('categoryFilter').addEventListener('change', () => {
        renderMarkersList();
    });
    
    // Sensed value slider
    document.getElementById('sensedValue').addEventListener('input', (e) => {
        document.getElementById('sensedValueDisplay').textContent = e.target.value;
    });
    
    // Timer marker select (show/hide custom input)
    document.getElementById('timerMarkerSelect').addEventListener('change', (e) => {
        const customInput = document.getElementById('customWorkInput');
        customInput.classList.toggle('hidden', e.target.value !== 'custom');
    });
    
    // Intensity buttons
    document.querySelectorAll('.intensity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Progress marker filter
    document.getElementById('progressMarkerFilter').addEventListener('change', () => {
        renderProgressHistory();
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return formatDate(dateStr);
}

function formatDuration(minutes) {
    if (!minutes) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    });
}
