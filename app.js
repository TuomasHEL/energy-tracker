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
    transmissions: [], // Cloud-synced transmissions
    intentions: null,  // User intentions/profile
    
    // Settings
    settings: {
        soundEnabled: false,
        vibrationEnabled: false,
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
// LOCAL CACHE MANAGEMENT
// ============================================

const CACHE_KEY = 'clearground_cache';
const CACHE_VERSION = 1;

function saveToCache() {
    try {
        const cacheData = {
            version: CACHE_VERSION,
            timestamp: new Date().toISOString(),
            currentUserId: state.currentUser?.user_id,
            users: state.users,
            markers: state.markers,
            sessions: state.sessions,
            progress: state.progress,
            playlists: state.playlists,
            transmissions: state.transmissions,
            intentions: state.intentions
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        console.log('Data cached locally');
    } catch (error) {
        console.error('Failed to save cache:', error);
    }
}

function loadFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return false;
        
        const data = JSON.parse(cached);
        if (data.version !== CACHE_VERSION) {
            console.log('Cache version mismatch, clearing');
            localStorage.removeItem(CACHE_KEY);
            return false;
        }
        
        // Restore state from cache
        state.users = data.users || [];
        state.markers = data.markers || [];
        state.sessions = data.sessions || [];
        state.progress = data.progress || [];
        state.playlists = data.playlists || [];
        state.transmissions = data.transmissions || [];
        state.intentions = data.intentions;
        
        // Derive categories from markers
        const categorySet = new Set(state.markers.map(m => m.category));
        state.categories = Array.from(categorySet).sort();
        
        // Restore current user
        if (data.currentUserId) {
            state.currentUser = state.users.find(u => u.user_id === data.currentUserId);
        }
        
        console.log('Loaded from cache (age:', getTimeSince(data.timestamp), ')');
        return true;
    } catch (error) {
        console.error('Failed to load cache:', error);
        return false;
    }
}

function getTimeSince(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

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
        
        // Try to load from cache first (instant startup)
        const hasCachedData = loadFromCache();
        
        if (hasCachedData && state.users.length > 0) {
            console.log('Using cached data for instant startup');
            
            // Set current user from cache or localStorage
            const savedUserId = localStorage.getItem('currentUserId');
            if (savedUserId && state.users.find(u => u.user_id === savedUserId)) {
                state.currentUser = state.users.find(u => u.user_id === savedUserId);
            } else if (state.users.length > 0 && !state.currentUser) {
                state.currentUser = state.users[0];
            }
            
            // Populate UI immediately from cache
            populateUserSelector();
            populateCategoryFilters();
            populateTimerMarkerSelect();
            updateDashboard();
            applySettingsToUI();
            populateTransmissionsDropdown();
            renderTransmissionsList();
            updateProfileView();
            updateAwakenLauncher();
            
            // Hide loading - app is usable now
            hideLoading();
            
            // Sync fresh data in background (don't await)
            syncDataInBackground();
        } else {
            // No cache - load everything from server
            console.log('No cache, loading from server');
            
            await loadUsers();
            console.log('Users loaded:', state.users.length);
            
            const savedUserId = localStorage.getItem('currentUserId');
            if (savedUserId && state.users.find(u => u.user_id === savedUserId)) {
                state.currentUser = state.users.find(u => u.user_id === savedUserId);
            } else if (state.users.length > 0) {
                state.currentUser = state.users[0];
            }
            console.log('Current user:', state.currentUser?.user_id);
            
            populateUserSelector();
            
            await loadMarkers();
            console.log('Markers loaded:', state.markers?.length);
            
            if (state.currentUser) {
                await loadUserData();
                await loadTransmissions();
                await loadIntentions();
                console.log('User data loaded');
            }
            
            updateDashboard();
            applySettingsToUI();
            populateTransmissionsDropdown();
            renderTransmissionsList();
            updateProfileView();
            updateAwakenLauncher();
            
            // Save to cache for next time
            saveToCache();
            
            hideLoading();
        }
        
        // Restore timer if it was running
        restoreTimerState();
        
        // Restore playlist runner if it was running
        restorePlaylistState();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup visibility change handler for background
        setupVisibilityHandler();
        
        // Initialize energy mode preference
        initEnergyMode();
        
        // Initialize signal state
        initSignalState();
        
        console.log('App init completed successfully');
        
    } catch (error) {
        console.error('Init error:', error);
        showToast('Failed to initialize app', 'error');
        hideLoading();
    }
}

// Background sync - fetch fresh data without blocking UI
async function syncDataInBackground() {
    console.log('Starting background sync...');
    
    try {
        // Fetch all data in parallel
        const [usersData, markersData] = await Promise.all([
            apiCall('getUsers'),
            apiCall('getMarkers')
        ]);
        
        state.users = usersData?.users || state.users;
        state.markers = markersData?.markers || state.markers;
        
        // Re-resolve current user (might have changed)
        const savedUserId = localStorage.getItem('currentUserId');
        if (savedUserId) {
            const user = state.users.find(u => u.user_id === savedUserId);
            if (user) state.currentUser = user;
        }
        
        if (state.currentUser) {
            const [sessionsData, progressData, playlistsData, transmissionsData, intentionsData] = await Promise.all([
                apiCall('getSessions', { userId: state.currentUser.user_id, limit: 100 }),
                apiCall('getProgress', { userId: state.currentUser.user_id, limit: 100 }),
                apiCall('getPlaylists', { userId: state.currentUser.user_id }),
                apiCall('getTransmissions', { userId: state.currentUser.user_id }),
                apiCall('getIntentions', { userId: state.currentUser.user_id })
            ]);
            
            state.sessions = sessionsData?.sessions || state.sessions;
            state.progress = progressData?.progress || state.progress;
            state.playlists = playlistsData?.playlists || state.playlists;
            state.transmissions = transmissionsData?.transmissions || state.transmissions;
            state.intentions = intentionsData?.intentions || state.intentions;
        }
        
        // Update UI with fresh data
        populateUserSelector();
        updateDashboard();
        populateTransmissionsDropdown();
        renderTransmissionsList();
        
        // Save fresh data to cache
        saveToCache();
        
        console.log('Background sync complete');
    } catch (error) {
        console.error('Background sync failed:', error);
        // Don't show error - app is still usable with cached data
    }
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
    if (!select) return;
    
    let options = '<option value="">Select type...</option>';
    state.transmissions.forEach(t => {
        options += `<option value="${t.name}">${t.name}</option>`;
    });
    options += '<option value="Other">Other</option>';
    
    select.innerHTML = options;
}

function renderTransmissionsList() {
    const container = document.getElementById('transmissionsList');
    if (!container) return;
    
    if (state.transmissions.length === 0) {
        container.innerHTML = '<p class="empty-state">No transmissions</p>';
        return;
    }
    
    container.innerHTML = state.transmissions.map(t => `
        <div class="transmission-item">
            <span>${t.name}</span>
            ${!t.is_default ? 
                `<button class="btn tiny danger" onclick="removeTransmission('${t.transmission_id}')">×</button>` :
                '<span class="transmission-default">default</span>'
            }
        </div>
    `).join('');
}

async function addTransmission() {
    const input = document.getElementById('newTransmissionName');
    const name = input.value.trim();
    
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    
    // Check if already exists
    if (state.transmissions.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showToast('Transmission already exists', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}?action=addTransmission&userId=${state.currentUser.user_id}&name=${encodeURIComponent(name)}`);
        const result = await response.json();
        
        if (result.success) {
            // Add to local state
            state.transmissions.push({
                transmission_id: result.transmissionId,
                user_id: state.currentUser.user_id,
                name: name,
                is_default: false
            });
            renderTransmissionsList();
            populateTransmissionsDropdown();
            input.value = '';
            showToast('Transmission added!', 'success');
        } else {
            throw new Error(result.error || 'Failed to add transmission');
        }
    } catch (error) {
        console.error('Error adding transmission:', error);
        showToast('Failed to add transmission', 'error');
    }
}

async function removeTransmission(transmissionId) {
    try {
        const response = await fetch(`${API_URL}?action=deleteTransmission&transmissionId=${transmissionId}`);
        const result = await response.json();
        
        if (result.success) {
            // Remove from local state
            state.transmissions = state.transmissions.filter(t => t.transmission_id !== transmissionId);
            renderTransmissionsList();
            populateTransmissionsDropdown();
            showToast('Transmission removed', 'success');
        } else {
            throw new Error(result.error || 'Failed to remove transmission');
        }
    } catch (error) {
        console.error('Error removing transmission:', error);
        showToast(error.message || 'Failed to remove transmission', 'error');
    }
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
            // Page became visible - catch up on any elapsed time
            
            // Handle standalone timer
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
            
            // Handle playlist runner - may need to catch up multiple items
            if (state.playlistRunner.isRunning && !state.playlistRunner.isPaused) {
                catchUpPlaylist();
            }
        }
    });
    
    window.addEventListener('beforeunload', () => {
        saveTimerState();
        savePlaylistState();
    });
}

// Catch up playlist when returning from background
async function catchUpPlaylist() {
    const runner = state.playlistRunner;
    if (!runner.isRunning || runner.isPaused) return;
    
    const now = new Date();
    
    // Clear existing interval
    if (runner.itemTimer) {
        clearInterval(runner.itemTimer);
        runner.itemTimer = null;
    }
    
    // Check if current item has elapsed
    let remaining = Math.round((runner.itemEndTime - now) / 1000);
    
    if (remaining <= 0) {
        console.log('Playlist item elapsed while in background, catching up...');
        
        // Calculate how much time has passed since item should have ended
        let elapsedSinceEnd = Math.abs(remaining);
        
        // Save the completed item
        const currentItem = runner.items[runner.currentIndex];
        if (state.currentUser && currentItem) {
            try {
                await apiCall('saveSession', {
                    userId: state.currentUser.user_id,
                    markerId: currentItem.marker_id !== 'custom' ? currentItem.marker_id : '',
                    startTime: new Date(runner.itemEndTime.getTime() - currentItem.duration * 60 * 1000).toISOString(),
                    endTime: runner.itemEndTime.toISOString(),
                    durationMinutes: currentItem.duration,
                    energyType: currentItem.transmission || '',
                    intensity: currentItem.intensity || 'medium',
                    notes: `Program: ${runner.playlist.name}${currentItem.customNote ? ' - ' + currentItem.customNote : ''}`
                });
            } catch (error) {
                console.error('Failed to save catch-up session:', error);
            }
        }
        
        // Move to next item
        runner.currentIndex++;
        
        // Skip through any items that would have fully elapsed
        while (runner.currentIndex < runner.items.length) {
            const nextItem = runner.items[runner.currentIndex];
            const nextDurationSec = nextItem.duration * 60;
            
            if (elapsedSinceEnd >= nextDurationSec) {
                // This item also fully elapsed, save it and move on
                console.log('Skipping fully elapsed item:', runner.currentIndex);
                elapsedSinceEnd -= nextDurationSec;
                
                if (state.currentUser) {
                    try {
                        await apiCall('saveSession', {
                            userId: state.currentUser.user_id,
                            markerId: nextItem.marker_id !== 'custom' ? nextItem.marker_id : '',
                            startTime: new Date(now.getTime() - elapsedSinceEnd * 1000 - nextDurationSec * 1000).toISOString(),
                            endTime: new Date(now.getTime() - elapsedSinceEnd * 1000).toISOString(),
                            durationMinutes: nextItem.duration,
                            energyType: nextItem.transmission || '',
                            intensity: nextItem.intensity || 'medium',
                            notes: `Program: ${runner.playlist.name} (auto-completed)${nextItem.customNote ? ' - ' + nextItem.customNote : ''}`
                        });
                    } catch (error) {
                        console.error('Failed to save skipped session:', error);
                    }
                }
                
                runner.currentIndex++;
            } else {
                // This item is partially elapsed, start it with remaining time
                break;
            }
        }
        
        // Check if playlist is complete
        if (runner.currentIndex >= runner.items.length) {
            playCompletionSound();
            vibrate([200, 100, 200, 100, 300]);
            showToast('Program completed!', 'success');
            stopPlaylist();
            return;
        }
        
        // Start the current item with adjusted time
        const currentItemNow = runner.items[runner.currentIndex];
        const remainingForItem = (currentItemNow.duration * 60) - elapsedSinceEnd;
        
        runner.itemEndTime = new Date(now.getTime() + remainingForItem * 1000);
        runner.itemRemaining = Math.max(0, remainingForItem);
        
        // Play sound to indicate we caught up
        playCompletionSound();
        
        // Update UI
        updatePlaylistItemTimer();
        document.getElementById('runnerItemName').textContent = 
            currentItemNow.marker_name || currentItemNow.customNote || 'Energy Work';
        document.getElementById('runnerCurrentItem').textContent = 
            `Item ${runner.currentIndex + 1} of ${runner.items.length}`;
        
        savePlaylistState();
        
        // Restart the interval
        startPlaylistInterval();
    } else {
        // Item hasn't elapsed, just update display and restart interval
        runner.itemRemaining = remaining;
        updatePlaylistItemTimer();
        startPlaylistInterval();
    }
}

// Start/restart playlist interval timer
function startPlaylistInterval() {
    const runner = state.playlistRunner;
    
    // Clear any existing interval
    if (runner.itemTimer) {
        clearInterval(runner.itemTimer);
    }
    
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

async function loadTransmissions() {
    if (!state.currentUser) {
        console.log('No current user, skipping transmissions load');
        return;
    }
    
    try {
        const data = await apiCall('getTransmissions', {
            userId: state.currentUser.user_id
        });
        console.log('Transmissions response:', data);
        state.transmissions = data?.transmissions || [];
        if (!Array.isArray(state.transmissions)) state.transmissions = [];
        console.log('Loaded transmissions:', state.transmissions.length);
    } catch (error) {
        console.error('Error loading transmissions:', error);
        state.transmissions = [];
    }
}

async function loadIntentions() {
    if (!state.currentUser) {
        console.log('No current user, skipping intentions load');
        return;
    }
    
    try {
        const data = await apiCall('getIntentions', {
            userId: state.currentUser.user_id
        });
        console.log('Intentions response:', data);
        state.intentions = data?.intentions || null;
        console.log('Loaded intentions:', state.intentions ? 'yes' : 'no');
    } catch (error) {
        console.error('Error loading intentions:', error);
        state.intentions = null;
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
                break;
            case 'transmissions':
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
            case 'profile':
                updateProfileView();
                break;
            case 'awaken':
                updateAwakenLauncher();
                break;
            case 'awakenSession':
                // Session view handled by startAwakenPractice
                break;
            case 'awakenComplete':
                // Complete view handled by completeSession
                break;
            case 'signal':
                updateSignalView();
                break;
            case 'signalHistory':
                renderSignalHistory('favorites');
                break;
            case 'signalSettings':
                updateSignalSettingsView();
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
    
    // Update signal stats
    updateSignalStatsDisplay();
}

function updateSignalStatsDisplay() {
    const stats = signalState.stats;
    const favCount = signalState.history.filter(h => h.isFavorite).length;
    
    // Stats page
    const totalEl = document.getElementById('statsSignalTotal');
    const streakEl = document.getElementById('statsSignalStreak');
    const bestEl = document.getElementById('statsSignalBest');
    const favEl = document.getElementById('statsSignalFavorites');
    
    if (totalEl) totalEl.textContent = stats.totalCompleted;
    if (streakEl) streakEl.textContent = stats.currentStreak;
    if (bestEl) bestEl.textContent = stats.longestStreak;
    if (favEl) favEl.textContent = favCount;
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
        saveToCache(); // Keep cache in sync
        
    } catch (error) {
        showToast('Failed to save assessment', 'error');
    }
    
    hideLoading();
}

// ============================================
// TIMER
// ============================================

// Simple mode state
const simpleMode = {
    selectedWork: 'vitality',
    duration: 60,
    showElapsed: false,
    isSimpleSession: false
};

// Work type to transmission mapping
const WORK_TRANSMISSIONS = {
    wisdom: 'Shift Shift',
    healing: 'Onelove',
    vitality: 'Neigong'
};

// Toggle between simple and advanced mode
function toggleEnergyMode() {
    const isAdvanced = document.getElementById('advancedModeToggle').checked;
    
    // Don't allow mode switch while timer is running
    if (state.timer.isRunning) {
        document.getElementById('advancedModeToggle').checked = !isAdvanced;
        showToast('Cannot switch mode while session is running', 'error');
        return;
    }
    
    document.getElementById('simpleSetup').classList.toggle('hidden', isAdvanced);
    document.getElementById('timerSetup').classList.toggle('hidden', !isAdvanced);
    
    // Update mode label styling
    document.getElementById('modeLabelSimple').style.color = isAdvanced ? 'var(--text-muted)' : 'var(--text-primary)';
    document.getElementById('modeLabelAdvanced').style.color = isAdvanced ? 'var(--text-primary)' : 'var(--text-muted)';
    
    // Save preference
    localStorage.setItem('energyModeAdvanced', isAdvanced);
}

// Select work option in simple mode
function selectWorkOption(work) {
    simpleMode.selectedWork = work;
    
    document.querySelectorAll('.work-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.work === work);
    });
}

// Adjust simple mode duration
function adjustSimpleDuration(delta) {
    simpleMode.duration = Math.max(15, Math.min(180, simpleMode.duration + delta));
    document.getElementById('simpleDurationDisplay').textContent = `${simpleMode.duration} min`;
}

// Start simple session
async function startSimpleSession() {
    await ensureNotificationPermission();
    
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const workName = capitalize(simpleMode.selectedWork);
    const transmission = WORK_TRANSMISSIONS[simpleMode.selectedWork];
    const duration = simpleMode.duration;
    
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
        marker: null,
        customWork: workName,
        targetName: workName,
        energyType: transmission,
        intensity: 'medium',
        notes: '',
        interval: null
    };
    
    simpleMode.isSimpleSession = true;
    simpleMode.showElapsed = false;
    
    saveTimerState();
    
    // Show simple active view
    document.getElementById('simpleSetup').classList.add('hidden');
    document.getElementById('simpleActive').classList.remove('hidden');
    document.getElementById('simpleActiveWork').textContent = workName;
    document.getElementById('simpleTimerLabel').textContent = 'remaining';
    
    // Hide mode toggle during session
    document.querySelector('.mode-toggle').style.display = 'none';
    
    updateSimpleTimerDisplay();
    state.timer.interval = setInterval(simpleTimerTick, 1000);
    
    updateHeaderLogo();
    showToast(`${workName} session started: ${duration} minutes`, 'success');
}

// Simple timer tick
function simpleTimerTick() {
    if (state.timer.isPaused) return;
    
    const now = new Date();
    state.timer.remaining = Math.max(0, Math.round((state.timer.endTime - now) / 1000));
    
    updateSimpleTimerDisplay();
    
    if (state.timer.remaining <= 0) {
        endTimer(true);
    }
}

// Update simple timer display
function updateSimpleTimerDisplay() {
    let displaySeconds;
    
    if (simpleMode.showElapsed) {
        displaySeconds = state.timer.duration - state.timer.remaining;
    } else {
        displaySeconds = state.timer.remaining;
    }
    
    const hours = Math.floor(displaySeconds / 3600);
    const minutes = Math.floor((displaySeconds % 3600) / 60);
    const seconds = displaySeconds % 60;
    
    document.getElementById('simpleTimerDisplay').textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Toggle between remaining/elapsed display
function toggleSimpleTimerDisplay() {
    simpleMode.showElapsed = !simpleMode.showElapsed;
    document.getElementById('simpleTimerLabel').textContent = 
        simpleMode.showElapsed ? 'elapsed' : 'remaining';
    updateSimpleTimerDisplay();
}

// Initialize energy mode from saved preference
function initEnergyMode() {
    const isAdvanced = localStorage.getItem('energyModeAdvanced') === 'true';
    document.getElementById('advancedModeToggle').checked = isAdvanced;
    
    document.getElementById('simpleSetup').classList.toggle('hidden', isAdvanced);
    document.getElementById('timerSetup').classList.toggle('hidden', !isAdvanced);
    
    document.getElementById('modeLabelSimple').style.color = isAdvanced ? 'var(--text-muted)' : 'var(--text-primary)';
    document.getElementById('modeLabelAdvanced').style.color = isAdvanced ? 'var(--text-primary)' : 'var(--text-muted)';
}

function setDuration(minutes) {
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('customDuration').value = minutes;
}

// Update header logo pulsing state based on active timers
function updateHeaderLogo() {
    const logo = document.getElementById('headerLogo');
    if (!logo) return;
    
    const isActive = state.timer.isRunning || state.playlistRunner.isRunning;
    logo.classList.toggle('active', isActive);
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
    
    updateHeaderLogo();
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
    
    // Update both pause buttons
    const advancedBtn = document.getElementById('pauseBtn');
    const simpleBtn = document.getElementById('simplePauseBtn');
    
    if (state.timer.isPaused) {
        advancedBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
        simpleBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
        showToast('Timer paused', 'success');
    } else {
        state.timer.endTime = new Date(Date.now() + state.timer.remaining * 1000);
        advancedBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
        simpleBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
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
            saveToCache(); // Keep cache in sync
            
        } catch (error) {
            showToast('Failed to save session', 'error');
        }
        
        hideLoading();
    }
    
    resetTimer();
    updateHeaderLogo();
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
    
    // Reset simple mode views
    if (simpleMode.isSimpleSession) {
        document.getElementById('simpleActive').classList.add('hidden');
        document.getElementById('simpleSetup').classList.remove('hidden');
        document.querySelector('.mode-toggle').style.display = '';
        simpleMode.isSimpleSession = false;
    } else {
        // Reset advanced mode views
        document.getElementById('timerSetup').classList.remove('hidden');
        document.getElementById('timerActive').classList.add('hidden');
    }
    
    // Reset advanced mode form
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
    const bottomBtn = document.getElementById('addProgramBottomBtn');
    
    console.log('Rendering playlists, count:', playlists.length);
    
    if (state.playlistRunner.isRunning) {
        container.classList.add('hidden');
        document.getElementById('playlistRunner').classList.remove('hidden');
        if (bottomBtn) bottomBtn.style.display = 'none';
    } else {
        container.classList.remove('hidden');
        document.getElementById('playlistRunner').classList.add('hidden');
    }
    
    if (playlists.length === 0) {
        container.innerHTML = '<p class="empty-state">No programs yet. Create one!</p>';
        if (bottomBtn) bottomBtn.style.display = 'none';
        return;
    }
    
    // Show bottom button when there are playlists
    if (bottomBtn) bottomBtn.style.display = 'block';
    
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
        saveToCache(); // Keep cache in sync
        
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
    updateHeaderLogo();
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
    
    // Use the centralized interval function
    startPlaylistInterval();
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
    
    updateHeaderLogo();
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
// AWAKEN SECTION - SESSION ENGINE
// ============================================

// Session state
const awakenSession = {
    active: false,
    practiceId: null,
    currentStepIndex: 0,
    steps: [],
    responses: {},
    startedAt: null,
    timerInterval: null,
    timerRemaining: 0,
    totalMilestones: 0,
    currentMilestone: 0
};

// 2-Part Formula Full Session Script
const PRACTICE_2PF_FULL = {
    id: '2pf-full',
    name: '2-Part Formula',
    steps: [
        // 0. Introduction
        {
            id: 'intro',
            type: 'text',
            content: `Welcome. This session is about seeing very clearly what you are not, and what you actually are.

We will move between two modes.

First, a mode where experience is spacious, quiet and does not contain a solid "me".

Second, a mode where we deliberately call up the sense of "me" and look at it closely.`,
            milestone: true
        },
        {
            id: 'intro-2',
            type: 'text',
            content: `You do not need to believe anything in advance. Just follow the steps and report honestly what you notice.

If at any point you feel overwhelmed or too activated, you can pause the session, open your eyes, or come back another time. Nothing here is worth forcing.

If you feel ready to explore, let us begin.`
        },
        // 1. Landing in the Body
        {
            id: 'landing',
            type: 'text',
            content: `Sit in a comfortable position. You can close your eyes now, or keep them open with a soft, relaxed gaze.

Let your hands rest wherever they want to rest.`,
            milestone: true
        },
        {
            id: 'landing-breath',
            type: 'text',
            content: `Take one easy breath in through the nose.

And exhale gently through the mouth.

Let the breath return to its natural rhythm.

For a moment, do not try to achieve anything.

Just notice: you are here.`
        },
        // 2. Mode 1 - Body Scan
        {
            id: 'mode1-intro',
            type: 'text',
            content: `We will start by relaxing the body and noticing what appears when tension lets go.

Bring your attention to your forehead.

Notice any tightness or effort there.

You do not have to force anything. Just let that area soften, even a little bit.`,
            milestone: true
        },
        {
            id: 'mode1-scan-1',
            type: 'text',
            content: `As it softens, notice what is left behind in that spot.

There is a sense of open space where the effort was.

Now bring your attention to the area around your eyes.

The muscles around the eyes, eyebrows, the space between your brows.

Let this region relax.

Again, as it relaxes, feel the space that becomes obvious there.`
        },
        {
            id: 'mode1-scan-2',
            type: 'text',
            content: `We will continue like this for a bit.

Top of the head. Back of the head.

Jaw and mouth. Throat and neck.

Left shoulder. Right shoulder.

Chest. Upper back.

Solar plexus. Belly. Lower back.

Pelvis. Hips.

Thighs. Knees. Lower legs. Feet.`
        },
        {
            id: 'mode1-scan-pause',
            type: 'pause',
            content: `Wherever you notice extra tension, let it unwind.

Then notice the quiet space that remains.`,
            duration: 45
        },
        // Whole-Field Spaciousness
        {
            id: 'mode1-field',
            type: 'text',
            content: `Now let your attention include the whole inner space at once.

From the top of the head to the feet.

Feel the body as one field of sensation and space.

There can be some remaining tension, some comfort, some neutral areas.

All of that can be there.`,
            milestone: true
        },
        {
            id: 'mode1-field-2',
            type: 'pause',
            content: `At the same time, there is a sense that the inside of the body is also a kind of open room.

Thoughts may be quieter. Emotions may be softer.

Let this sense of open field become a bit more obvious.`,
            duration: 15
        },
        // Spaciousness Check
        {
            id: 'spaciousness-check',
            type: 'scale',
            content: `How spacious or open does your inner experience feel right now?`,
            stateKey: 'spaciousness_1',
            options: [
                { value: 1, label: 'Very tight' },
                { value: 2, label: 'A bit tight' },
                { value: 3, label: 'Neutral' },
                { value: 4, label: 'Somewhat spacious' },
                { value: 5, label: 'Very spacious' }
            ],
            branches: {
                1: 'response-tight',
                2: 'response-tight',
                3: 'response-neutral',
                4: 'response-open',
                5: 'response-open'
            }
        },
        {
            id: 'response-tight',
            type: 'text',
            content: `Thank you for your honesty.

If it feels tight, that is completely okay.

For you in this round, the important thing is just to get familiar with how it feels right now. You do not need to force openness. We will come back to this many times.`,
            next: 'search-me'
        },
        {
            id: 'response-neutral',
            type: 'text',
            content: `Neutral is also fine.

We will still look carefully at what is present and what is not in this neutral field.`,
            next: 'search-me'
        },
        {
            id: 'response-open',
            type: 'text',
            content: `Good.

You are already sensing some space in the body and mind.

We will explore what is, and what is not, inside this space.`,
            next: 'search-me'
        },
        // Searching for "Me"
        {
            id: 'search-me',
            type: 'text',
            content: `Now, inside this inner field, see if you can find a solid center, a stable "me".

First, let your attention drift toward the left side of your inner space.

Do you find a clearly defined "me" over there? Just check.

Now toward the right side. Is there a solid "me" on the right?`,
            milestone: true
        },
        {
            id: 'search-me-2',
            type: 'text',
            content: `Now in front of you. Somewhere in the chest, face, or just ahead of the body.

Is there a definite "me" there?

Now behind you. In the back, or just behind your spine.

Is there a clearly located owner of experience there?`
        },
        {
            id: 'search-me-3',
            type: 'text',
            content: `Look below the body. Legs, feet, floor, space under you.

Is "me" sitting there as a solid center?

Now above the head. In the space above and around the skull.

Is "me" up there?`
        },
        {
            id: 'search-me-pause',
            type: 'pause',
            content: `Finally, feel toward what you think of as the center.

If you do not think about it, and only feel:

Is there a stable, solid "me" in the middle of this experience?

Take a few breaths to quietly check.`,
            duration: 15
        },
        {
            id: 'me-found-check',
            type: 'choice',
            content: `Right now, can you find a solid "me" anywhere in this space?`,
            stateKey: 'me_found',
            options: [
                { value: 'yes', label: 'Yes, clearly' },
                { value: 'vaguely', label: 'Vaguely' },
                { value: 'no', label: 'No, not really' }
            ],
            branches: {
                'yes': 'me-found-yes',
                'vaguely': 'me-found-vague',
                'no': 'me-found-no'
            }
        },
        {
            id: 'me-found-no',
            type: 'text',
            content: `Good.

Even if it is just for a moment, you are seeing that experience can be here without a clear owner.

You do not need to hold on to this. It is enough that you have noticed it.`,
            next: 'clarity-check'
        },
        {
            id: 'me-found-vague',
            type: 'text',
            content: `That is very common.

You may sense a kind of center, but it is not very clear.

We will come back to that center later and get to know it better.

For now, notice that the overall field has a lot of space and not much solidity.`,
            next: 'clarity-check'
        },
        {
            id: 'me-found-yes',
            type: 'text',
            content: `Perfect.

That clear "me-feeling" is exactly what we will investigate soon.

For now, just notice that even this strong center is one part of a larger field of sensation.`,
            next: 'clarity-check'
        },
        // Clarity Check
        {
            id: 'clarity-check',
            type: 'choice',
            content: `Does this spaciousness feel clear and bright, or a bit foggy or sleepy?`,
            stateKey: 'clarity',
            options: [
                { value: 'clear', label: 'Clear enough' },
                { value: 'foggy', label: 'A bit foggy or sleepy' }
            ],
            branches: {
                'clear': 'mode1-summary',
                'foggy': 'clarity-boost'
            }
        },
        {
            id: 'clarity-boost',
            type: 'text',
            content: `Sometimes peace can feel a bit dull or sleepy.

Let us sharpen your attention briefly.

Imagine you just heard a soft but unexpected sound somewhere in the room.

Let your posture become a little more alert. Spine gently tall.

Inside the closed eyes, let the feeling be bright.

Ears open, listening in all directions.

As if your whole body is "eyes and ears" for a short while.`,
            next: 'clarity-boost-pause'
        },
        {
            id: 'clarity-boost-pause',
            type: 'pause',
            content: `Stay like this for about twenty seconds.`,
            duration: 20,
            next: 'clarity-boost-relax'
        },
        {
            id: 'clarity-boost-relax',
            type: 'text',
            content: `Now let that alertness relax again.

Settle back into the open field.

Often this little burst of attention makes the silence clearer.`,
            next: 'mode1-summary'
        },
        // Mode 1 Summary
        {
            id: 'mode1-summary',
            type: 'text',
            content: `For a short time now, you have:

Relaxed the body.

Noticed open space where tension used to be.

Felt the inner field as one spacious unit.

And looked for a solid "me" inside it.

Even a brief recognition that experience can be here without a clear owner is important.`,
            milestone: true
        },
        {
            id: 'mode1-transition',
            type: 'text',
            content: `Now we will move to the second mode.`
        },
        // Mode 2 - Evoking the "Me-Knot"
        {
            id: 'mode2-intro',
            type: 'text',
            content: `In this mode we do something a bit unusual.

We call up the sense of "me" on purpose, so that it can be examined like any other object in experience.

Nothing is forced.

If at any point this feels like too much for today, you can ease off or stop the practice. That is completely okay.`,
            milestone: true
        },
        {
            id: 'mode2-calling',
            type: 'text',
            content: `Let your body stay relatively relaxed.

You do not need to throw away the spaciousness we touched.

From here, choose one word inside your mind:

"I." Or "me." Or "mine."

Pick whichever feels most charged or meaningful to you.`
        },
        {
            id: 'mode2-calling-2',
            type: 'pause',
            content: `In a moment, you will repeat that word silently three to five times with real feeling. Not mechanically.

You let that word point directly to yourself.

Go ahead and do that now.

Repeat it a few times inside.

Then pause and simply feel what shows up.`,
            duration: 15
        },
        // Where is it felt?
        {
            id: 'me-location',
            type: 'choice',
            content: `Now, notice where this "me" is most strongly felt.`,
            stateKey: 'me_location',
            options: [
                { value: 'head', label: 'Head / face' },
                { value: 'throat', label: 'Throat / neck' },
                { value: 'chest', label: 'Chest / heart' },
                { value: 'gut', label: 'Stomach / solar plexus / gut' },
                { value: 'other', label: 'Other' }
            ],
            milestone: true
        },
        {
            id: 'me-intensity',
            type: 'scale',
            content: `How intense is this sensation?`,
            stateKey: 'me_intensity',
            options: [
                { value: 1, label: 'Very faint' },
                { value: 2, label: 'Mild' },
                { value: 3, label: 'Moderate' },
                { value: 4, label: 'Strong' },
                { value: 5, label: 'Very intense' }
            ]
        },
        {
            id: 'mode2-investigate-intro',
            type: 'text',
            content: `Good.

We will stay with that place for a little while and get to know it as clearly as we can.

Whatever is here is allowed to be here.

You do not need to fix it or make it spiritual.`
        },
        // Investigating the Knot
        {
            id: 'mode2-investigate',
            type: 'text',
            content: `Bring your attention gently but steadily to that region.

This cluster of sensations that appeared when you repeated "I" or "me" or "mine".

For the next minute, you will observe it like a scientist studying something under a microscope.`,
            milestone: true
        },
        {
            id: 'mode2-investigate-2',
            type: 'text',
            content: `First, feel into the middle of this cluster.

Does it seem to have a shape? Round, narrow, dense, cloudy, sharp?

Let the mind answer softly.

Is there a sense of size? Is it as big as a coin? As big as a fist? Larger? Smaller?`
        },
        {
            id: 'mode2-investigate-3',
            type: 'pause',
            content: `Does it feel still, or does it move, pulse, vibrate?

If you move your attention to what feels like the edges of this cluster, do you sense a border where it ends and other sensations begin?

Or does it just fade into the rest of the body?

Take a few breaths to explore.`,
            duration: 25
        },
        {
            id: 'mode2-awareness',
            type: 'pause',
            content: `Now notice something important.

The simple awareness that knows these sensations right now.

Is that awareness stuck inside the sensation?

Or does the sensation appear inside that awareness?

Do not think too hard. Feel it directly.`,
            duration: 15
        },
        // Subject or Object?
        {
            id: 'subject-object',
            type: 'choice',
            content: `Right now, how does this "me-sensation" feel to you?`,
            stateKey: 'subject_object',
            options: [
                { value: 'subject', label: 'This feels like what I truly am' },
                { value: 'object', label: 'This feels like something happening in me' },
                { value: 'unsure', label: 'Not sure' }
            ],
            branches: {
                'subject': 'response-subject',
                'object': 'response-object',
                'unsure': 'response-unsure'
            },
            milestone: true
        },
        {
            id: 'response-subject',
            type: 'text',
            content: `Thank you for answering honestly.

This is exactly why we are doing this practice.

Stay with this sensation a bit longer.

Look even more closely, without trying to get rid of it.`,
            next: 'response-subject-2'
        },
        {
            id: 'response-subject-2',
            type: 'pause',
            content: `Is it completely solid and unchanging?

Or does it already have some movement, some texture, some fluctuation?

Anything that can be watched like this belongs on the side of "things that appear".

Let that sink in gently.`,
            duration: 15,
            next: 'unwind'
        },
        {
            id: 'response-object',
            type: 'pause',
            content: `Beautiful.

You are already sensing a gap.

There is this cluster of sensation.

And there is the one that notices it.

We are not pushing the sensation away.

We are simply letting it move from "subject" to "object".

Keep feeling it with this sense that it is appearing in something wider.`,
            duration: 15,
            next: 'unwind'
        },
        {
            id: 'response-unsure',
            type: 'pause',
            content: `"Not sure" is also a very honest place.

You do not have to force any conclusion.

Just keep feeling:

There is the sensation.

There is the awareness of it.

Your system is learning the difference even if the mind cannot name it yet.`,
            duration: 15,
            next: 'unwind'
        },
        // Let It Unwind
        {
            id: 'unwind',
            type: 'text',
            content: `Stay with this "me-sensation" for a few more breaths.

If it feels stronger, that is okay.

If it softens, that is okay.

You are not here to win against it.

You are here to see it clearly.`
        },
        {
            id: 'unwind-2',
            type: 'pause',
            content: `As you stay with it, also notice the space around it.

The area just outside it. The air around the body.

The wider field inside which this knot appears.

Let your attention include both the knot and the surrounding space.

Then allow your attention to widen to the whole body again.`,
            duration: 25
        },
        // Return to Mode 1
        {
            id: 'return-mode1',
            type: 'text',
            content: `Now let us return again to the spacious mode.

For the next minute, let go of any effort to look for "me".

Let sensations do whatever they do.

Let thoughts do whatever they do.`,
            milestone: true
        },
        {
            id: 'return-mode1-2',
            type: 'pause',
            content: `Simply notice the whole inner field as space in which everything appears.

Feel the whole body as one open field.

Hear the sounds.

Notice that awareness is already here, before you do anything about it.

For a little while, just rest as this open awareness.`,
            duration: 25
        },
        // Comparison
        {
            id: 'comparison',
            type: 'choice',
            content: `Right now, how present does the "me" feel compared to earlier?`,
            stateKey: 'me_comparison',
            options: [
                { value: 'stronger', label: 'Stronger than before' },
                { value: 'same', label: 'About the same' },
                { value: 'lighter', label: 'Lighter / less sticky' }
            ],
            branches: {
                'stronger': 'comparison-stronger',
                'same': 'comparison-same',
                'lighter': 'comparison-lighter'
            }
        },
        {
            id: 'comparison-stronger',
            type: 'text',
            content: `That is okay.

Sometimes when we bring light to the sense of "me", it reacts and feels stronger for a while.

It is like stirring something that has been sitting at the bottom for a long time.

The important thing is that it is no longer completely hidden.

In future sessions, we will do more cycles. For today, just notice that even this stronger "me-feeling" is appearing inside the same open awareness.`,
            next: 'integration'
        },
        {
            id: 'comparison-same',
            type: 'text',
            content: `Good.

You are learning to move between these two modes with more awareness.

Over time, the difference will become clearer and the "me-knot" will feel less convincing.`,
            next: 'integration'
        },
        {
            id: 'comparison-lighter',
            type: 'text',
            content: `Beautiful.

That lightening is exactly the kind of shift that matters here.

We are not aiming for dramatic fireworks.

We are aiming for the knot of "me" to slowly lose its grip.`,
            next: 'integration'
        },
        // Integration
        {
            id: 'integration',
            type: 'text',
            content: `In this session you have visited two modes.

One mode where experience is open and selfless, and no clear "me" can be found.

Another mode where the sense of "me" appears as sensations and energy in the body.

Both modes appear in the same awareness.`,
            milestone: true
        },
        {
            id: 'integration-2',
            type: 'text',
            content: `With this practice, you are training yourself to:

Recognise the selfless spacious mode clearly.

Recognise the "me-knot" as an object in that mode, not as what you are.

Over time, alternating like this weakens the habit of identifying with the knot.

It is like a story that gradually stops making sense.`
        },
        // Reflection
        {
            id: 'reflection',
            type: 'input',
            content: `In one or two sentences, how would you describe what you noticed during this session?`,
            stateKey: 'reflection',
            placeholder: 'Share your reflection...'
        },
        {
            id: 'reflection-response',
            type: 'text',
            content: `Thank you.

There is no right way to describe this.

Even something like "it felt a bit more spacious" or "the 'me' felt more like a sensation" is important.`
        },
        // Closing
        {
            id: 'closing',
            type: 'text',
            content: `Before we finish, bring more attention back to your surroundings.

Feel the weight of your body on the chair.

Feel your hands.

Notice the sounds in the room.`,
            milestone: true
        },
        {
            id: 'closing-2',
            type: 'text',
            content: `Take one slightly deeper breath in.

And out.

When you are ready, let your eyes open or become more engaged if they were already open.`
        },
        {
            id: 'closing-3',
            type: 'text',
            content: `You can repeat this session or a shorter version another day.

What matters is not doing it perfectly.

What matters is gradually seeing more clearly what you are, and what you are not.

Thank you for practicing.`
        }
    ]
};

// Get practice by ID
function getPractice(practiceId) {
    switch (practiceId) {
        case '2pf-full':
            return PRACTICE_2PF_FULL;
        default:
            return null;
    }
}

// Start awaken practice
async function startAwakenPractice(practiceId) {
    console.log('Starting practice:', practiceId);
    
    const practice = getPractice(practiceId);
    if (!practice) {
        showToast('Practice not found', 'error');
        return;
    }
    
    if (!practice.steps || practice.steps.length === 0) {
        showToast('Practice has no steps', 'error');
        return;
    }
    
    console.log('Practice loaded with', practice.steps.length, 'steps');
    
    // Initialize session
    awakenSession.active = true;
    awakenSession.practiceId = practiceId;
    awakenSession.currentStepIndex = 0;
    awakenSession.steps = practice.steps;
    awakenSession.responses = {};
    awakenSession.startedAt = new Date().toISOString();
    
    // Count milestones for progress
    awakenSession.totalMilestones = practice.steps.filter(s => s.milestone).length;
    awakenSession.currentMilestone = 0;
    
    // Show session view
    showView('awakenSession');
    
    // Small delay to ensure view is visible, then render first step
    setTimeout(() => {
        console.log('Rendering first step, index:', awakenSession.currentStepIndex);
        renderSessionStep();
    }, 100);
}

// Render current session step
function renderSessionStep() {
    console.log('renderSessionStep called, index:', awakenSession.currentStepIndex, 'total steps:', awakenSession.steps?.length);
    
    if (!awakenSession.steps || awakenSession.steps.length === 0) {
        console.error('No steps available');
        showToast('Session error: no steps', 'error');
        showView('awaken');
        return;
    }
    
    const step = awakenSession.steps[awakenSession.currentStepIndex];
    if (!step) {
        console.log('No more steps, completing session');
        completeSession();
        return;
    }
    
    console.log('Rendering step:', step.id, step.type);
    
    const textEl = document.getElementById('sessionText');
    const timerEl = document.getElementById('sessionTimer');
    const optionsEl = document.getElementById('sessionOptions');
    const inputEl = document.getElementById('sessionInputContainer');
    const continueBtn = document.getElementById('sessionContinueBtn');
    
    // Reset visibility
    timerEl.classList.add('hidden');
    optionsEl.classList.add('hidden');
    inputEl.classList.add('hidden');
    continueBtn.classList.remove('hidden');
    continueBtn.disabled = false;
    
    // Set content
    textEl.innerHTML = step.content.split('\n\n').map(p => `<p>${p}</p>`).join('');
    
    // Update progress if milestone
    if (step.milestone) {
        awakenSession.currentMilestone++;
    }
    renderProgressDots();
    
    // Handle step type
    switch (step.type) {
        case 'text':
            // Just show continue button
            break;
            
        case 'pause':
            continueBtn.classList.add('hidden');
            timerEl.classList.remove('hidden');
            startSessionTimer(step.duration);
            break;
            
        case 'scale':
        case 'choice':
            continueBtn.classList.add('hidden');
            optionsEl.classList.remove('hidden');
            renderOptions(step);
            break;
            
        case 'input':
            document.getElementById('sessionTextInput').value = '';
            document.getElementById('sessionTextInput').placeholder = step.placeholder || 'Share your thoughts...';
            inputEl.classList.remove('hidden');
            break;
    }
}

// Render options for scale/choice steps
function renderOptions(step) {
    const optionsEl = document.getElementById('sessionOptions');
    
    optionsEl.innerHTML = step.options.map(opt => `
        <button class="session-option" onclick="selectOption('${step.stateKey}', '${opt.value}', ${step.branches ? 'true' : 'false'})">
            ${opt.label}
        </button>
    `).join('');
}

// Select an option
function selectOption(stateKey, value, hasBranches) {
    awakenSession.responses[stateKey] = value;
    
    // Visual feedback
    document.querySelectorAll('.session-option').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.textContent.trim() === document.querySelector(`.session-option[onclick*="'${value}'"]`)?.textContent.trim()) {
            btn.classList.add('selected');
        }
    });
    
    // Short delay then advance
    setTimeout(() => {
        const step = awakenSession.steps[awakenSession.currentStepIndex];
        
        if (hasBranches && step.branches && step.branches[value]) {
            // Find branch step by id
            const branchId = step.branches[value];
            const branchIndex = awakenSession.steps.findIndex(s => s.id === branchId);
            if (branchIndex !== -1) {
                awakenSession.currentStepIndex = branchIndex;
            } else {
                awakenSession.currentStepIndex++;
            }
        } else {
            awakenSession.currentStepIndex++;
        }
        
        renderSessionStep();
    }, 300);
}

// Start session timer
function startSessionTimer(duration) {
    awakenSession.timerRemaining = duration;
    const totalDuration = duration;
    
    updateSessionTimerDisplay();
    
    awakenSession.timerInterval = setInterval(() => {
        awakenSession.timerRemaining--;
        updateSessionTimerDisplay();
        
        // Update progress bar
        const progress = ((totalDuration - awakenSession.timerRemaining) / totalDuration) * 100;
        document.getElementById('sessionTimerProgress').style.width = `${100 - progress}%`;
        
        if (awakenSession.timerRemaining <= 0) {
            clearInterval(awakenSession.timerInterval);
            awakenSession.timerInterval = null;
            advanceSession();
        }
    }, 1000);
}

// Update awaken session timer display
function updateSessionTimerDisplay() {
    const minutes = Math.floor(awakenSession.timerRemaining / 60);
    const seconds = awakenSession.timerRemaining % 60;
    document.getElementById('sessionTimerDisplay').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Advance to next step
function advanceSession() {
    // Clear any running timer
    if (awakenSession.timerInterval) {
        clearInterval(awakenSession.timerInterval);
        awakenSession.timerInterval = null;
    }
    
    const step = awakenSession.steps[awakenSession.currentStepIndex];
    
    // Save input if this was an input step
    if (step.type === 'input' && step.stateKey) {
        awakenSession.responses[step.stateKey] = document.getElementById('sessionTextInput').value;
    }
    
    // Handle explicit next step
    if (step.next) {
        const nextIndex = awakenSession.steps.findIndex(s => s.id === step.next);
        if (nextIndex !== -1) {
            awakenSession.currentStepIndex = nextIndex;
        } else {
            awakenSession.currentStepIndex++;
        }
    } else {
        awakenSession.currentStepIndex++;
    }
    
    // Check if we've reached the end
    if (awakenSession.currentStepIndex >= awakenSession.steps.length) {
        completeSession();
        return;
    }
    
    renderSessionStep();
}

// Render progress dots
function renderProgressDots() {
    const progressEl = document.getElementById('sessionProgress');
    const total = awakenSession.totalMilestones;
    const current = awakenSession.currentMilestone;
    
    let dots = '';
    for (let i = 0; i < total; i++) {
        if (i < current - 1) {
            dots += '<div class="progress-dot completed"></div>';
        } else if (i === current - 1) {
            dots += '<div class="progress-dot current"></div>';
        } else {
            dots += '<div class="progress-dot"></div>';
        }
    }
    
    progressEl.innerHTML = dots;
}

// Confirm exit session
function confirmExitSession() {
    document.getElementById('exitSessionModal').classList.add('active');
}

// Close exit modal
function closeExitModal() {
    document.getElementById('exitSessionModal').classList.remove('active');
}

// Exit session
function exitSession() {
    closeExitModal();
    
    // Clear timer
    if (awakenSession.timerInterval) {
        clearInterval(awakenSession.timerInterval);
        awakenSession.timerInterval = null;
    }
    
    // Reset session state
    awakenSession.active = false;
    awakenSession.practiceId = null;
    
    showView('awaken');
}

// Complete session
async function completeSession() {
    // Clear timer if any
    if (awakenSession.timerInterval) {
        clearInterval(awakenSession.timerInterval);
        awakenSession.timerInterval = null;
    }
    
    // Save session to backend
    try {
        const params = new URLSearchParams({
            action: 'saveAwakenSession',
            userId: state.currentUser.user_id,
            practiceId: awakenSession.practiceId,
            startedAt: awakenSession.startedAt,
            completedAt: new Date().toISOString(),
            spaciousness_1: awakenSession.responses.spaciousness_1 || '',
            spaciousness_2: awakenSession.responses.spaciousness_2 || '',
            me_found: awakenSession.responses.me_found || '',
            clarity: awakenSession.responses.clarity || '',
            me_location: awakenSession.responses.me_location || '',
            me_intensity: awakenSession.responses.me_intensity || '',
            subject_object: awakenSession.responses.subject_object || '',
            me_comparison: awakenSession.responses.me_comparison || '',
            did_second_cycle: 'false',
            reflection: awakenSession.responses.reflection || ''
        });
        
        await fetch(`${API_URL}?${params.toString()}`);
    } catch (error) {
        console.error('Error saving awaken session:', error);
    }
    
    // Build summary
    const summaryEl = document.getElementById('completeSummary');
    let summaryHTML = '';
    
    if (awakenSession.responses.spaciousness_1) {
        const labels = ['Very tight', 'A bit tight', 'Neutral', 'Somewhat spacious', 'Very spacious'];
        summaryHTML += `
            <div class="summary-item">
                <span class="summary-label">Initial spaciousness</span>
                <span class="summary-value">${labels[awakenSession.responses.spaciousness_1 - 1]}</span>
            </div>
        `;
    }
    
    if (awakenSession.responses.me_location) {
        const locationLabels = {
            'head': 'Head / face',
            'throat': 'Throat / neck',
            'chest': 'Chest / heart',
            'gut': 'Stomach / gut',
            'other': 'Other'
        };
        summaryHTML += `
            <div class="summary-item">
                <span class="summary-label">Me-sensation location</span>
                <span class="summary-value">${locationLabels[awakenSession.responses.me_location]}</span>
            </div>
        `;
    }
    
    if (awakenSession.responses.subject_object) {
        const soLabels = {
            'subject': 'Felt like true self',
            'object': 'Felt like sensation in me',
            'unsure': 'Not sure'
        };
        summaryHTML += `
            <div class="summary-item">
                <span class="summary-label">Me-sensation perception</span>
                <span class="summary-value">${soLabels[awakenSession.responses.subject_object]}</span>
            </div>
        `;
    }
    
    if (awakenSession.responses.me_comparison) {
        const compLabels = {
            'stronger': 'Stronger than before',
            'same': 'About the same',
            'lighter': 'Lighter / less sticky'
        };
        summaryHTML += `
            <div class="summary-item">
                <span class="summary-label">After comparison</span>
                <span class="summary-value">${compLabels[awakenSession.responses.me_comparison]}</span>
            </div>
        `;
    }
    
    summaryEl.innerHTML = summaryHTML || '<p style="text-align: center; color: var(--text-muted);">Session recorded</p>';
    
    // Show complete view
    showView('awakenComplete');
}

// Finish awaken session (return to launcher)
function finishAwakenSession() {
    console.log('finishAwakenSession called');
    awakenSession.active = false;
    awakenSession.practiceId = null;
    
    // Refresh completed count
    updateAwakenLauncher();
    
    showView('awaken');
}

// Update awaken launcher with completed count
async function updateAwakenLauncher() {
    if (!state.currentUser) return;
    
    try {
        const data = await apiCall('getAwakenSessions', {
            userId: state.currentUser.user_id,
            practiceId: '2pf-full',
            limit: 1
        });
        
        const count = data?.completedCount || 0;
        const el = document.getElementById('practice2pfCompleted');
        if (el) {
            el.textContent = `✓ ${count} session${count !== 1 ? 's' : ''}`;
        }
    } catch (error) {
        console.error('Error loading awaken sessions:', error);
    }
}

// ============================================
// PROFILE & INTENTIONS
// ============================================

let currentEditingIntention = null;

const intentionHelpers = {
    release_beliefs: "What beliefs hold you back? (e.g., 'I'm not good enough', 'I don't deserve success'). Describe how you'd like to transform them.",
    release_emotions: "List the negative emotions (fears, doubts, guilt, shame, anger, resentment) you frequently experience. How would you feel without them?",
    release_trauma: "Describe any past trauma, addictions, or bad habits you're ready to let go of. Imagine how your life will change without them.",
    raise_consciousness: "Envision living fully in the present moment. Describe your journey towards realizing your True Self.",
    raise_intelligences: "Which intelligences do you want to strengthen? (Cognitive, Emotional, Spiritual, Somatic, Interpersonal, Moral, Creative). Specify areas for focused development.",
    realize_health: "Paint a picture of your life with optimal health. How does it influence your daily activities and overall happiness?",
    realize_wealth: "Describe your ideal career path and financial status. How do these aspects contribute to your sense of fulfillment?",
    realize_relationships: "Describe the ideal state of relationships in your life, focusing on the qualities of connections you wish to cultivate.",
    realize_other: "List any other intentions, goals, or short-term objectives you're aiming for."
};

const intentionLabels = {
    release_beliefs: "Limiting Beliefs & Blocks",
    release_emotions: "Negative Patterns",
    release_trauma: "Trauma & Habits",
    raise_consciousness: "Consciousness & Presence",
    raise_intelligences: "Developing Capacities",
    realize_health: "Health & Vitality",
    realize_wealth: "Abundance & Purpose",
    realize_relationships: "Relationships & Connection",
    realize_other: "Other Intentions"
};

const intentionPlaceholders = {
    release_beliefs: "What beliefs hold you back? Tap to add...",
    release_emotions: "What emotions do you want to release? Tap to add...",
    release_trauma: "What patterns are you ready to let go of? Tap to add...",
    raise_consciousness: "Describe your vision of living fully present. Tap to add...",
    raise_intelligences: "Which intelligences do you want to strengthen? Tap to add...",
    realize_health: "Describe your optimal state of health. Tap to add...",
    realize_wealth: "What does fulfilling work look like for you? Tap to add...",
    realize_relationships: "Describe the quality of relationships you want. Tap to add...",
    realize_other: "Any other goals or dreams? Tap to add..."
};

function updateProfileView() {
    // Update username
    const usernameEl = document.getElementById('profileUsername');
    if (usernameEl && state.currentUser) {
        usernameEl.textContent = state.currentUser.name;
    }
    
    // Update network connection state
    const networkCard = document.getElementById('networkCard');
    const networkToggle = document.getElementById('networkConnectedToggle');
    
    if (networkCard && networkToggle) {
        const isConnected = state.intentions?.network_connected || false;
        networkToggle.checked = isConnected;
        networkCard.classList.toggle('connected', isConnected);
        
        const statusEl = document.getElementById('networkStatus');
        if (statusEl) {
            if (isConnected) {
                statusEl.textContent = "Connected. Energy work aligned with your intentions is being channeled to support your journey.";
            } else {
                statusEl.textContent = "I open myself to receive energy work that serves my highest good and spiritual evolution.";
            }
        }
    }
    
    // Update intention previews
    updateIntentionPreviews();
}

function updateIntentionPreviews() {
    const fields = [
        'release_beliefs', 'release_emotions', 'release_trauma',
        'raise_consciousness', 'raise_intelligences',
        'realize_health', 'realize_wealth', 'realize_relationships', 'realize_other'
    ];
    
    fields.forEach(field => {
        const previewEl = document.getElementById(`preview_${field}`);
        const cardEl = previewEl?.closest('.intention-card');
        
        if (previewEl) {
            const value = state.intentions?.[field] || '';
            if (value) {
                // Truncate to ~100 chars for preview
                previewEl.textContent = value.length > 100 ? value.substring(0, 100) + '...' : value;
                cardEl?.classList.add('has-content');
            } else {
                previewEl.textContent = intentionPlaceholders[field];
                cardEl?.classList.remove('has-content');
            }
        }
    });
}

function switchIntentionTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.intention-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update content panels
    document.getElementById('intentionRelease').classList.toggle('active', tab === 'release');
    document.getElementById('intentionRaise').classList.toggle('active', tab === 'raise');
    document.getElementById('intentionRealize').classList.toggle('active', tab === 'realize');
}

function editIntention(field) {
    currentEditingIntention = field;
    
    const modal = document.getElementById('intentionModal');
    const titleEl = document.getElementById('intentionModalTitle');
    const helperEl = document.getElementById('intentionHelper');
    const textareaEl = document.getElementById('intentionTextarea');
    
    titleEl.textContent = intentionLabels[field] || 'Edit Intention';
    helperEl.textContent = intentionHelpers[field] || 'Describe your intention...';
    textareaEl.value = state.intentions?.[field] || '';
    textareaEl.placeholder = "Take your time to articulate what you truly want...";
    
    modal.classList.add('active');
    
    // Focus textarea after animation
    setTimeout(() => textareaEl.focus(), 100);
}

function closeIntentionModal() {
    currentEditingIntention = null;
    document.getElementById('intentionModal').classList.remove('active');
}

async function saveIntention() {
    if (!currentEditingIntention || !state.currentUser) return;
    
    const textareaEl = document.getElementById('intentionTextarea');
    const value = textareaEl.value.trim();
    
    try {
        const params = new URLSearchParams({
            action: 'saveIntentions',
            userId: state.currentUser.user_id,
            [currentEditingIntention]: value
        });
        
        const response = await fetch(`${API_URL}?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
            // Update local state
            if (!state.intentions) {
                state.intentions = {
                    user_id: state.currentUser.user_id,
                    network_connected: false
                };
            }
            state.intentions[currentEditingIntention] = value;
            
            // Update UI
            updateIntentionPreviews();
            closeIntentionModal();
            showToast('Intention saved', 'success');
        } else {
            throw new Error(result.error || 'Failed to save intention');
        }
    } catch (error) {
        console.error('Error saving intention:', error);
        showToast('Failed to save intention', 'error');
    }
}

async function toggleNetworkConnection(connected) {
    if (!state.currentUser) return;
    
    try {
        const params = new URLSearchParams({
            action: 'saveIntentions',
            userId: state.currentUser.user_id,
            network_connected: connected
        });
        
        const response = await fetch(`${API_URL}?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
            // Update local state
            if (!state.intentions) {
                state.intentions = {
                    user_id: state.currentUser.user_id,
                    network_connected: connected
                };
            } else {
                state.intentions.network_connected = connected;
            }
            
            // Update UI
            const networkCard = document.getElementById('networkCard');
            const statusEl = document.getElementById('networkStatus');
            
            if (networkCard) {
                networkCard.classList.toggle('connected', connected);
            }
            
            if (statusEl) {
                if (connected) {
                    statusEl.textContent = "Connected. Energy work aligned with your intentions is being channeled to support your journey.";
                } else {
                    statusEl.textContent = "I open myself to receive energy work that serves my highest good and spiritual evolution.";
                }
            }
            
            showToast(connected ? 'Connected to Clear Ground Network' : 'Disconnected from network', 'success');
        } else {
            throw new Error(result.error || 'Failed to update connection');
        }
    } catch (error) {
        console.error('Error toggling network connection:', error);
        // Revert toggle
        document.getElementById('networkConnectedToggle').checked = !connected;
        showToast('Failed to update connection', 'error');
    }
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
        await loadTransmissions();
        await loadIntentions();
        updateDashboard();
        populateTransmissionsDropdown();
        renderTransmissionsList();
        updateProfileView();
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
// SIGNAL FEATURE
// ============================================

// Sample signal data (will be replaced with .md file loading later)
const SIGNAL_DATA = {
    recognize: [
        {
            id: 'recognize-1',
            number: 1,
            title: 'Increase your sense of agency by focusing on what you can control',
            content: `Feeling powerless often comes from staring at everything you can't change—other people's behavior, the past, the economy, your childhood. Agency begins the moment you pivot your attention to what is still in your hands. This shift is subtle but profound: instead of asking, "Why is this happening to me?" you begin asking, "Given that this is happening, what can I do next?" The facts may not change, but your relationship to them does.

A practical way to build agency is to draw a mental (or literal) circle. Outside the circle: other people's choices, world events, your genetics. Inside: your attitude, your preparation, what you say, how you spend the next 10 minutes. When you feel overwhelmed, name one thing outside your control, then immediately identify one thing inside it and act on that. Send the email. Drink the water. Clean the counter. Make the call.

These small, controllable actions are not trivial; they're votes for a new identity. Over time, you train your brain to look for levers instead of limits. You begin to trust yourself as someone who responds, not just someone life happens to. The circumstances may still be hard, but you're no longer waiting to be rescued—you're participating in your own rescue, one choice at a time.`
        },
        {
            id: 'recognize-2',
            number: 2,
            title: 'Say "do" instead of "try" to strengthen commitment',
            content: `Language doesn't just describe your reality; it shapes it. When you say, "I'll try to work out this week," you're already giving yourself an escape hatch. "Try" leaves the door open for backing out without feeling like you broke a promise. It sounds reasonable, even humble, but it often hides a lack of commitment. "Do," on the other hand, is a line in the sand: "I will work out on Tuesday at 7 a.m."

Start listening to how often you soften your intentions with "try," "maybe," or "hopefully." Instead of beating yourself up, use each one as a signal to get clearer. Swap "I'll try to eat better" for "I will cook dinner at home three nights this week." That tiny linguistic upgrade forces you to be specific: when, where, and what "do" actually means.

This matters because your brain takes your words seriously. When you repeatedly say "I'll try" and then don't follow through, you quietly train yourself not to trust your own promises. When you say "I will" and then act, even in a small way, you build self-respect. You become someone whose word—to yourself—means something. Over time, that integrity creates a much deeper, sturdier confidence than any motivational pep talk.`
        },
        {
            id: 'recognize-3',
            number: 3,
            title: 'Treat procrastination as a stress-driven habit you can change',
            content: `Most people label themselves as "lazy" or "undisciplined" when they procrastinate. That story feels true, but it's incomplete. Procrastination is rarely about the task itself; it's a coping strategy your brain learned to manage uncomfortable feelings—stress, anxiety, self-doubt, overwhelm. In that sense, it's not a character flaw. It's a habit loop: you feel stress, you avoid the task, you get temporary relief, and your brain learns, "Avoiding works!"

Seeing procrastination as a habit is powerful because habits can be changed. You start by noticing the moment right before you put something off. What are you feeling in your body—tight chest, racing thoughts, heavy fatigue? What story is running—"I'll mess this up," "It's too much," "I don't know where to start"? Naming the stress opens a tiny gap between you and the habit.

From there, you can experiment with a different response that still soothes you but moves you forward: starting for five minutes, breaking the task into one tiny step, or using a countdown to launch action. The goal isn't to never feel stress. It's to stop letting stress automatically drive you into avoidance. When you treat procrastination as a learned pattern—not your identity—you reclaim your power to install a new one.`
        }
    ],
    create: [
        {
            id: 'create-1',
            number: 276,
            title: 'Reframe desired outcomes as memories to produce relief, not longing',
            content: `Longing keeps the desired object psychologically distant. You imagine it in the future, accompanied by a sense of "not yet" and "not mine." Reframing outcomes as memories flips this script. You imagine yourself remembering the fulfillment, talking about it as if it already happened. This subtle shift often produces a wave of relief, as though the tension of "Will it ever?" has been resolved.

Pick a desire and imagine you are six months or a year past its fulfillment. You're telling a friend how it all unfolded. "It was funny how it started... then this opportunity came... and now it's just part of life." Let yourself feel the afterglow, the casualness that comes once something is integrated into your story. You're no longer reaching for it; you're recollecting it.

Notice how your body responds. If you feel a softening or a sense of "Ah, yes," you're successfully moving from craving to completion emotionally. The point is not to predict exact details but to experience the internal state of "this chapter turned out well." Carry some of that feeling into your day. From this place, you're less likely to act out of desperation and more likely to make choices that belong in the version of your life you just "remembered."`
        },
        {
            id: 'create-2',
            number: 277,
            title: 'Use contrast to clarify what you actually want',
            content: `Sometimes you don't know what you want until you bump into what you don't want. Contrast is one of life's most reliable teachers. That job you hated? It taught you that autonomy matters more than you realized. That relationship that felt off? It showed you the kind of connection you're actually hungry for. Rather than seeing "negative" experiences as failures, treat them as data points sharpening your preferences.

When something feels wrong, don't just push against it. Pause and ask, "What is this showing me about what I do want?" Let the discomfort become a compass. If you feel drained around certain people, that's information about the qualities you value in relationships. If a project bores you, it's pointing toward what genuinely engages your mind.

The key is to pivot from complaint to clarity. Instead of dwelling on "I hate this," translate it: "This tells me I want more creativity, more meaningful challenge, more respect." Once you name the positive desire underneath the negative reaction, you have something to move toward. Contrast isn't meant to trap you—it's meant to launch you into clearer intentions.`
        },
        {
            id: 'create-3',
            number: 278,
            title: 'Act as if the bridge will appear',
            content: `When you set a meaningful intention, you often can't see the full path from here to there. The logical mind wants a detailed roadmap before it will commit. But reality often works differently. You take a step based on a hunch, and only then does the next stepping-stone reveal itself. Acting "as if" isn't about delusion; it's about creating motion so that possibilities can meet you halfway.

Think of it like driving at night with headlights. You can only see a short distance ahead, but you can make the whole journey that way. You don't demand to see the entire road before you turn the key. The same applies to goals and desires. Commit to the direction, take the first small action, and trust that clarity will build as you move.

This doesn't mean ignoring practical concerns. It means refusing to let uncertainty paralyze you. When you act in alignment with what you want—speaking, preparing, reaching out—you send a signal to yourself and the world. Resources, ideas, and people often show up not before you need them, but just in time. The bridge appears under your feet as you walk.`
        }
    ]
};

// Signal state
const signalState = {
    currentSignal: null,
    currentCategory: 'all',
    isFavorited: false,
    steps: [],          // Parsed content steps for reader
    currentStep: 0,     // Current step in reader
    history: [],        // Local history cache
    stats: {
        todayCount: 0,
        todayDate: null,
        currentStreak: 0,
        longestStreak: 0,
        totalCompleted: 0
    },
    settings: {
        signalsPerDay: 1,
        windowStart: 8,
        windowEnd: 20,
        categoriesEnabled: ['recognize', 'create'],
        categoryRatios: { recognize: 50, create: 50 },
        notificationsEnabled: true
    }
};

// Initialize signal state from localStorage
function initSignalState() {
    try {
        const saved = localStorage.getItem('signalState');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(signalState.history, parsed.history || []);
            Object.assign(signalState.stats, parsed.stats || {});
            Object.assign(signalState.settings, parsed.settings || {});
        }
        
        // Check if it's a new day
        const today = new Date().toDateString();
        if (signalState.stats.todayDate !== today) {
            // Check streak
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (signalState.stats.todayDate === yesterday.toDateString() && signalState.stats.todayCount > 0) {
                // Streak continues
            } else if (signalState.stats.todayCount > 0) {
                // Streak broken (missed more than one day)
                signalState.stats.currentStreak = 0;
            }
            
            // Reset daily count
            signalState.stats.todayCount = 0;
            signalState.stats.todayDate = today;
            saveSignalState();
        }
        
        updateSignalHomeCard();
    } catch (e) {
        console.error('Error initializing signal state:', e);
    }
}

// Save signal state to localStorage
function saveSignalState() {
    try {
        localStorage.setItem('signalState', JSON.stringify({
            history: signalState.history,
            stats: signalState.stats,
            settings: signalState.settings
        }));
    } catch (e) {
        console.error('Error saving signal state:', e);
    }
}

// Update signal view
function updateSignalView() {
    updateSignalStats();
    
    // Reset to prompt view
    document.getElementById('signalPrompt').classList.remove('hidden');
    document.getElementById('signalDisplay').classList.add('hidden');
    signalState.currentSignal = null;
    signalState.isFavorited = false;
}

// Update signal stats display
function updateSignalStats() {
    document.getElementById('signalTodayCount').textContent = signalState.stats.todayCount;
    document.getElementById('signalDailyGoal').textContent = signalState.settings.signalsPerDay;
    document.getElementById('signalCurrentStreak').textContent = signalState.stats.currentStreak;
}

// Update signal home card
function updateSignalHomeCard() {
    const progressEl = document.getElementById('signalTodayProgress');
    const streakEl = document.getElementById('signalStreakDisplay');
    
    if (progressEl) {
        progressEl.textContent = `${signalState.stats.todayCount} of ${signalState.settings.signalsPerDay} today`;
    }
    if (streakEl) {
        streakEl.textContent = `🔥 ${signalState.stats.currentStreak} day streak`;
    }
}

// Update signal category filter
function updateSignalCategory() {
    signalState.currentCategory = document.getElementById('signalCategorySelect').value;
}

// Get random signal
function getRandomSignal() {
    const category = signalState.currentCategory;
    let availableLessons = [];
    
    if (category === 'all') {
        // Use weighted selection based on ratios
        const categories = Object.keys(SIGNAL_DATA);
        const totalWeight = categories.reduce((sum, cat) => sum + (signalState.settings.categoryRatios[cat] || 50), 0);
        const rand = Math.random() * totalWeight;
        let cumulative = 0;
        
        for (const cat of categories) {
            cumulative += (signalState.settings.categoryRatios[cat] || 50);
            if (rand <= cumulative) {
                availableLessons = SIGNAL_DATA[cat] || [];
                signalState.currentCategory = cat; // Track which category was selected
                break;
            }
        }
    } else {
        availableLessons = SIGNAL_DATA[category] || [];
    }
    
    if (availableLessons.length === 0) {
        showToast('No signals available in this category', 'error');
        return;
    }
    
    // Pick random lesson
    const randomIndex = Math.floor(Math.random() * availableLessons.length);
    const lesson = availableLessons[randomIndex];
    
    // Display the signal
    displaySignal(lesson, category === 'all' ? signalState.currentCategory : category);
}

// Display a signal in the step-by-step reader
function displaySignal(lesson, category) {
    signalState.currentSignal = { ...lesson, category };
    signalState.isFavorited = isSignalFavorited(lesson.id);
    
    // Parse content into steps (title + paragraphs)
    const paragraphs = lesson.content.split('\n\n').filter(p => p.trim());
    signalState.steps = [
        { type: 'title', content: lesson.title },
        ...paragraphs.map(p => ({ type: 'paragraph', content: p.trim() }))
    ];
    signalState.currentStep = 0;
    
    // Set category badge
    const badge = document.getElementById('readerCategoryBadge');
    badge.textContent = category.toUpperCase();
    badge.className = 'signal-reader-badge' + (category === 'create' ? ' create' : '');
    
    // Set lesson number
    document.getElementById('readerLessonNumber').textContent = `Lesson ${lesson.number}`;
    
    // Generate dots
    renderSignalDots();
    
    // Show first step
    renderSignalStep();
    
    // Show the reader view
    document.getElementById('viewSignalReader').classList.add('active');
    
    // Record that signal was shown
    recordSignalShown(lesson, category);
}

// Render progress dots
function renderSignalDots() {
    const dotsContainer = document.getElementById('readerDots');
    dotsContainer.innerHTML = signalState.steps.map((_, i) => 
        `<div class="signal-reader-dot ${i === 0 ? 'active' : ''}" data-step="${i}"></div>`
    ).join('');
}

// Render current step
function renderSignalStep() {
    const step = signalState.steps[signalState.currentStep];
    const textEl = document.getElementById('readerText');
    const numberEl = document.getElementById('readerLessonNumber');
    const navEl = document.querySelector('.signal-reader-nav');
    const actionsEl = document.getElementById('readerActions');
    const prevBtn = document.getElementById('readerPrevBtn');
    const nextBtn = document.getElementById('readerNextBtn');
    
    // Animate text change
    textEl.style.animation = 'none';
    textEl.offsetHeight; // Trigger reflow
    textEl.style.animation = 'fadeInUp 0.4s ease';
    
    // Set content based on step type
    if (step.type === 'title') {
        textEl.textContent = step.content;
        textEl.classList.add('title-step');
        numberEl.classList.add('visible');
    } else {
        textEl.textContent = step.content;
        textEl.classList.remove('title-step');
        numberEl.classList.remove('visible');
    }
    
    // Update dots
    document.querySelectorAll('.signal-reader-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === signalState.currentStep);
        dot.classList.toggle('completed', i < signalState.currentStep);
    });
    
    // Handle navigation visibility
    const isFirst = signalState.currentStep === 0;
    const isLast = signalState.currentStep === signalState.steps.length - 1;
    
    prevBtn.disabled = isFirst;
    prevBtn.style.visibility = isFirst ? 'hidden' : 'visible';
    
    if (isLast) {
        // Last step - show actions instead of nav
        navEl.classList.add('hidden');
        actionsEl.classList.remove('hidden');
        updateReaderFavoriteButton();
    } else {
        navEl.classList.remove('hidden');
        actionsEl.classList.add('hidden');
    }
}

// Navigate to previous step
function prevSignalStep() {
    if (signalState.currentStep > 0) {
        signalState.currentStep--;
        renderSignalStep();
    }
}

// Navigate to next step
function nextSignalStep() {
    if (signalState.currentStep < signalState.steps.length - 1) {
        signalState.currentStep++;
        renderSignalStep();
    }
}

// Exit signal reader (X button)
function exitSignalReader() {
    document.getElementById('viewSignalReader').classList.remove('active');
    signalState.currentSignal = null;
    signalState.steps = [];
    signalState.currentStep = 0;
}

// Update favorite button in reader
function updateReaderFavoriteButton() {
    const btn = document.getElementById('readerFavoriteBtn');
    const icon = btn.querySelector('.favorite-icon');
    
    btn.classList.toggle('active', signalState.isFavorited);
    icon.textContent = signalState.isFavorited ? '♥' : '♡';
}

// Record signal shown in history
function recordSignalShown(lesson, category) {
    const record = {
        id: lesson.id,
        lessonNumber: lesson.number,
        title: lesson.title,
        category: category,
        status: 'shown',
        isFavorite: false,
        shownAt: new Date().toISOString(),
        completedAt: null
    };
    
    // Check if already in history (don't duplicate)
    const existingIndex = signalState.history.findIndex(h => 
        h.id === lesson.id && h.shownAt && new Date(h.shownAt).toDateString() === new Date().toDateString()
    );
    
    if (existingIndex === -1) {
        signalState.history.unshift(record);
        // Keep history manageable (last 500 entries)
        if (signalState.history.length > 500) {
            signalState.history = signalState.history.slice(0, 500);
        }
        saveSignalState();
    }
}

// Check if signal is favorited
function isSignalFavorited(lessonId) {
    return signalState.history.some(h => h.id === lessonId && h.isFavorite);
}

// Toggle favorite on current signal
function toggleSignalFavorite() {
    if (!signalState.currentSignal) return;
    
    signalState.isFavorited = !signalState.isFavorited;
    
    // Update history
    const historyItem = signalState.history.find(h => h.id === signalState.currentSignal.id);
    if (historyItem) {
        historyItem.isFavorite = signalState.isFavorited;
    }
    
    updateReaderFavoriteButton();
    saveSignalState();
    
    showToast(signalState.isFavorited ? 'Added to favorites' : 'Removed from favorites', 'success');
}

// Complete signal (Done button)
function completeSignal() {
    if (!signalState.currentSignal) return;
    
    // Update history
    const historyItem = signalState.history.find(h => 
        h.id === signalState.currentSignal.id && h.status === 'shown'
    );
    if (historyItem) {
        historyItem.status = 'completed';
        historyItem.completedAt = new Date().toISOString();
    }
    
    // Update stats
    signalState.stats.todayCount++;
    signalState.stats.totalCompleted++;
    
    // Check if this completes daily goal (for streak)
    if (signalState.stats.todayCount === 1) {
        // First completion of the day - increment streak
        signalState.stats.currentStreak++;
        if (signalState.stats.currentStreak > signalState.stats.longestStreak) {
            signalState.stats.longestStreak = signalState.stats.currentStreak;
        }
    }
    
    saveSignalState();
    updateSignalStats();
    updateSignalHomeCard();
    
    showToast('Signal completed! ✓', 'success');
    
    // Exit reader and return to signal view
    exitSignalReader();
    showView('signal');
}

// Skip signal
function skipSignal() {
    if (!signalState.currentSignal) return;
    
    // Update history
    const historyItem = signalState.history.find(h => 
        h.id === signalState.currentSignal.id && h.status === 'shown'
    );
    if (historyItem) {
        historyItem.status = 'skipped';
    }
    
    saveSignalState();
    
    showToast('Signal skipped', 'success');
    
    // Exit reader and return to signal view
    exitSignalReader();
    showView('signal');
}

// Switch history tab
function switchHistoryTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.history-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    renderSignalHistory(tab);
}

// Render signal history
function renderSignalHistory(tab = 'favorites') {
    const container = document.getElementById('signalHistoryList');
    
    let filteredHistory = [];
    
    switch (tab) {
        case 'favorites':
            filteredHistory = signalState.history.filter(h => h.isFavorite);
            break;
        case 'completed':
            filteredHistory = signalState.history.filter(h => h.status === 'completed');
            break;
        case 'skipped':
            filteredHistory = signalState.history.filter(h => h.status === 'skipped');
            break;
    }
    
    if (filteredHistory.length === 0) {
        const emptyMessages = {
            favorites: 'No favorites yet. Tap ♡ on signals you want to revisit.',
            completed: 'No completed signals yet.',
            skipped: 'No skipped signals.'
        };
        container.innerHTML = `<p class="empty-state">${emptyMessages[tab]}</p>`;
        return;
    }
    
    container.innerHTML = filteredHistory.map(item => {
        const date = new Date(item.shownAt || item.completedAt);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return `
            <div class="signal-history-item" onclick="showHistorySignal('${item.id}')">
                <div class="signal-history-item-header">
                    <span class="signal-history-title">Lesson ${item.lessonNumber}: ${item.title}</span>
                    ${item.isFavorite ? '<span class="signal-history-favorite">♥</span>' : ''}
                </div>
                <div class="signal-history-meta">
                    <span class="signal-history-category">${item.category}</span>
                    <span>${dateStr}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Show signal from history
function showHistorySignal(lessonId) {
    // Find the lesson data
    let lesson = null;
    let category = null;
    
    for (const cat of Object.keys(SIGNAL_DATA)) {
        const found = SIGNAL_DATA[cat].find(l => l.id === lessonId);
        if (found) {
            lesson = found;
            category = cat;
            break;
        }
    }
    
    if (!lesson) {
        showToast('Signal not found', 'error');
        return;
    }
    
    // Get favorite status from history
    const historyItem = signalState.history.find(h => h.id === lessonId);
    
    // Show in modal
    const badge = document.getElementById('modalSignalCategory');
    badge.textContent = category.toUpperCase();
    badge.className = 'signal-category-badge' + (category === 'create' ? ' create' : '');
    
    document.getElementById('modalLessonNumber').textContent = `Lesson ${lesson.number}`;
    document.getElementById('modalLessonTitle').textContent = lesson.title;
    document.getElementById('modalSignalContent').textContent = lesson.content;
    
    // Set favorite button state
    const modalBtn = document.getElementById('modalFavoriteBtn');
    const modalIcon = modalBtn.querySelector('.favorite-icon');
    modalBtn.classList.toggle('active', historyItem?.isFavorite);
    modalIcon.textContent = historyItem?.isFavorite ? '♥' : '♡';
    modalBtn.dataset.lessonId = lessonId;
    
    document.getElementById('signalDetailModal').classList.add('active');
}

// Toggle favorite from modal
function toggleModalFavorite() {
    const btn = document.getElementById('modalFavoriteBtn');
    const lessonId = btn.dataset.lessonId;
    
    const historyItem = signalState.history.find(h => h.id === lessonId);
    if (historyItem) {
        historyItem.isFavorite = !historyItem.isFavorite;
        
        const icon = btn.querySelector('.favorite-icon');
        btn.classList.toggle('active', historyItem.isFavorite);
        icon.textContent = historyItem.isFavorite ? '♥' : '♡';
        
        saveSignalState();
        showToast(historyItem.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
    }
}

// Close signal detail modal
function closeSignalDetailModal() {
    document.getElementById('signalDetailModal').classList.remove('active');
    // Refresh history list in case favorites changed
    const activeTab = document.querySelector('.history-tab.active')?.dataset.tab || 'favorites';
    renderSignalHistory(activeTab);
}

// ============================================
// SIGNAL SETTINGS
// ============================================

// Update signal settings view
function updateSignalSettingsView() {
    const s = signalState.settings;
    const stats = signalState.stats;
    
    // Populate current values
    document.getElementById('signalGoalValue').textContent = s.signalsPerDay;
    document.getElementById('signalWindowStart').value = s.windowStart;
    document.getElementById('signalWindowEnd').value = s.windowEnd;
    
    // Categories
    document.getElementById('signalCatRecognize').checked = s.categoriesEnabled.includes('recognize');
    document.getElementById('signalCatCreate').checked = s.categoriesEnabled.includes('create');
    
    // Ratios
    document.getElementById('signalRatioRecognize').value = s.categoryRatios.recognize || 50;
    document.getElementById('signalRatioCreate').value = s.categoryRatios.create || 50;
    updateCategoryRatios();
    
    // Notifications
    document.getElementById('signalNotificationsEnabled').checked = s.notificationsEnabled;
    
    // Stats
    document.getElementById('settingsSignalTotal').textContent = stats.totalCompleted;
    document.getElementById('settingsSignalStreak').textContent = stats.currentStreak;
    document.getElementById('settingsSignalBest').textContent = stats.longestStreak;
    document.getElementById('settingsSignalFavorites').textContent = 
        signalState.history.filter(h => h.isFavorite).length;
}

// Adjust daily goal
function adjustSignalGoal(delta) {
    const newValue = Math.max(1, Math.min(10, signalState.settings.signalsPerDay + delta));
    signalState.settings.signalsPerDay = newValue;
    document.getElementById('signalGoalValue').textContent = newValue;
    saveSignalSettings();
}

// Update category ratio displays
function updateCategoryRatios() {
    const recognizeVal = parseInt(document.getElementById('signalRatioRecognize').value);
    const createVal = parseInt(document.getElementById('signalRatioCreate').value);
    
    // Normalize to percentages
    const total = recognizeVal + createVal;
    const recognizePct = total > 0 ? Math.round((recognizeVal / total) * 100) : 50;
    const createPct = total > 0 ? Math.round((createVal / total) * 100) : 50;
    
    document.getElementById('recognizeRatio').textContent = `${recognizePct}%`;
    document.getElementById('createRatio').textContent = `${createPct}%`;
}

// Save signal settings
function saveSignalSettings() {
    const s = signalState.settings;
    
    s.signalsPerDay = parseInt(document.getElementById('signalGoalValue').textContent);
    s.windowStart = parseInt(document.getElementById('signalWindowStart').value);
    s.windowEnd = parseInt(document.getElementById('signalWindowEnd').value);
    
    // Categories enabled
    s.categoriesEnabled = [];
    if (document.getElementById('signalCatRecognize').checked) s.categoriesEnabled.push('recognize');
    if (document.getElementById('signalCatCreate').checked) s.categoriesEnabled.push('create');
    
    // Ratios
    const recognizeVal = parseInt(document.getElementById('signalRatioRecognize').value);
    const createVal = parseInt(document.getElementById('signalRatioCreate').value);
    const total = recognizeVal + createVal;
    
    s.categoryRatios = {
        recognize: total > 0 ? Math.round((recognizeVal / total) * 100) : 50,
        create: total > 0 ? Math.round((createVal / total) * 100) : 50
    };
    
    s.notificationsEnabled = document.getElementById('signalNotificationsEnabled').checked;
    
    saveSignalState();
    updateSignalStats();
    updateSignalHomeCard();
    
    showToast('Settings saved', 'success');
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
