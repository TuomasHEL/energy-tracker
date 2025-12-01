// Clear Ground - Main Application
// Version 3.0 - Visual Redesign

// ============================================
// CONFIGURATION
// ============================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxb1VSLiVVu72_HsRAB_CaZn0TQjayYaWB2YKNTaTu5g6JhGKHzNRy-jf3riMMnVS80/exec';

// Foundations markers (for special filter)
const FOUNDATIONS_MARKERS = [
    'LOC',
    'Chakra System Overall',
    'Meridian System Overall', 
    'Nadi System Overall',
    '13 Bhumis'
];

// Default transmissions
const DEFAULT_TRANSMISSIONS = [
    'VortexHealing',
    'VortexHealing Highest',
    'Reiki',
    'Meditation',
    'Breathwork',
    'RASA',
    'Kundalini',
    'Pranic Healing'
];

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
    
    // Settings
    settings: {
        soundEnabled: false,
        vibrationEnabled: false,
        transmissions: [...DEFAULT_TRANSMISSIONS],
        collapsedCategories: {}
    },
    
    // Timer state
    timer: {
        isRunning: false,
        isPaused: false,
        startTime: null,
        endTime: null,
        duration: 0,
        remaining: 0,
        marker: null,
        customWork: '',
        targetName: '',
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
        isPaused: false,
        playlist: null,
        items: [],
        currentIndex: 0,
        itemTimer: null,
        itemEndTime: null,
        itemRemaining: 0,
        pausedAt: null
    },
    
    // Audio context for sounds
    audioContext: null,
    notificationPermission: 'default'
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Start background animation immediately
    initBackgroundAnimation();
    
    console.log('App init started');
    
    try {
        // Load settings
        loadSettings();
        console.log('Settings loaded');
        
        // Initialize audio context
        initAudio();
        
        // Request notification permission
        await requestNotificationPermission();
        
        // Load users first
        await loadUsers();
        console.log('Users loaded:', state.users.length);
        
        // Set current user from localStorage or default to first
        const savedUserId = localStorage.getItem('currentUserId');
        if (savedUserId && state.users.find(u => u.user_id === savedUserId)) {
            state.currentUser = state.users.find(u => u.user_id === savedUserId);
        } else if (state.users.length > 0) {
            state.currentUser = state.users[0];
        }
        console.log('Current user:', state.currentUser?.user_id);
        
        // Populate user selector
        populateUserSelector();
        
        // Load markers
        await loadMarkers();
        console.log('Markers loaded:', state.markers?.length);
        
        // Load initial data for current user
        if (state.currentUser) {
            await loadUserData();
            console.log('User data loaded - sessions:', state.sessions?.length, 'progress:', state.progress?.length, 'playlists:', state.playlists?.length);
        }
        
        // Restore timer if it was running
        restoreTimerState();
        
        // Restore playlist runner if it was running
        restorePlaylistState();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup visibility change handler for background
        setupVisibilityHandler();
        
        // Update dashboard
        updateDashboard();
        
        // Apply settings to UI
        applySettingsToUI();
        
        // Populate transmissions dropdown
        populateTransmissionsDropdown();
        
        // Render transmissions list in settings
        renderTransmissionsList();
        
        console.log('App init completed successfully');
        
    } catch (error) {
        console.error('Init error:', error);
        showToast('Failed to initialize app', 'error');
    }
    
    hideLoading();
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

function loadSettings() {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.settings = { ...state.settings, ...parsed };
            // Ensure transmissions array exists
            if (!state.settings.transmissions || !Array.isArray(state.settings.transmissions)) {
                state.settings.transmissions = [...DEFAULT_TRANSMISSIONS];
            }
            // Ensure collapsedCategories exists
            if (!state.settings.collapsedCategories) {
                state.settings.collapsedCategories = {};
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

function saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(state.settings));
}

function saveSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
    showToast(`${key === 'soundEnabled' ? 'Sound' : 'Vibration'} ${value ? 'enabled' : 'disabled'}`, 'success');
}

function applySettingsToUI() {
    document.getElementById('settingSoundEnabled').checked = state.settings.soundEnabled;
    document.getElementById('settingVibrationEnabled').checked = state.settings.vibrationEnabled;
}

// ============================================
// TRANSMISSIONS MANAGEMENT
// ============================================

function populateTransmissionsDropdown() {
    const select = document.getElementById('energyType');
    
    let options = '<option value="">Select type...</option>';
    state.settings.transmissions.forEach(t => {
        options += `<option value="${t}">${t}</option>`;
    });
    options += '<option value="Other">Other</option>';
    
    select.innerHTML = options;
}

function renderTransmissionsList() {
    const container = document.getElementById('transmissionsList');
    
    if (state.settings.transmissions.length === 0) {
        container.innerHTML = '<p class="empty-state">No custom transmissions</p>';
        return;
    }
    
    container.innerHTML = state.settings.transmissions.map((t, i) => `
        <div class="transmission-item">
            <span>${t}</span>
            ${!DEFAULT_TRANSMISSIONS.includes(t) ? 
                `<button class="btn tiny danger" onclick="removeTransmission(${i})">×</button>` :
                ''
            }
        </div>
    `).join('');
}

function addTransmission() {
    const input = document.getElementById('newTransmissionName');
    const name = input.value.trim();
    
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    
    if (state.settings.transmissions.includes(name)) {
        showToast('Transmission already exists', 'error');
        return;
    }
    
    state.settings.transmissions.push(name);
    saveSettings();
    renderTransmissionsList();
    populateTransmissionsDropdown();
    input.value = '';
    showToast('Transmission added!', 'success');
}

function removeTransmission(index) {
    state.settings.transmissions.splice(index, 1);
    saveSettings();
    renderTransmissionsList();
    populateTransmissionsDropdown();
    showToast('Transmission removed', 'success');
}

// ============================================
// AUDIO & NOTIFICATIONS
// ============================================

function initAudio() {
    document.addEventListener('click', () => {
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, { once: true });
}

async function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            state.notificationPermission = 'default';
        } else {
            state.notificationPermission = Notification.permission;
        }
    }
}

async function ensureNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        state.notificationPermission = permission;
        return permission === 'granted';
    }
    return Notification.permission === 'granted';
}

function playCompletionSound() {
    if (!state.settings.soundEnabled) return;
    
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const ctx = state.audioContext;
    
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    
    const now = ctx.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.50];
    
    frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const startTime = now + (i * 0.15);
        const endTime = startTime + 0.4;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
        
        oscillator.start(startTime);
        oscillator.stop(endTime);
    });
}

function vibrate(pattern = [200, 100, 200, 100, 300]) {
    if (!state.settings.vibrationEnabled) return;
    
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

function showNotification(title, body, tag = 'timer') {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: body,
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-96.png',
            tag: tag,
            requireInteraction: true,
            vibrate: [200, 100, 200]
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 30000);
    }
}

// ============================================
// TIMER PERSISTENCE
// ============================================

function saveTimerState() {
    if (state.timer.isRunning) {
        const timerData = {
            isRunning: state.timer.isRunning,
            isPaused: state.timer.isPaused,
            startTime: state.timer.startTime?.toISOString(),
            endTime: state.timer.endTime?.toISOString(),
            duration: state.timer.duration,
            marker: state.timer.marker,
            customWork: state.timer.customWork,
            targetName: state.timer.targetName,
            energyType: state.timer.energyType,
            intensity: state.timer.intensity,
            notes: state.timer.notes,
            pausedAt: state.timer.isPaused ? new Date().toISOString() : null,
            remainingWhenPaused: state.timer.isPaused ? state.timer.remaining : null
        };
        localStorage.setItem('timerState', JSON.stringify(timerData));
    } else {
        localStorage.removeItem('timerState');
    }
}

function restoreTimerState() {
    const saved = localStorage.getItem('timerState');
    if (!saved) return;
    
    try {
        const timerData = JSON.parse(saved);
        
        if (!timerData.isRunning) {
            localStorage.removeItem('timerState');
            return;
        }
        
        const now = new Date();
        const endTime = new Date(timerData.endTime);
        
        if (!timerData.isPaused && now >= endTime) {
            localStorage.removeItem('timerState');
            
            const durationMinutes = Math.round(timerData.duration / 60);
            
            if (state.currentUser) {
                apiCall('saveSession', {
                    userId: state.currentUser.user_id,
                    markerId: timerData.marker || '',
                    startTime: timerData.startTime,
                    endTime: timerData.endTime,
                    durationMinutes: durationMinutes,
                    energyType: timerData.energyType,
                    intensity: timerData.intensity,
                    notes: timerData.notes
                }).then(() => {
                    showToast(`Session completed: ${timerData.targetName} (${durationMinutes} min)`, 'success');
                });
            }
            
            playCompletionSound();
            vibrate();
            return;
        }
        
        state.timer.isRunning = true;
        state.timer.isPaused = timerData.isPaused;
        state.timer.startTime = new Date(timerData.startTime);
        state.timer.endTime = endTime;
        state.timer.duration = timerData.duration;
        state.timer.marker = timerData.marker;
        state.timer.customWork = timerData.customWork;
        state.timer.targetName = timerData.targetName;
        state.timer.energyType = timerData.energyType;
        state.timer.intensity = timerData.intensity;
        state.timer.notes = timerData.notes;
        
        if (timerData.isPaused) {
            state.timer.remaining = timerData.remainingWhenPaused;
        } else {
            state.timer.remaining = Math.max(0, Math.round((endTime - now) / 1000));
        }
        
        document.getElementById('timerSetup').classList.add('hidden');
        document.getElementById('timerActive').classList.remove('hidden');
        
        document.getElementById('timerTargetName').textContent = state.timer.targetName;
        document.getElementById('timerEnergyType').textContent = state.timer.energyType || '—';
        document.getElementById('timerIntensity').textContent = capitalize(state.timer.intensity);
        document.getElementById('timerNotesDisplay').textContent = state.timer.notes;
        
        const pauseBtn = document.getElementById('pauseBtn');
        if (state.timer.isPaused) {
            pauseBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
        }
        
        updateTimerDisplay();
        state.timer.interval = setInterval(timerTick, 1000);
        
        showToast('Timer restored', 'success');
        
    } catch (error) {
        console.error('Error restoring timer:', error);
        localStorage.removeItem('timerState');
    }
}

function savePlaylistState() {
    if (state.playlistRunner.isRunning) {
        const data = {
            isRunning: true,
            isPaused: state.playlistRunner.isPaused,
            playlistId: state.playlistRunner.playlist?.playlist_id,
            items: state.playlistRunner.items,
            currentIndex: state.playlistRunner.currentIndex,
            itemEndTime: state.playlistRunner.itemEndTime?.toISOString(),
            itemRemaining: state.playlistRunner.itemRemaining,
            pausedAt: state.playlistRunner.pausedAt?.toISOString()
        };
        localStorage.setItem('playlistState', JSON.stringify(data));
    } else {
        localStorage.removeItem('playlistState');
    }
}

function restorePlaylistState() {
    const saved = localStorage.getItem('playlistState');
    if (!saved) return;
    
    try {
        const data = JSON.parse(saved);
        if (!data.isRunning) {
            localStorage.removeItem('playlistState');
            return;
        }
        // For simplicity, we don't fully restore playlists across refreshes
        localStorage.removeItem('playlistState');
    } catch (error) {
        localStorage.removeItem('playlistState');
    }
}

// ============================================
// VISIBILITY HANDLER (Background Support)
// ============================================

function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveTimerState();
            savePlaylistState();
        } else {
            if (state.timer.isRunning && !state.timer.isPaused) {
                const now = new Date();
                const remaining = Math.max(0, Math.round((state.timer.endTime - now) / 1000));
                
                if (remaining <= 0) {
                    endTimer(true);
                } else {
                    state.timer.remaining = remaining;
                    updateTimerDisplay();
                }
            }
            
            // Restore playlist timer if running
            if (state.playlistRunner.isRunning && !state.playlistRunner.isPaused) {
                const now = new Date();
                const remaining = Math.max(0, Math.round((state.playlistRunner.itemEndTime - now) / 1000));
                
                if (remaining <= 0) {
                    clearInterval(state.playlistRunner.itemTimer);
                    playCompletionSound();
                    vibrate([100, 50, 100]);
                    nextPlaylistItem();
                } else {
                    state.playlistRunner.itemRemaining = remaining;
                    updatePlaylistItemTimer();
                }
            }
        }
    });
    
    window.addEventListener('beforeunload', () => {
        saveTimerState();
        savePlaylistState();
    });
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
    try {
        const data = await apiCall('getUsers');
        const users = data?.users || [];
        state.users = users.filter(u => u.status === 'active');
    } catch (error) {
        console.error('Error loading users:', error);
        state.users = [];
    }
}

async function loadMarkers() {
    try {
        const data = await apiCall('getMarkers');
        state.markers = data?.markers || [];
        
        const categorySet = new Set(state.markers.map(m => m.category));
        state.categories = Array.from(categorySet).sort();
        
        populateCategoryFilters();
    } catch (error) {
        console.error('Error loading markers:', error);
        state.markers = [];
        state.categories = [];
    }
}

async function loadUserData() {
    if (!state.currentUser) {
        console.log('No current user, skipping data load');
        return;
    }
    
    console.log('Loading data for user:', state.currentUser.user_id);
    
    try {
        // Load sessions
        const sessionsData = await apiCall('getSessions', { 
            userId: state.currentUser.user_id,
            limit: 50
        });
        console.log('Sessions response:', sessionsData);
        state.sessions = sessionsData?.sessions || sessionsData || [];
        if (!Array.isArray(state.sessions)) state.sessions = [];
        console.log('Loaded sessions:', state.sessions.length);
        
        // Load progress
        const progressData = await apiCall('getProgress', {
            userId: state.currentUser.user_id,
            limit: 100
        });
        console.log('Progress response:', progressData);
        state.progress = progressData?.progress || progressData || [];
        if (!Array.isArray(state.progress)) state.progress = [];
        console.log('Loaded progress:', state.progress.length);
        
        // Load playlists
        const playlistsData = await apiCall('getPlaylists', {
            userId: state.currentUser.user_id
        });
        console.log('Playlists response:', playlistsData);
        state.playlists = playlistsData?.playlists || playlistsData || [];
        if (!Array.isArray(state.playlists)) state.playlists = [];
        console.log('Loaded playlists:', state.playlists.length);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        // Ensure arrays are initialized even on error
        state.sessions = state.sessions || [];
        state.progress = state.progress || [];
        state.playlists = state.playlists || [];
    }
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
    
    let options = '<option value="">All Categories</option>';
    options += '<option value="Foundations">⭐ Foundations</option>';
    options += state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    categoryFilter.innerHTML = options;
    
    markerCategorySelect.innerHTML = 
        '<option value="Custom">Custom</option>' +
        state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    populateTimerMarkerSelect();
    populateProgressFilter();
    populateProgressTrendSelect();
}

function populateTimerMarkerSelect() {
    const select = document.getElementById('timerMarkerSelect');
    
    let options = '<option value="">Select marker...</option>';
    options += '<option value="custom">✦ Custom / General</option>';
    
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

function populateProgressTrendSelect() {
    const select = document.getElementById('progressTrendMarker');
    if (!select) return;
    
    let options = '<option value="">Select marker...</option>';
    state.markers.forEach(m => {
        options += `<option value="${m.marker_id}">${m.name}</option>`;
    });
    
    select.innerHTML = options;
}

// ============================================
// VIEW MANAGEMENT
// ============================================

function showView(viewName) {
    try {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        const viewElement = document.getElementById(`view${capitalize(viewName)}`);
        if (viewElement) {
            viewElement.classList.add('active');
        } else {
            console.error('View not found:', viewName);
            return;
        }
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        
        switch(viewName) {
            case 'track':
                renderMarkersList();
                break;
            case 'history':
                renderHistory();
                break;
            case 'settings':
                renderSettings();
                applySettingsToUI();
                renderTransmissionsList();
                break;
            case 'playlists':
                renderPlaylists();
                break;
            case 'stats':
                populateProgressTrendSelect();
                // Small delay to ensure canvas container is visible before rendering
                setTimeout(() => updateStats(), 50);
                break;
        }
    } catch (error) {
        console.error('Error in showView:', error);
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {
    document.getElementById('statTotalMarkers').textContent = state.markers?.length || 0;
    
    const today = new Date().toISOString().split('T')[0];
    const sessions = state.sessions || [];
    const todaySessions = sessions.filter(s => 
        s.start_time && s.start_time.startsWith(today)
    ).length;
    document.getElementById('statTodaySessions').textContent = todaySessions;
    
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    document.getElementById('statTotalTime').textContent = `${hours}h ${mins}m`;
}

function renderRecentActivity() {
    const container = document.getElementById('recentActivityList');
    if (!container) return;
    
    const sessions = state.sessions || [];
    const progress = state.progress || [];
    const recentItems = [...sessions, ...progress]
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
// STATISTICS (same as before)
// ============================================

function updateStats() {
    const period = document.getElementById('statsPeriod').value;
    const filteredSessions = filterSessionsByPeriod(period);
    const filteredProgress = filterProgressByPeriod(period);
    
    const totalSessions = filteredSessions.length;
    const totalMinutes = filteredSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const avgSession = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
    
    document.getElementById('statsSessions').textContent = totalSessions;
    document.getElementById('statsTotalHours').textContent = `${totalHours}h`;
    document.getElementById('statsAvgSession').textContent = `${avgSession}m`;
    
    renderDailyChart(filteredSessions, period);
    renderMarkerBreakdown(filteredSessions);
    renderRecentActivity();
    renderCorrelationView(filteredSessions, filteredProgress);
}

function filterSessionsByPeriod(period) {
    if (!state.sessions || !Array.isArray(state.sessions)) return [];
    if (period === 'all') return state.sessions;
    
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return state.sessions.filter(s => {
        if (!s.start_time) return false;
        return new Date(s.start_time) >= cutoff;
    });
}

function filterProgressByPeriod(period) {
    if (!state.progress || !Array.isArray(state.progress)) return [];
    if (period === 'all') return state.progress;
    
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return state.progress.filter(p => {
        if (!p.timestamp) return false;
        return new Date(p.timestamp) >= cutoff;
    });
}

function renderDailyChart(sessions, period) {
    const canvas = document.getElementById('dailyChart');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    
    const days = period === 'all' ? 30 : Math.min(parseInt(period), 30);
    const dailyData = [];
    const labels = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayMinutes = sessions
            .filter(s => s.start_time && s.start_time.startsWith(dateStr))
            .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        
        dailyData.push(dayMinutes);
        labels.push(date.getDate().toString());
    }
    
    // Get container dimensions
    const rect = container.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 200;
    
    // Set canvas size with retina support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);
    
    if (dailyData.every(d => d === 0)) {
        ctx.fillStyle = '#666666';
        ctx.font = '14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No session data for this period', width / 2, height / 2);
        return;
    }
    
    const maxValue = Math.max(...dailyData, 60);
    const padding = { left: 35, right: 10, top: 20, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = Math.max(4, (chartWidth / dailyData.length) - 2);
    const barGap = (chartWidth - (barWidth * dailyData.length)) / (dailyData.length - 1 || 1);
    
    dailyData.forEach((value, i) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding.left + i * (barWidth + barGap);
        const y = padding.top + chartHeight - barHeight;
        
        if (barHeight > 0) {
            const gradient = ctx.createLinearGradient(x, y + barHeight, x, y);
            gradient.addColorStop(0, '#8b5cf6');
            gradient.addColorStop(1, '#a78bfa');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 2);
            ctx.fill();
        }
    });
    
    // X-axis labels
    ctx.fillStyle = '#666666';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    
    const labelInterval = Math.ceil(dailyData.length / 7);
    labels.forEach((label, i) => {
        if (i % labelInterval === 0 || i === labels.length - 1) {
            const x = padding.left + i * (barWidth + barGap) + barWidth / 2;
            ctx.fillText(label, x, height - 8);
        }
    });
    
    // Y-axis labels
    ctx.textAlign = 'right';
    ctx.fillText('0', padding.left - 5, padding.top + chartHeight);
    ctx.fillText(`${Math.round(maxValue)}m`, padding.left - 5, padding.top + 5);
}

function renderMarkerBreakdown(sessions) {
    const container = document.getElementById('markerBreakdown');
    
    const markerTotals = {};
    sessions.forEach(s => {
        const markerId = s.marker_id || 'general';
        markerTotals[markerId] = (markerTotals[markerId] || 0) + (s.duration_minutes || 0);
    });
    
    const sorted = Object.entries(markerTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-state">No session data</p>';
        return;
    }
    
    const maxMinutes = sorted[0][1];
    
    container.innerHTML = sorted.map(([markerId, minutes]) => {
        const marker = state.markers.find(m => m.marker_id === markerId);
        const name = marker?.name || markerId || 'General';
        const percentage = (minutes / maxMinutes) * 100;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        
        return `
            <div class="breakdown-item">
                <div class="breakdown-bar-container">
                    <span class="breakdown-name">${name}</span>
                    <div class="breakdown-bar">
                        <div class="breakdown-bar-fill" style="width: ${percentage}%">
                            <span class="breakdown-value">${timeStr}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateProgressTrend() {
    const markerId = document.getElementById('progressTrendMarker').value;
    if (!markerId) {
        clearProgressChart();
        return;
    }
    
    const markerProgress = state.progress
        .filter(p => p.marker_id === markerId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-30);
    
    renderProgressChart(markerProgress);
}

function clearProgressChart() {
    const canvas = document.getElementById('progressChart');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    
    const rect = container.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 200;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#666666';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select a marker to see trends', width / 2, height / 2);
}

function renderProgressChart(progressData) {
    const canvas = document.getElementById('progressChart');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    
    const rect = container.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 200;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);
    
    if (progressData.length === 0) {
        ctx.fillStyle = '#666666';
        ctx.font = '14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No progress data for this marker', width / 2, height / 2);
        return;
    }
    
    const values = progressData.map(p => p.sensed_value);
    const minValue = Math.min(...values) - 5;
    const maxValue = Math.max(...values) + 5;
    const range = maxValue - minValue || 1;
    
    const padding = { left: 45, right: 15, top: 20, bottom: 25 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const pointSpacing = chartWidth / Math.max(values.length - 1, 1);
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    
    values.forEach((value, i) => {
        const x = padding.left + i * pointSpacing;
        const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
    
    // Draw points
    values.forEach((value, i) => {
        const x = padding.left + i * pointSpacing;
        const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
        
        ctx.beginPath();
        ctx.fillStyle = '#8b5cf6';
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Y-axis labels
    ctx.fillStyle = '#666666';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(maxValue)}%`, padding.left - 5, padding.top + 5);
    ctx.fillText(`${Math.round(minValue)}%`, padding.left - 5, height - padding.bottom);
}

function renderCorrelationView(sessions, progress) {
    const container = document.getElementById('correlationView');
    
    const markerData = {};
    
    sessions.forEach(s => {
        if (!s.marker_id) return;
        if (!markerData[s.marker_id]) markerData[s.marker_id] = { time: 0, progress: [] };
        markerData[s.marker_id].time += s.duration_minutes || 0;
    });
    
    progress.forEach(p => {
        if (!p.marker_id) return;
        if (!markerData[p.marker_id]) markerData[p.marker_id] = { time: 0, progress: [] };
        markerData[p.marker_id].progress.push(p.sensed_value);
    });
    
    const correlations = [];
    for (const [markerId, data] of Object.entries(markerData)) {
        if (data.progress.length >= 2 && data.time > 0) {
            const first = data.progress[data.progress.length - 1];
            const last = data.progress[0];
            const change = last - first;
            
            const marker = state.markers.find(m => m.marker_id === markerId);
            correlations.push({
                name: marker?.name || markerId,
                time: data.time,
                change: change
            });
        }
    }
    
    correlations.sort((a, b) => b.time - a.time);
    
    if (correlations.length === 0) {
        container.innerHTML = '<p class="empty-state">Need both sessions and progress tracking data</p>';
        return;
    }
    
    container.innerHTML = correlations.slice(0, 5).map(c => {
        const hours = Math.floor(c.time / 60);
        const mins = c.time % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        
        let changeClass = 'neutral';
        let changeStr = '0%';
        if (c.change > 0) {
            changeClass = 'positive';
            changeStr = `+${c.change}%`;
        } else if (c.change < 0) {
            changeClass = 'negative';
            changeStr = `${c.change}%`;
        }
        
        return `
            <div class="correlation-item">
                <div class="correlation-header">
                    <span class="correlation-name">${c.name}</span>
                    <span class="correlation-change ${changeClass}">${changeStr}</span>
                </div>
                <div class="correlation-details">
                    ${timeStr} of energy work
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// MARKERS & TRACKING
// ============================================

function renderMarkersList() {
    const container = document.getElementById('markersList');
    const categoryFilter = document.getElementById('categoryFilter').value;
    const blindMode = document.getElementById('blindModeToggle').checked;
    
    const markers = state.markers || [];
    let filteredMarkers = markers;
    
    // Handle Foundations filter
    if (categoryFilter === 'Foundations') {
        filteredMarkers = markers.filter(m => 
            FOUNDATIONS_MARKERS.some(f => m.name.includes(f) || m.name === f)
        );
    } else if (categoryFilter) {
        filteredMarkers = markers.filter(m => m.category === categoryFilter);
    }
    
    if (filteredMarkers.length === 0) {
        container.innerHTML = '<p class="empty-state">No markers found</p>';
        return;
    }
    
    const grouped = {};
    filteredMarkers.forEach(m => {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
    });
    
    let html = '';
    for (const [category, markers] of Object.entries(grouped)) {
        const isCollapsed = state.settings.collapsedCategories[category] || false;
        
        html += `
            <div class="category-header ${isCollapsed ? 'collapsed' : ''}" onclick="toggleCategory('${category}')">
                <div class="category-header-left">
                    <span class="category-header-name">${category}</span>
                    <span class="category-header-count">${markers.length}</span>
                </div>
                <span class="category-collapse-icon">▼</span>
            </div>
            <div class="category-markers ${isCollapsed ? 'collapsed' : ''}" data-category="${category}">
        `;
        
        markers.forEach(marker => {
            const latestProgress = getLatestProgressForMarker(marker.marker_id);
            const value = latestProgress?.sensed_value;
            const displayValue = blindMode ? '—' : (value !== undefined ? value + '%' : '—');
            
            html += `
                <div class="marker-card ${!value ? 'no-value' : ''}" onclick="openAssessment('${marker.marker_id}')">
                    <div class="marker-header">
                        <span class="marker-name">${marker.name}</span>
                        <span class="marker-value">${displayValue}</span>
                    </div>
                    <div class="marker-category">${marker.subcategory || ''}</div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function toggleCategory(category) {
    state.settings.collapsedCategories[category] = !state.settings.collapsedCategories[category];
    saveSettings();
    
    const header = document.querySelector(`.category-header[onclick="toggleCategory('${category}')"]`);
    const content = document.querySelector(`.category-markers[data-category="${category}"]`);
    
    if (header && content) {
        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
    }
}

function getLatestProgressForMarker(markerId) {
    if (!state.progress || !Array.isArray(state.progress)) return null;
    return state.progress.find(p => p.marker_id === markerId);
}

// ============================================
// BLIND ASSESSMENT
// ============================================

function openAssessment(markerId) {
    const marker = state.markers.find(m => m.marker_id === markerId);
    if (!marker) return;
    
    state.assessment.marker = marker;
    
    const latestProgress = getLatestProgressForMarker(markerId);
    state.assessment.previousValue = latestProgress?.sensed_value || null;
    
    const blindMode = document.getElementById('blindModeToggle').checked;
    
    document.getElementById('assessmentMarkerName').textContent = marker.name;
    document.getElementById('assessmentDescription').textContent = marker.description || '';
    
    // Show current value if blind mode is OFF
    const currentValueDisplay = document.getElementById('currentValueDisplay');
    if (!blindMode && state.assessment.previousValue !== null) {
        document.getElementById('currentValueAmount').textContent = state.assessment.previousValue + '%';
        currentValueDisplay.classList.remove('hidden');
    } else {
        currentValueDisplay.classList.add('hidden');
    }
    
    document.getElementById('sensedValue').value = 50;
    document.getElementById('sensedValueDisplay').textContent = '50';
    document.getElementById('assessmentNotes').value = '';
    
    document.getElementById('previousValueReveal').classList.add('hidden');
    document.getElementById('saveAssessmentBtn').classList.remove('hidden');
    document.getElementById('doneAssessmentBtn').classList.add('hidden');
    
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
        
        state.progress.unshift({
            user_id: state.currentUser.user_id,
            marker_id: state.assessment.marker.marker_id,
            previous_value: state.assessment.previousValue,
            sensed_value: sensedValue,
            notes: notes,
            timestamp: new Date().toISOString()
        });
        
        if (blindMode && state.assessment.previousValue !== null) {
            document.getElementById('revealedPreviousValue').textContent = state.assessment.previousValue + '%';
            document.getElementById('previousValueReveal').classList.remove('hidden');
            document.getElementById('saveAssessmentBtn').classList.add('hidden');
            document.getElementById('doneAssessmentBtn').classList.remove('hidden');
        } else {
            closeAssessmentModal();
            showToast('Assessment saved!', 'success');
        }
        
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
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('customDuration').value = minutes;
}

async function startTimer() {
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
    
    await ensureNotificationPermission();
    
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    let targetName = customWork || 'General';
    if (markerId && markerId !== 'custom') {
        const marker = state.markers.find(m => m.marker_id === markerId);
        targetName = marker?.name || markerId;
    }
    
    const now = new Date();
    const durationSeconds = duration * 60;
    const endTime = new Date(now.getTime() + durationSeconds * 1000);
    
    state.timer = {
        isRunning: true,
        isPaused: false,
        startTime: now,
        endTime: endTime,
        duration: durationSeconds,
        remaining: durationSeconds,
        marker: markerId !== 'custom' ? markerId : null,
        customWork: customWork,
        targetName: targetName,
        energyType: energyType,
        intensity: intensity,
        notes: notes,
        interval: null
    };
    
    saveTimerState();
    
    document.getElementById('timerSetup').classList.add('hidden');
    document.getElementById('timerActive').classList.remove('hidden');
    
    document.getElementById('timerTargetName').textContent = targetName;
    document.getElementById('timerEnergyType').textContent = energyType || '—';
    document.getElementById('timerIntensity').textContent = capitalize(intensity);
    document.getElementById('timerNotesDisplay').textContent = notes;
    
    document.getElementById('pauseBtn').innerHTML = '<span class="btn-icon">⏸</span> Pause';
    
    updateTimerDisplay();
    state.timer.interval = setInterval(timerTick, 1000);
    
    showToast(`Timer started: ${duration} minutes`, 'success');
}

function timerTick() {
    if (!state.timer.isRunning || state.timer.isPaused) return;
    
    const now = new Date();
    state.timer.remaining = Math.max(0, Math.round((state.timer.endTime - now) / 1000));
    
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
        showToast('Timer paused', 'success');
    } else {
        state.timer.endTime = new Date(Date.now() + state.timer.remaining * 1000);
        btn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
        showToast('Timer resumed', 'success');
    }
    
    saveTimerState();
}

async function endTimer(completed = false) {
    clearInterval(state.timer.interval);
    
    const actualDuration = state.timer.duration - state.timer.remaining;
    const durationMinutes = Math.round(actualDuration / 60);
    
    if (completed) {
        playCompletionSound();
        vibrate();
        
        if (document.hidden) {
            showNotification(
                'Session Complete! 🎉',
                `${state.timer.targetName} - ${durationMinutes} minutes`,
                'timer-complete'
            );
        }
    }
    
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
            
            const message = completed 
                ? `Session complete: ${durationMinutes} minutes 🎉` 
                : `Session saved: ${durationMinutes} minutes`;
            showToast(message, 'success');
            updateDashboard();
            
        } catch (error) {
            showToast('Failed to save session', 'error');
        }
        
        hideLoading();
    }
    
    resetTimer();
}

function resetTimer() {
    state.timer = {
        isRunning: false,
        isPaused: false,
        startTime: null,
        endTime: null,
        duration: 0,
        remaining: 0,
        marker: null,
        customWork: '',
        targetName: '',
        energyType: '',
        intensity: 'medium',
        notes: '',
        interval: null
    };
    
    localStorage.removeItem('timerState');
    
    document.getElementById('timerSetup').classList.remove('hidden');
    document.getElementById('timerActive').classList.add('hidden');
    
    document.getElementById('timerMarkerSelect').value = '';
    document.getElementById('customWorkName').value = '';
    document.getElementById('customDuration').value = '';
    document.getElementById('energyType').value = '';
    document.getElementById('timerNotes').value = '';
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.intensity-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.intensity === 'medium');
    });
    document.getElementById('customWorkInput').classList.add('hidden');
}

// ============================================
// PLAYLISTS
// ============================================

function renderPlaylists() {
    const container = document.getElementById('playlistsList');
    const playlists = state.playlists || [];
    
    console.log('Rendering playlists, count:', playlists.length);
    
    if (state.playlistRunner.isRunning) {
        container.classList.add('hidden');
        document.getElementById('playlistRunner').classList.remove('hidden');
    } else {
        container.classList.remove('hidden');
        document.getElementById('playlistRunner').classList.add('hidden');
    }
    
    if (playlists.length === 0) {
        container.innerHTML = '<p class="empty-state">No programs yet. Create one!</p>';
        return;
    }
    
    container.innerHTML = playlists.map(pl => {
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
    document.getElementById('playlistModalTitle').textContent = 'Create Program';
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistItemsList').innerHTML = '';
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
    
    // Build marker options including all track markers
    let markerOptions = '<option value="">Select...</option>';
    markerOptions += '<option value="custom">✦ Custom</option>';
    
    state.categories.forEach(category => {
        const categoryMarkers = state.markers.filter(m => m.category === category);
        if (categoryMarkers.length > 0) {
            markerOptions += `<optgroup label="${category}">`;
            categoryMarkers.forEach(m => {
                markerOptions += `<option value="${m.marker_id}">${m.name}</option>`;
            });
            markerOptions += '</optgroup>';
        }
    });
    
    // Build transmission options
    let transmissionOptions = '<option value="">Energy type...</option>';
    state.settings.transmissions.forEach(t => {
        transmissionOptions += `<option value="${t}">${t}</option>`;
    });
    
    const html = `
        <div class="playlist-item" data-item-id="${itemId}">
            <div class="playlist-item-row">
                <select class="playlist-item-marker" onchange="onPlaylistItemChange(${itemId})">
                    ${markerOptions}
                </select>
            </div>
            <div class="playlist-item-row">
                <input type="number" class="playlist-item-duration" placeholder="min" min="1" onchange="updatePlaylistTotal()">
                <span style="color: var(--text-muted); font-size: 0.75rem;">min</span>
                <div class="playlist-item-controls">
                    <button class="move-btn" onclick="movePlaylistItem(${itemId}, -1)" title="Move up">↑</button>
                    <button class="move-btn" onclick="movePlaylistItem(${itemId}, 1)" title="Move down">↓</button>
                    <button class="remove-item" onclick="removePlaylistItem(${itemId})">×</button>
                </div>
            </div>
            <div class="playlist-item-custom-note" id="customNote_${itemId}">
                <input type="text" class="playlist-item-note" placeholder="Custom work / intention...">
            </div>
            <div class="playlist-item-options">
                <select class="playlist-item-transmission">
                    ${transmissionOptions}
                </select>
                <div class="playlist-item-intensity">
                    <button type="button" data-intensity="low" onclick="setPlaylistItemIntensity(${itemId}, 'low')">L</button>
                    <button type="button" data-intensity="medium" class="active" onclick="setPlaylistItemIntensity(${itemId}, 'medium')">M</button>
                    <button type="button" data-intensity="high" onclick="setPlaylistItemIntensity(${itemId}, 'high')">H</button>
                    <button type="button" data-intensity="highest" onclick="setPlaylistItemIntensity(${itemId}, 'highest')">+</button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
    updatePlaylistTotal();
}

function onPlaylistItemChange(itemId) {
    const item = document.querySelector(`.playlist-item[data-item-id="${itemId}"]`);
    const markerSelect = item.querySelector('.playlist-item-marker');
    const customNoteDiv = document.getElementById(`customNote_${itemId}`);
    
    if (markerSelect.value === 'custom') {
        customNoteDiv.classList.add('visible');
    } else {
        customNoteDiv.classList.remove('visible');
    }
    
    updatePlaylistTotal();
}

function setPlaylistItemIntensity(itemId, intensity) {
    const item = document.querySelector(`.playlist-item[data-item-id="${itemId}"]`);
    const buttons = item.querySelectorAll('.playlist-item-intensity button');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.intensity === intensity);
    });
}

function movePlaylistItem(itemId, direction) {
    const container = document.getElementById('playlistItemsList');
    const items = Array.from(container.querySelectorAll('.playlist-item'));
    const currentIndex = items.findIndex(item => item.dataset.itemId === String(itemId));
    
    if (currentIndex === -1) return;
    
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const currentItem = items[currentIndex];
    const targetItem = items[newIndex];
    
    if (direction === -1) {
        container.insertBefore(currentItem, targetItem);
    } else {
        container.insertBefore(targetItem, currentItem);
    }
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
        showToast('Please enter a program name', 'error');
        return;
    }
    
    const itemElements = document.querySelectorAll('.playlist-item');
    const items = [];
    let totalDuration = 0;
    
    itemElements.forEach(el => {
        const markerId = el.querySelector('.playlist-item-marker').value;
        const duration = parseInt(el.querySelector('.playlist-item-duration').value) || 0;
        const customNote = el.querySelector('.playlist-item-note')?.value || '';
        const transmission = el.querySelector('.playlist-item-transmission').value;
        const activeIntensity = el.querySelector('.playlist-item-intensity button.active');
        const intensity = activeIntensity?.dataset.intensity || 'medium';
        
        if ((markerId || customNote) && duration > 0) {
            const marker = state.markers.find(m => m.marker_id === markerId);
            items.push({
                marker_id: markerId,
                name: markerId === 'custom' ? (customNote || 'Custom') : (marker?.name || markerId),
                customNote: customNote,
                duration: duration,
                transmission: transmission,
                intensity: intensity
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
        showToast('Program saved!', 'success');
        
    } catch (error) {
        showToast('Failed to save program', 'error');
    }
    
    hideLoading();
}

function editPlaylist(playlistId) {
    const playlist = state.playlists.find(p => p.playlist_id === playlistId);
    if (!playlist) return;
    
    document.getElementById('playlistModalTitle').textContent = 'Edit Program';
    document.getElementById('playlistName').value = playlist.name;
    document.getElementById('playlistModal').dataset.editId = playlistId;
    
    let items = [];
    try {
        items = JSON.parse(playlist.items_json);
    } catch(e) {}
    
    const container = document.getElementById('playlistItemsList');
    container.innerHTML = '';
    
    items.forEach(item => {
        const itemId = Date.now() + Math.random() * 1000;
        
        // Build marker options
        let markerOptions = '<option value="">Select...</option>';
        markerOptions += `<option value="custom" ${item.marker_id === 'custom' ? 'selected' : ''}>✦ Custom</option>`;
        
        state.categories.forEach(category => {
            const categoryMarkers = state.markers.filter(m => m.category === category);
            if (categoryMarkers.length > 0) {
                markerOptions += `<optgroup label="${category}">`;
                categoryMarkers.forEach(m => {
                    markerOptions += `<option value="${m.marker_id}" ${m.marker_id === item.marker_id ? 'selected' : ''}>${m.name}</option>`;
                });
                markerOptions += '</optgroup>';
            }
        });
        
        // Build transmission options
        let transmissionOptions = '<option value="">Energy type...</option>';
        state.settings.transmissions.forEach(t => {
            transmissionOptions += `<option value="${t}" ${t === item.transmission ? 'selected' : ''}>${t}</option>`;
        });
        
        const isCustom = item.marker_id === 'custom';
        const intensity = item.intensity || 'medium';
        
        container.insertAdjacentHTML('beforeend', `
            <div class="playlist-item" data-item-id="${itemId}">
                <div class="playlist-item-row">
                    <select class="playlist-item-marker" onchange="onPlaylistItemChange(${itemId})">
                        ${markerOptions}
                    </select>
                </div>
                <div class="playlist-item-row">
                    <input type="number" class="playlist-item-duration" placeholder="min" min="1" value="${item.duration}" onchange="updatePlaylistTotal()">
                    <span style="color: var(--text-muted); font-size: 0.75rem;">min</span>
                    <div class="playlist-item-controls">
                        <button class="move-btn" onclick="movePlaylistItem(${itemId}, -1)" title="Move up">↑</button>
                        <button class="move-btn" onclick="movePlaylistItem(${itemId}, 1)" title="Move down">↓</button>
                        <button class="remove-item" onclick="removePlaylistItem(${itemId})">×</button>
                    </div>
                </div>
                <div class="playlist-item-custom-note ${isCustom ? 'visible' : ''}" id="customNote_${itemId}">
                    <input type="text" class="playlist-item-note" placeholder="Custom work / intention..." value="${item.customNote || ''}">
                </div>
                <div class="playlist-item-options">
                    <select class="playlist-item-transmission">
                        ${transmissionOptions}
                    </select>
                    <div class="playlist-item-intensity">
                        <button type="button" data-intensity="low" class="${intensity === 'low' ? 'active' : ''}" onclick="setPlaylistItemIntensity(${itemId}, 'low')">L</button>
                        <button type="button" data-intensity="medium" class="${intensity === 'medium' ? 'active' : ''}" onclick="setPlaylistItemIntensity(${itemId}, 'medium')">M</button>
                        <button type="button" data-intensity="high" class="${intensity === 'high' ? 'active' : ''}" onclick="setPlaylistItemIntensity(${itemId}, 'high')">H</button>
                        <button type="button" data-intensity="highest" class="${intensity === 'highest' ? 'active' : ''}" onclick="setPlaylistItemIntensity(${itemId}, 'highest')">+</button>
                    </div>
                </div>
            </div>
        `);
    });
    
    updatePlaylistTotal();
    document.getElementById('playlistModal').classList.add('active');
}

async function deletePlaylistConfirm(playlistId) {
    if (!confirm('Delete this program?')) return;
    
    showLoading();
    
    try {
        await apiCall('deletePlaylist', { playlistId: playlistId });
        state.playlists = state.playlists.filter(p => p.playlist_id !== playlistId);
        renderPlaylists();
        showToast('Program deleted', 'success');
    } catch (error) {
        showToast('Failed to delete program', 'error');
    }
    
    hideLoading();
}

async function runPlaylist(playlistId) {
    const playlist = state.playlists.find(p => p.playlist_id === playlistId);
    if (!playlist) return;
    
    let items = [];
    try {
        items = JSON.parse(playlist.items_json);
    } catch(e) {
        showToast('Invalid program data', 'error');
        return;
    }
    
    if (items.length === 0) {
        showToast('Program is empty', 'error');
        return;
    }
    
    await ensureNotificationPermission();
    
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    state.playlistRunner = {
        isRunning: true,
        isPaused: false,
        playlist: playlist,
        items: items,
        currentIndex: 0,
        itemTimer: null,
        itemEndTime: null,
        itemRemaining: 0,
        pausedAt: null
    };
    
    document.getElementById('playlistsList').classList.add('hidden');
    document.getElementById('playlistRunner').classList.remove('hidden');
    
    document.getElementById('runningPlaylistName').textContent = playlist.name;
    document.getElementById('runnerTotalItems').textContent = items.length;
    
    const pauseBtn = document.getElementById('playlistPauseBtn');
    pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
    
    startPlaylistItem();
}

function startPlaylistItem() {
    const runner = state.playlistRunner;
    const item = runner.items[runner.currentIndex];
    
    document.getElementById('runnerCurrentItem').textContent = runner.currentIndex + 1;
    document.getElementById('runnerItemName').textContent = item.name;
    
    // Show item info (transmission & intensity)
    let infoText = '';
    if (item.transmission) infoText += item.transmission;
    if (item.intensity && item.intensity !== 'medium') {
        infoText += infoText ? ` • ${capitalize(item.intensity)}` : capitalize(item.intensity);
    }
    if (item.customNote) {
        infoText += infoText ? ` • ${item.customNote}` : item.customNote;
    }
    document.getElementById('runnerItemInfo').textContent = infoText;
    
    const queue = runner.items.slice(runner.currentIndex + 1);
    document.getElementById('runnerQueue').innerHTML = queue.map(q => `
        <div class="runner-queue-item">
            <span>${q.name}</span>
            <span>${q.duration}m</span>
        </div>
    `).join('');
    
    const now = new Date();
    const durationMs = item.duration * 60 * 1000;
    runner.itemEndTime = new Date(now.getTime() + durationMs);
    runner.itemRemaining = item.duration * 60;
    
    updatePlaylistItemTimer();
    savePlaylistState();
    
    runner.itemTimer = setInterval(() => {
        if (runner.isPaused) return;
        
        const now = new Date();
        runner.itemRemaining = Math.max(0, Math.round((runner.itemEndTime - now) / 1000));
        
        updatePlaylistItemTimer();
        
        if (runner.itemRemaining <= 0) {
            clearInterval(runner.itemTimer);
            playCompletionSound();
            vibrate([100, 50, 100]);
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

function pausePlaylist() {
    const runner = state.playlistRunner;
    runner.isPaused = !runner.isPaused;
    
    const btn = document.getElementById('playlistPauseBtn');
    
    if (runner.isPaused) {
        runner.pausedAt = new Date();
        btn.innerHTML = '<span class="btn-icon">▶</span> Resume';
        showToast('Program paused', 'success');
    } else {
        // Recalculate end time
        const pauseDuration = new Date() - runner.pausedAt;
        runner.itemEndTime = new Date(runner.itemEndTime.getTime() + pauseDuration);
        runner.pausedAt = null;
        btn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
        showToast('Program resumed', 'success');
    }
    
    savePlaylistState();
}

function skipPlaylistItem() {
    clearInterval(state.playlistRunner.itemTimer);
    nextPlaylistItem();
}

async function nextPlaylistItem() {
    const runner = state.playlistRunner;
    const currentItem = runner.items[runner.currentIndex];
    
    if (state.currentUser) {
        try {
            await apiCall('saveSession', {
                userId: state.currentUser.user_id,
                markerId: currentItem.marker_id !== 'custom' ? currentItem.marker_id : '',
                startTime: new Date(runner.itemEndTime.getTime() - currentItem.duration * 60 * 1000).toISOString(),
                endTime: new Date().toISOString(),
                durationMinutes: currentItem.duration,
                energyType: currentItem.transmission || '',
                intensity: currentItem.intensity || 'medium',
                notes: `Program: ${runner.playlist.name}${currentItem.customNote ? ' - ' + currentItem.customNote : ''}`
            });
        } catch (error) {
            console.error('Failed to save playlist session:', error);
        }
    }
    
    runner.currentIndex++;
    
    if (runner.currentIndex >= runner.items.length) {
        stopPlaylist();
        playCompletionSound();
        vibrate([200, 100, 200, 100, 300]);
        
        if (document.hidden) {
            showNotification(
                'Program Complete! 🎉',
                `${runner.playlist.name} finished`,
                'program-complete'
            );
        }
        
        showToast('Program completed! 🎉', 'success');
        await loadUserData();
        updateDashboard();
        return;
    }
    
    startPlaylistItem();
}

function stopPlaylist() {
    clearInterval(state.playlistRunner.itemTimer);
    
    state.playlistRunner = {
        isRunning: false,
        isPaused: false,
        playlist: null,
        items: [],
        currentIndex: 0,
        itemTimer: null,
        itemEndTime: null,
        itemRemaining: 0,
        pausedAt: null
    };
    
    localStorage.removeItem('playlistState');
    
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
    const sessions = state.sessions || [];
    
    if (sessions.length === 0) {
        container.innerHTML = '<p class="empty-state">No sessions yet</p>';
        return;
    }
    
    container.innerHTML = sessions.map(s => {
        const marker = state.markers?.find(m => m.marker_id === s.marker_id);
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
    const progress = state.progress || [];
    
    let filtered = progress;
    if (markerFilter) {
        filtered = progress.filter(p => p.marker_id === markerFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">No progress records</p>';
        return;
    }
    
    container.innerHTML = filtered.map(p => {
        const marker = state.markers?.find(m => m.marker_id === p.marker_id);
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
    document.getElementById('currentUser').addEventListener('change', async (e) => {
        const userId = e.target.value;
        state.currentUser = state.users.find(u => u.user_id === userId);
        localStorage.setItem('currentUserId', userId);
        
        showLoading();
        await loadUserData();
        updateDashboard();
        hideLoading();
    });
    
    document.getElementById('categoryFilter').addEventListener('change', () => {
        renderMarkersList();
    });
    
    document.getElementById('blindModeToggle').addEventListener('change', () => {
        renderMarkersList();
    });
    
    document.getElementById('sensedValue').addEventListener('input', (e) => {
        document.getElementById('sensedValueDisplay').textContent = e.target.value;
    });
    
    document.getElementById('timerMarkerSelect').addEventListener('change', (e) => {
        const customInput = document.getElementById('customWorkInput');
        customInput.classList.toggle('hidden', e.target.value !== 'custom');
    });
    
    document.querySelectorAll('.intensity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    document.getElementById('progressMarkerFilter').addEventListener('change', () => {
        renderProgressHistory();
    });
    
    document.getElementById('customDuration').addEventListener('input', () => {
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
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
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// BACKGROUND ANIMATION - NODE NETWORK
// ============================================

let animationFrame;
let particles = [];
let canvas, ctx;

function initBackgroundAnimation() {
    canvas = document.getElementById('backgroundCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    resizeCanvas();
    createParticles();
    animate();
    
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createParticles() {
    particles = [];
    const particleCount = Math.min(40, Math.floor((canvas.width * canvas.height) / 25000));
    
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            radius: Math.random() * 1.5 + 1
        });
    }
}

function animate() {
    if (document.hidden) {
        animationFrame = requestAnimationFrame(animate);
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw particles
    particles.forEach(particle => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
        ctx.fill();
    });
    
    // Draw connections
    const connectionDistance = 120;
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < connectionDistance) {
                const opacity = 1 - (distance / connectionDistance);
                ctx.strokeStyle = `rgba(139, 92, 246, ${opacity * 0.25})`;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
    
    animationFrame = requestAnimationFrame(animate);
}

// ============================================
// LOADING SCREEN
// ============================================

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
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
