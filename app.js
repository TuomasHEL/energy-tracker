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
        
        // Load signal lessons (async, non-blocking)
        loadSignalLessons().then(() => {
            console.log('Signal lessons loaded');
            updateSignalView();
        }).catch(e => console.warn('Signal lessons load error:', e));
        
        // Initialize signal notifications
        initSignalNotifications();
        
        // Initialize habit tracker
        initHabitTracker();
        
        // Initialize attunements
        initAttunements();
        
        // Initialize shadow tools
        initShadow();
        
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
            playlistName: state.playlistRunner.playlist?.name || 'Program',
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
        if (!data.isRunning || !data.items || data.items.length === 0) {
            localStorage.removeItem('playlistState');
            return;
        }
        
        const now = new Date();
        let currentIndex = data.currentIndex || 0;
        let itemEndTime = data.itemEndTime ? new Date(data.itemEndTime) : null;
        
        // Helper function to update the playlist runner UI
        const updatePlaylistRunnerUI = (items, currentIdx, remaining, isPaused) => {
            const currentItem = items[currentIdx];
            
            // Show correct view and panel
            showView('timer');
            document.getElementById('timerSetup')?.classList.add('hidden');
            document.getElementById('timerActive')?.classList.add('hidden');
            document.getElementById('playlistsList')?.classList.add('hidden');
            document.getElementById('playlistRunner')?.classList.remove('hidden');
            
            // Program name and progress
            document.getElementById('runningPlaylistName').textContent = data.playlistName || 'Program';
            document.getElementById('runnerTotalItems').textContent = items.length;
            document.getElementById('runnerCurrentItem').textContent = currentIdx + 1;
            
            // Current item info
            document.getElementById('runnerItemName').textContent = currentItem?.name || 'Item';
            
            // Build item info text
            let infoText = '';
            if (currentItem?.transmission) infoText += currentItem.transmission;
            if (currentItem?.intensity && currentItem.intensity !== 'medium') {
                infoText += infoText ? ` • ${capitalize(currentItem.intensity)}` : capitalize(currentItem.intensity);
            }
            if (currentItem?.customNote) {
                infoText += infoText ? ` • ${currentItem.customNote}` : currentItem.customNote;
            }
            document.getElementById('runnerItemInfo').textContent = infoText;
            
            // Render queue of remaining items
            const queue = items.slice(currentIdx + 1);
            document.getElementById('runnerQueue').innerHTML = queue.map(q => `
                <div class="runner-queue-item">
                    <span>${q.name}</span>
                    <span>${q.duration}m</span>
                </div>
            `).join('');
            
            // Update pause button state
            const pauseBtn = document.getElementById('playlistPauseBtn');
            if (isPaused) {
                pauseBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
            } else {
                pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
            }
        };
        
        // If paused, restore paused state
        if (data.isPaused) {
            state.playlistRunner.isRunning = true;
            state.playlistRunner.isPaused = true;
            state.playlistRunner.items = data.items;
            state.playlistRunner.currentIndex = currentIndex;
            state.playlistRunner.itemRemaining = data.itemRemaining;
            state.playlistRunner.pausedAt = data.pausedAt ? new Date(data.pausedAt) : new Date();
            state.playlistRunner.playlist = { playlist_id: data.playlistId, name: data.playlistName || 'Program' };
            
            updatePlaylistRunnerUI(data.items, currentIndex, data.itemRemaining, true);
            updatePlaylistItemTimer();
            updateHeaderLogo();
            
            showToast('Paused program restored', 'success');
            return;
        }
        
        // Not paused - calculate where we should be based on elapsed time
        if (!itemEndTime) {
            localStorage.removeItem('playlistState');
            return;
        }
        
        // Check if current item has elapsed and skip through completed items
        let elapsedSinceEnd = Math.round((now - itemEndTime) / 1000);
        
        if (elapsedSinceEnd > 0) {
            // Current item elapsed, need to skip forward
            console.log('Playlist item(s) elapsed while app was closed, catching up...');
            
            // Save the completed item
            const completedItem = data.items[currentIndex];
            if (state.currentUser && completedItem) {
                apiCall('saveSession', {
                    userId: state.currentUser.user_id,
                    markerId: completedItem.marker_id !== 'custom' ? completedItem.marker_id : '',
                    startTime: new Date(itemEndTime.getTime() - completedItem.duration * 60 * 1000).toISOString(),
                    endTime: itemEndTime.toISOString(),
                    durationMinutes: completedItem.duration,
                    energyType: completedItem.transmission || '',
                    intensity: completedItem.intensity || 'medium',
                    notes: `Program (auto-completed)${completedItem.customNote ? ' - ' + completedItem.customNote : ''}`
                }).catch(e => console.error('Failed to save completed item:', e));
            }
            
            currentIndex++;
            
            // Skip through any items that fully elapsed
            while (currentIndex < data.items.length) {
                const nextItem = data.items[currentIndex];
                const nextDurationSec = nextItem.duration * 60;
                
                if (elapsedSinceEnd >= nextDurationSec) {
                    // This item also fully elapsed
                    console.log('Skipping fully elapsed item:', currentIndex);
                    
                    if (state.currentUser) {
                        apiCall('saveSession', {
                            userId: state.currentUser.user_id,
                            markerId: nextItem.marker_id !== 'custom' ? nextItem.marker_id : '',
                            startTime: new Date(now.getTime() - elapsedSinceEnd * 1000).toISOString(),
                            endTime: new Date(now.getTime() - (elapsedSinceEnd - nextDurationSec) * 1000).toISOString(),
                            durationMinutes: nextItem.duration,
                            energyType: nextItem.transmission || '',
                            intensity: nextItem.intensity || 'medium',
                            notes: `Program (auto-completed)${nextItem.customNote ? ' - ' + nextItem.customNote : ''}`
                        }).catch(e => console.error('Failed to save skipped item:', e));
                    }
                    
                    elapsedSinceEnd -= nextDurationSec;
                    currentIndex++;
                } else {
                    // This item is partially elapsed
                    break;
                }
            }
        }
        
        // Check if playlist completed while app was closed
        if (currentIndex >= data.items.length) {
            localStorage.removeItem('playlistState');
            showToast('Program completed while away!', 'success');
            playCompletionSound();
            vibrate([200, 100, 200, 100, 300]);
            return;
        }
        
        // Resume with current item (possibly with reduced time)
        const currentItem = data.items[currentIndex];
        let remainingSeconds = currentItem.duration * 60;
        
        if (elapsedSinceEnd > 0) {
            // This item was partially elapsed
            remainingSeconds = Math.max(1, currentItem.duration * 60 - elapsedSinceEnd);
        } else if (itemEndTime > now) {
            // Item hasn't ended yet
            remainingSeconds = Math.round((itemEndTime - now) / 1000);
        }
        
        // Set up the runner state
        state.playlistRunner.isRunning = true;
        state.playlistRunner.isPaused = false;
        state.playlistRunner.items = data.items;
        state.playlistRunner.currentIndex = currentIndex;
        state.playlistRunner.itemRemaining = remainingSeconds;
        state.playlistRunner.itemEndTime = new Date(now.getTime() + remainingSeconds * 1000);
        state.playlistRunner.playlist = { playlist_id: data.playlistId, name: data.playlistName || 'Program' };
        
        // Update UI with correct playlist runner elements
        updatePlaylistRunnerUI(data.items, currentIndex, remainingSeconds, false);
        updatePlaylistItemTimer();
        updateHeaderLogo();
        
        // Start the timer interval
        state.playlistRunner.itemTimer = setInterval(playlistTimerTick, 1000);
        
        const remainingMin = Math.ceil(remainingSeconds / 60);
        showToast(`Program restored: ${currentIndex + 1}/${data.items.length} (${remainingMin}m left)`, 'success');
        
        console.log(`Playlist restored: item ${currentIndex + 1}/${data.items.length}, ${remainingSeconds}s remaining`);
        
    } catch (error) {
        console.error('Error restoring playlist:', error);
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
            saveRunningAttunementState();
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
            
            // Handle attunement - catch up if needed
            if (attunementState.isRunning) {
                catchUpAttunement();
            }
        }
    });
    
    window.addEventListener('beforeunload', () => {
        saveTimerState();
        savePlaylistState();
        saveRunningAttunementState();
    });
}

// Catch up attunement when returning from background
function catchUpAttunement() {
    if (!attunementState.isRunning || !attunementState.endTime) return;
    
    const now = new Date();
    const remaining = Math.round((attunementState.endTime - now) / 1000);
    
    if (remaining <= 0) {
        // Attunement completed while in background
        completeAttunement();
    } else {
        // Update remaining time
        attunementState.remaining = remaining;
        updateAttunementTimer();
    }
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
    
    runner.itemTimer = setInterval(playlistTimerTick, 1000);
}

// Playlist timer tick - called every second
function playlistTimerTick() {
    const runner = state.playlistRunner;
    if (!runner.isRunning || runner.isPaused) return;
    
    const now = new Date();
    runner.itemRemaining = Math.max(0, Math.round((runner.itemEndTime - now) / 1000));
    
    updatePlaylistItemTimer();
    
    // Save state periodically (every 30 seconds) for safety
    if (runner.itemRemaining % 30 === 0) {
        savePlaylistState();
    }
    
    if (runner.itemRemaining <= 0) {
        clearInterval(runner.itemTimer);
        playCompletionSound();
        vibrate([100, 50, 100]);
        nextPlaylistItem();
    }
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
            case 'habits':
                updateHabitsView();
                break;
            case 'habitSettings':
                updateHabitSettingsView();
                break;
            case 'attunements':
                renderAttunementsList();
                break;
            case 'myAttunements':
                renderMyAttunements();
                break;
            case 'attunementSettings':
                renderAdminAttunements();
                break;
            case 'shadow':
                updateShadowUI();
                break;
            case 'integrate':
                updateIntegrateUI();
                break;
            case 'integrateHistory':
                renderIntegrateHistory('completed');
                break;
            case 'process':
                updateProcessUI();
                break;
            case 'processHistory':
                renderProcessHistory('completed');
                break;
            case 'deepClean':
                updateDeepCleanProgress();
                updateDeepCleanUI();
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
    
    // Update habit stats
    updateHabitStats();
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
    
    // Save state periodically (every 30 seconds) for safety
    if (state.timer.remaining % 30 === 0) {
        saveTimerState();
    }
    
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
            
            // Mark energy work habit as completed
            markEnergyWorkHabit();
            
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
// SHADOW FEATURE
// ============================================

// Polarities data for Integrate tool
const POLARITIES_DATA = [
    { id: 1, left: "ability (to do something)", right: "disability", description: "" },
    { id: 2, left: "abnormal", right: "normal", description: "" },
    { id: 3, left: "indifference", right: "sympathy", description: "" },
    { id: 4, left: "absolute", right: "relative", description: "" },
    { id: 5, left: "abstract", right: "concrete", description: "" },
    { id: 6, left: "acceptable", right: "unacceptable", description: "" },
    { id: 7, left: "acceptance", right: "rejection", description: "" },
    { id: 8, left: "acceptance of someone else's points of view", right: "unacceptance of someone else's points of view", description: "" },
    { id: 9, left: "accessibility", right: "inaccessibility", description: "" },
    { id: 10, left: "active", right: "passive", description: "" },
    { id: 11, left: "activity", right: "passivity", description: "" },
    { id: 12, left: "adequate", right: "inadequate", description: "" },
    { id: 13, left: "advancement", right: "retreat", description: "" },
    { id: 14, left: "all", right: "nothing", description: "" },
    { id: 15, left: "altruism", right: "egoism", description: "" },
    { id: 16, left: "always", right: "never", description: "" },
    { id: 17, left: "analysis", right: "synthesis", description: "" },
    { id: 18, left: "anxiety", right: "peace", description: "" },
    { id: 19, left: "anxiety", right: "tranquility", description: "" },
    { id: 20, left: "appearance", right: "disappearance", description: "" },
    { id: 21, left: "approaching to a goal", right: "moving away from a goal", description: "" },
    { id: 22, left: "arrival", right: "departure", description: "" },
    { id: 23, left: "attack", right: "counter-attack", description: "" },
    { id: 24, left: "attraction", right: "repulsion", description: "" },
    { id: 25, left: "attraction to people", right: "rejection of people", description: "" },
    { id: 26, left: "balance", right: "compulsion", description: "" },
    { id: 27, left: "beauty", right: "ugliness", description: "" },
    { id: 28, left: "beginning", right: "end", description: "" },
    { id: 29, left: "belief", right: "disbelief", description: "" },
    { id: 30, left: "benevolence", right: "hostility", description: "" },
    { id: 31, left: "better", right: "worse", description: "" },
    { id: 32, left: "big", right: "small", description: "" },
    { id: 33, left: "body", right: "mind", description: "" },
    { id: 34, left: "body", right: "spirit", description: "" },
    { id: 35, left: "boredom", right: "interest", description: "" },
    { id: 36, left: "change", right: "stagnation", description: "" },
    { id: 37, left: "chaos", right: "order", description: "" },
    { id: 38, left: "charisma", right: "dullness", description: "" },
    { id: 39, left: "cheerful", right: "tired", description: "" },
    { id: 40, left: "cheerfulness", right: "gloominess", description: "" },
    { id: 41, left: "clean", right: "dirty", description: "" },
    { id: 42, left: "communication", right: "silence", description: "" },
    { id: 43, left: "conclusion", right: "beginning", description: "" },
    { id: 44, left: "condensation", right: "dissolution", description: "" },
    { id: 45, left: "confidence", right: "doubt", description: "" },
    { id: 46, left: "confidence about the abundance of the universe", right: "fear that you will receive nothing", description: "" },
    { id: 47, left: "confirmation", right: "denial", description: "" },
    { id: 48, left: "consciousness", right: "body", description: "" },
    { id: 49, left: "consciousness", right: "instincts", description: "" },
    { id: 50, left: "consciousness", right: "materiality", description: "" },
    { id: 51, left: "consciousness", right: "unconsciousness", description: "" },
    { id: 52, left: "contempt", right: "respect", description: "" },
    { id: 53, left: "control", right: "freedom", description: "" },
    { id: 54, left: "correct", right: "incorrect", description: "" },
    { id: 55, left: "creation", right: "destruction", description: "" },
    { id: 56, left: "danger", right: "safety", description: "" },
    { id: 57, left: "darkness", right: "light", description: "" },
    { id: 58, left: "day", right: "night", description: "" },
    { id: 59, left: "decent", right: "indecent", description: "" },
    { id: 60, left: "dependence", right: "independence", description: "" },
    { id: 61, left: "depth", right: "surface", description: "" },
    { id: 62, left: "difference", right: "similarity", description: "" },
    { id: 63, left: "difference", right: "agreement", description: "" },
    { id: 64, left: "dissatisfaction", right: "satisfaction", description: "" },
    { id: 65, left: "distrust of people", right: "trust of people", description: "" },
    { id: 66, left: "divine", right: "ordinary", description: "" },
    { id: 67, left: "dominance", right: "submission", description: "" },
    { id: 68, left: "dork", right: "charmer", description: "" },
    { id: 69, left: "dream", right: "reality", description: "" },
    { id: 70, left: "dynamics", right: "statics", description: "" },
    { id: 71, left: "earthly", right: "divine", description: "" },
    { id: 72, left: "effort", right: "apathy", description: "" },
    { id: 73, left: "effort", right: "rest", description: "" },
    { id: 74, left: "emotions", right: "lack of emotions", description: "" },
    { id: 75, left: "emotions", right: "mind", description: "" },
    { id: 76, left: "emotions", right: "reason", description: "" },
    { id: 77, left: "emotions", right: "void", description: "" },
    { id: 78, left: "energetic", right: "inactive", description: "" },
    { id: 79, left: "enlightened master", right: "moron", description: "" },
    { id: 80, left: "enlightenment", right: "ignorance", description: "" },
    { id: 81, left: "entering experience", right: "avoiding experience", description: "" },
    { id: 82, left: "enthusiasm", right: "apathy", description: "" },
    { id: 83, left: "eternity", right: "moment", description: "" },
    { id: 84, left: "everybody", right: "nobody", description: "" },
    { id: 85, left: "everything depends on me", right: "nothing depends on me", description: "" },
    { id: 86, left: "existence", right: "creation", description: "" },
    { id: 87, left: "existence", right: "non-existence", description: "" },
    { id: 88, left: "expansion", right: "compression", description: "" },
    { id: 89, left: "extrovert", right: "introvert", description: "" },
    { id: 90, left: "faith", right: "knowledge", description: "" },
    { id: 91, left: "far", right: "near", description: "" },
    { id: 92, left: "fear", right: "courage", description: "" },
    { id: 93, left: "fear", right: "peace", description: "" },
    { id: 94, left: "fire", right: "water", description: "" },
    { id: 95, left: "folding", right: "unfolding", description: "" },
    { id: 96, left: "forever", right: "temporarily", description: "" },
    { id: 97, left: "form", right: "formlessness", description: "" },
    { id: 98, left: "formation", right: "disappearance", description: "" },
    { id: 99, left: "forward", right: "backward", description: "" },
    { id: 100, left: "fragrant", right: "malodorous", description: "" },
    { id: 101, left: "freedom", right: "depression", description: "" },
    { id: 102, left: "freedom", right: "fate/karma", description: "" },
    { id: 103, left: "freedom", right: "responsibility", description: "" },
    { id: 104, left: "freedom", right: "slavery", description: "" },
    { id: 105, left: "freedom", right: "submission", description: "" },
    { id: 106, left: "freedom", right: "lack of freedom", description: "" },
    { id: 107, left: "fresh", right: "sluggish", description: "" },
    { id: 108, left: "front", right: "back", description: "" },
    { id: 109, left: "full", right: "empty", description: "" },
    { id: 110, left: "fullness", right: "emptiness", description: "" },
    { id: 111, left: "fundamentality", right: "shakiness", description: "" },
    { id: 112, left: "future", right: "past", description: "" },
    { id: 113, left: "generous", right: "mean", description: "" },
    { id: 114, left: "genius", right: "madness", description: "" },
    { id: 115, left: "gently sloping", right: "steep", description: "" },
    { id: 116, left: "god", right: "devil", description: "" },
    { id: 117, left: "good", right: "bad", description: "" },
    { id: 118, left: "good", right: "evil", description: "" },
    { id: 119, left: "gratitude", right: "ingratitude", description: "" },
    { id: 120, left: "greatness", right: "smallness", description: "" },
    { id: 121, left: "happiness", right: "grief", description: "" },
    { id: 122, left: "happiness", right: "sadness", description: "" },
    { id: 123, left: "hardness", right: "fragility", description: "" },
    { id: 124, left: "heavy", right: "light", description: "" },
    { id: 125, left: "hell", right: "heaven", description: "" },
    { id: 126, left: "here", right: "now", description: "" },
    { id: 127, left: "here", right: "there", description: "" },
    { id: 128, left: "high", right: "low", description: "" },
    { id: 129, left: "honest man", right: "swindler", description: "" },
    { id: 130, left: "hopelessness", right: "hope", description: "" },
    { id: 131, left: "horizontal", right: "vertical", description: "" },
    { id: 132, left: "hot", right: "cold", description: "" },
    { id: 133, left: "hunger", right: "satiety", description: "" },
    { id: 134, left: "I am bad", right: "I am good", description: "" },
    { id: 135, left: "I am not good at anything", right: "I am good at everything", description: "" },
    { id: 136, left: "I am the source", right: "I am not the source", description: "" },
    { id: 137, left: "I am unique", right: "I am like everybody else", description: "" },
    { id: 138, left: "I exist", right: "I don't exist", description: "" },
    { id: 139, left: "I must", right: "I want", description: "" },
    { id: 140, left: "I must be right", right: "I am not right", description: "" },
    { id: 141, left: "I want to be aware", right: "I don't want to be aware", description: "" },
    { id: 142, left: "I want to communicate with people", right: "I don't want to communicate with people", description: "" },
    { id: 143, left: "I-don't-care-ness", right: "enthusiasm", description: "" },
    { id: 144, left: "ignorant people", right: "wise people", description: "" },
    { id: 145, left: "illusion", right: "reality", description: "" },
    { id: 146, left: "indifference", right: "involvement", description: "" },
    { id: 147, left: "infinitely small", right: "infinitely large", description: "" },
    { id: 148, left: "initiative", right: "inactive", description: "" },
    { id: 149, left: "inner world", right: "outer world", description: "" },
    { id: 150, left: "inside", right: "outside", description: "" },
    { id: 151, left: "intellect", right: "emotion", description: "" },
    { id: 152, left: "intellect", right: "instincts", description: "" },
    { id: 153, left: "interest", right: "boredom", description: "" },
    { id: 154, left: "interest", right: "indifference", description: "" },
    { id: 155, left: "intuition", right: "consciousness", description: "" },
    { id: 156, left: "irritation", right: "acceptance", description: "" },
    { id: 157, left: "joy", right: "sorrow", description: "" },
    { id: 158, left: "joyous", right: "angry", description: "" },
    { id: 159, left: "knowledge", right: "action", description: "" },
    { id: 160, left: "knowledge", right: "ignorance", description: "" },
    { id: 161, left: "lack of self-confidence", right: "self-confidence", description: "" },
    { id: 162, left: "laziness", right: "willingness to act", description: "" },
    { id: 163, left: "lechery", right: "chastity", description: "" },
    { id: 164, left: "left", right: "right", description: "" },
    { id: 165, left: "left hemisphere", right: "right hemisphere", description: "" },
    { id: 166, left: "life", right: "death", description: "" },
    { id: 167, left: "light", right: "darkness", description: "" },
    { id: 168, left: "lightness", right: "heaviness", description: "" },
    { id: 169, left: "limited consciousness", right: "unlimited consciousness", description: "" },
    { id: 170, left: "limitedness", right: "limitlessness", description: "" },
    { id: 171, left: "literacy", right: "illiteracy", description: "" },
    { id: 172, left: "localization", right: "non-localization", description: "" },
    { id: 173, left: "logic", right: "creativity", description: "" },
    { id: 174, left: "logic", right: "emotions", description: "" },
    { id: 175, left: "logical thinking", right: "creative thinking", description: "" },
    { id: 176, left: "long", right: "short", description: "" },
    { id: 177, left: "love", right: "aggressiveness", description: "" },
    { id: 178, left: "love", right: "fear", description: "" },
    { id: 179, left: "love", right: "freedom", description: "" },
    { id: 180, left: "love", right: "hatred", description: "" },
    { id: 181, left: "love", right: "loneliness", description: "" },
    { id: 182, left: "love", right: "pain", description: "" },
    { id: 183, left: "love", right: "power", description: "" },
    { id: 184, left: "love", right: "refusal", description: "" },
    { id: 185, left: "love of people", right: "hatred of people", description: "" },
    { id: 186, left: "luck", right: "misfortune", description: "" },
    { id: 187, left: "lucky", right: "unlucky", description: "" },
    { id: 188, left: "male", right: "female", description: "" },
    { id: 189, left: "man", right: "woman", description: "" },
    { id: 190, left: "material", right: "emptiness", description: "" },
    { id: 191, left: "material", right: "immaterial", description: "" },
    { id: 192, left: "material", right: "spiritual", description: "" },
    { id: 193, left: "material world", right: "spiritual world", description: "" },
    { id: 194, left: "material world", right: "subtle world", description: "" },
    { id: 195, left: "matter", right: "energy", description: "" },
    { id: 196, left: "matter", right: "void", description: "" },
    { id: 197, left: "me", right: "abundance of the universe", description: "" },
    { id: 198, left: "me", right: "Buddha", description: "" },
    { id: 199, left: "me", right: "complete enlightenment", description: "" },
    { id: 200, left: "me", right: "eternity", description: "" },
    { id: 201, left: "me", right: "everyone", description: "" },
    { id: 202, left: "me", right: "extraterrestrial intelligence", description: "" },
    { id: 203, left: "me", right: "galaxy", description: "" },
    { id: 204, left: "me", right: "intuition", description: "" },
    { id: 205, left: "me", right: "life", description: "" },
    { id: 206, left: "me", right: "movement", description: "" },
    { id: 207, left: "me", right: "nothing", description: "" },
    { id: 208, left: "me", right: "others", description: "" },
    { id: 209, left: "me", right: "people", description: "" },
    { id: 210, left: "me", right: "someone else", description: "" },
    { id: 211, left: "me", right: "subtle worlds", description: "" },
    { id: 212, left: "me", right: "the whole world", description: "" },
    { id: 213, left: "me", right: "unity", description: "" },
    { id: 214, left: "me", right: "universe", description: "" },
    { id: 215, left: "me", right: "void", description: "" },
    { id: 216, left: "me", right: "world", description: "" },
    { id: 217, left: "merciful", right: "merciless", description: "" },
    { id: 218, left: "minus", right: "plus", description: "" },
    { id: 219, left: "misfortune", right: "good fortune", description: "" },
    { id: 220, left: "monotony", right: "diversity", description: "" },
    { id: 221, left: "motion", right: "immobility", description: "" },
    { id: 222, left: "motion", right: "rest", description: "" },
    { id: 223, left: "motion", right: "stopping", description: "" },
    { id: 224, left: "moving", right: "staying", description: "" },
    { id: 225, left: "multitude", right: "uniqueness", description: "" },
    { id: 226, left: "must do", right: "don't want to do", description: "" },
    { id: 227, left: "must", right: "must not", description: "" },
    { id: 228, left: "my", right: "somebody else's", description: "" },
    { id: 229, left: "my father", right: "my mother", description: "" },
    { id: 230, left: "my wishes", right: "somebody else's wishes", description: "" },
    { id: 231, left: "mysticism", right: "narrow-mindedness", description: "" },
    { id: 232, left: "nature", right: "civilization", description: "" },
    { id: 233, left: "near", right: "remote", description: "" },
    { id: 234, left: "negative", right: "positive", description: "" },
    { id: 235, left: "negative emotions", right: "positive emotions", description: "" },
    { id: 236, left: "noble", right: "ignoble", description: "" },
    { id: 237, left: "nobleness", right: "baseness", description: "" },
    { id: 238, left: "noise/sounds", right: "silence", description: "" },
    { id: 239, left: "now", right: "later", description: "" },
    { id: 240, left: "observer", right: "observed", description: "" },
    { id: 241, left: "old", right: "young", description: "" },
    { id: 242, left: "optimism", right: "pessimism", description: "" },
    { id: 243, left: "others are right", right: "I am right", description: "" },
    { id: 244, left: "panic", right: "tranquillity", description: "" },
    { id: 245, left: "part", right: "whole", description: "" },
    { id: 246, left: "passion", right: "spirituality", description: "" },
    { id: 247, left: "past", right: "future", description: "" },
    { id: 248, left: "path", right: "goal", description: "" },
    { id: 249, left: "peace", right: "aggression", description: "" },
    { id: 250, left: "peace", right: "disorders", description: "" },
    { id: 251, left: "peace", right: "fear", description: "" },
    { id: 252, left: "peace", right: "power", description: "" },
    { id: 253, left: "people", right: "animals", description: "" },
    { id: 254, left: "perfection", right: "imperfection", description: "" },
    { id: 255, left: "permanence", right: "transience", description: "" },
    { id: 256, left: "permanent", right: "temporary", description: "" },
    { id: 257, left: "permission", right: "prohibition", description: "" },
    { id: 258, left: "point", right: "space", description: "" },
    { id: 259, left: "point", right: "three-dimensional object", description: "" },
    { id: 260, left: "poor", right: "wealthy", description: "" },
    { id: 261, left: "positive", right: "negative", description: "" },
    { id: 262, left: "positive element", right: "negative element", description: "" },
    { id: 263, left: "positive polarity", right: "negative polarity", description: "" },
    { id: 264, left: "possible", right: "impossible", description: "" },
    { id: 265, left: "poverty", right: "wealth", description: "" },
    { id: 266, left: "power", right: "helplessness", description: "" },
    { id: 267, left: "power", right: "impotence", description: "" },
    { id: 268, left: "power of the night", right: "power of the day", description: "" },
    { id: 269, left: "presence of thoughts", right: "absence of thoughts", description: "" },
    { id: 270, left: "present", right: "future", description: "" },
    { id: 271, left: "present", right: "past", description: "" },
    { id: 272, left: "present moment", right: "eternity", description: "" },
    { id: 273, left: "progress", right: "degradation", description: "" },
    { id: 274, left: "proof", right: "disproof", description: "" },
    { id: 275, left: "prudent", right: "imprudent", description: "" },
    { id: 276, left: "quickly", right: "slowly", description: "" },
    { id: 277, left: "reason", right: "consequence", description: "" },
    { id: 278, left: "reasonable", right: "hasty", description: "" },
    { id: 279, left: "relationship", right: "loneliness", description: "" },
    { id: 280, left: "relaxation", right: "stress", description: "" },
    { id: 281, left: "resoluteness to do something", right: "postponement", description: "" },
    { id: 282, left: "responsibility", right: "irresponsibility", description: "" },
    { id: 283, left: "right", right: "wrong", description: "" },
    { id: 284, left: "saint", right: "sinner", description: "" },
    { id: 285, left: "salted", right: "unsalted", description: "" },
    { id: 286, left: "sane", right: "insane", description: "" },
    { id: 287, left: "satisfaction", right: "displeasure", description: "" },
    { id: 288, left: "scream", right: "silence", description: "" },
    { id: 289, left: "security", right: "insecurity", description: "" },
    { id: 290, left: "sensible", right: "thoughtless", description: "" },
    { id: 291, left: "sentimentalism", right: "heartlessness", description: "" },
    { id: 292, left: "separateness", right: "integrity", description: "" },
    { id: 293, left: "seriousness", right: "light-mindedness", description: "" },
    { id: 294, left: "severity", right: "mildness", description: "" },
    { id: 295, left: "shame of failure", right: "delight of victory", description: "" },
    { id: 296, left: "shining", right: "dim", description: "" },
    { id: 297, left: "short life", right: "eternity", description: "" },
    { id: 298, left: "should save one's face", right: "shouldn't save one's face", description: "" },
    { id: 299, left: "silently", right: "loudly", description: "" },
    { id: 300, left: "silly", right: "enlightened", description: "" },
    { id: 301, left: "sky", right: "earth", description: "" },
    { id: 302, left: "small", right: "big", description: "" },
    { id: 303, left: "something", right: "nothing", description: "" },
    { id: 304, left: "something has to be done", right: "nothing has to be done", description: "" },
    { id: 305, left: "sorrow", right: "joy", description: "" },
    { id: 306, left: "stability", right: "changes", description: "" },
    { id: 307, left: "stability", right: "shock", description: "" },
    { id: 308, left: "standing", right: "lying", description: "" },
    { id: 309, left: "straight", right: "curved", description: "" },
    { id: 310, left: "strength", right: "weakness", description: "" },
    { id: 311, left: "structured", right: "unstructured", description: "" },
    { id: 312, left: "subject", right: "object", description: "" },
    { id: 313, left: "subtle humor", right: "vulgar humor", description: "" },
    { id: 314, left: "success", right: "defeat", description: "" },
    { id: 315, left: "success", right: "disappointment", description: "" },
    { id: 316, left: "successful", right: "unsuccessful", description: "" },
    { id: 317, left: "sun", right: "moon", description: "" },
    { id: 318, left: "sweet", right: "not sweet", description: "" },
    { id: 319, left: "symmetric", right: "asymmetric", description: "" },
    { id: 320, left: "sympathy", right: "antipathy", description: "" },
    { id: 321, left: "talent", right: "lack of talent", description: "" },
    { id: 322, left: "teacher", right: "pupil", description: "" },
    { id: 323, left: "teaching", right: "knowledge", description: "" },
    { id: 324, left: "the one who knows", right: "the thing which is known", description: "" },
    { id: 325, left: "the world is bad", right: "the world is good", description: "" },
    { id: 326, left: "the world is dangerous", right: "the world is safe", description: "" },
    { id: 327, left: "the world is unfair", right: "the world is fair", description: "" },
    { id: 328, left: "theory", right: "practice", description: "" },
    { id: 329, left: "this world", right: "other world", description: "" },
    { id: 330, left: "thrifty", right: "thriftless", description: "" },
    { id: 331, left: "to agree", right: "to disagree", description: "" },
    { id: 332, left: "to be", right: "not to be", description: "" },
    { id: 333, left: "to be always conscious of oneself", right: "to be never conscious of oneself", description: "" },
    { id: 334, left: "to be aware of the essence", right: "to see the surface", description: "" },
    { id: 335, left: "to be flexible", right: "to be fixated on", description: "" },
    { id: 336, left: "to be united with one's roots", right: "to be separated with them", description: "" },
    { id: 337, left: "to begin", right: "to stop", description: "" },
    { id: 338, left: "to believe everything will be OK", right: "to disbelieve everything will be OK", description: "" },
    { id: 339, left: "to bless", right: "to curse", description: "" },
    { id: 340, left: "to forget", right: "to remember", description: "" },
    { id: 341, left: "to give", right: "to get", description: "" },
    { id: 342, left: "to have a higher purpose", right: "to live without a purpose", description: "" },
    { id: 343, left: "to have a possibility to choose", right: "to have no choice", description: "" },
    { id: 344, left: "to have results", right: "to have no results", description: "" },
    { id: 345, left: "to have time", right: "to have no time", description: "" },
    { id: 346, left: "to know", right: "not to know", description: "" },
    { id: 347, left: "to know everything", right: "to know nothing", description: "" },
    { id: 348, left: "to know one's predestination", right: "to not know one's predestination", description: "" },
    { id: 349, left: "to give a gift", right: "to take a gift", description: "" },
    { id: 350, left: "to possess everything", right: "to possess nothing", description: "" },
    { id: 351, left: "to remember", right: "to forget", description: "" },
    { id: 352, left: "to see", right: "to understand", description: "" },
    { id: 353, left: "to stay", right: "to leave", description: "" },
    { id: 354, left: "to survive", right: "to die", description: "" },
    { id: 355, left: "to survive", right: "to give up", description: "" },
    { id: 356, left: "to take", right: "to give", description: "" },
    { id: 357, left: "to take responsibility", right: "to reject responsibility", description: "" },
    { id: 358, left: "to throw", right: "to pick up", description: "" },
    { id: 359, left: "to turn pale", right: "to turn red", description: "" },
    { id: 360, left: "to win", right: "to lose", description: "" },
    { id: 361, left: "to withstand", right: "to give up", description: "" },
    { id: 362, left: "tolerance", right: "intolerance", description: "" },
    { id: 363, left: "top", right: "bottom", description: "" },
    { id: 364, left: "topical", right: "non-topical", description: "" },
    { id: 365, left: "tragedy", right: "comedy", description: "" },
    { id: 366, left: "true memory", right: "illusive memory", description: "" },
    { id: 367, left: "truth", right: "hallucinations", description: "" },
    { id: 368, left: "truth", right: "lie", description: "" },
    { id: 369, left: "uncertainty", right: "certainty", description: "" },
    { id: 370, left: "uncertainty about the future", right: "certainty about the future", description: "" },
    { id: 371, left: "understanding", right: "misunderstanding", description: "" },
    { id: 372, left: "unity", right: "duality", description: "" },
    { id: 373, left: "unity", right: "separation", description: "" },
    { id: 374, left: "unity with others", right: "isolation", description: "" },
    { id: 375, left: "unpleasant", right: "pleasant", description: "" },
    { id: 376, left: "unwillingness to change", right: "willingness to change", description: "" },
    { id: 377, left: "unwillingness to live", right: "enjoyment of life", description: "" },
    { id: 378, left: "unwillingness to live", right: "lust for life", description: "" },
    { id: 379, left: "up", right: "down", description: "" },
    { id: 380, left: "usual people", right: "enlightened people", description: "" },
    { id: 381, left: "victory", right: "defeat", description: "" },
    { id: 382, left: "victory", right: "loss", description: "" },
    { id: 383, left: "virtual world", right: "real world", description: "" },
    { id: 384, left: "visibility", right: "invisibility", description: "" },
    { id: 385, left: "void", right: "the whole world", description: "" },
    { id: 386, left: "vulnerability", right: "invulnerability", description: "" },
    { id: 387, left: "war", right: "peace", description: "" },
    { id: 388, left: "wealth", right: "poverty", description: "" },
    { id: 389, left: "weekdays", right: "holiday", description: "" },
    { id: 390, left: "white", right: "black", description: "" },
    { id: 391, left: "wish to be approved", right: "wish to approve", description: "" },
    { id: 392, left: "wish to be lonely", right: "wish to be with everyone", description: "" },
    { id: 393, left: "wish to be loved", right: "wish to love", description: "" },
    { id: 394, left: "wish to be with people", right: "unwillingness to be with people", description: "" },
    { id: 395, left: "wish to control", right: "wish to release control", description: "" },
    { id: 396, left: "wish to control the others", right: "wish to be controlled by the others", description: "" },
    { id: 397, left: "wish to debate", right: "unwillingness to debate", description: "" },
    { id: 398, left: "wish to have love", right: "wish to give love", description: "" },
    { id: 399, left: "wish to live", right: "wish to die", description: "" },
    { id: 400, left: "wish to move", right: "fear to move", description: "" },
    { id: 401, left: "wish to move", right: "unwillingness to move", description: "" },
    { id: 402, left: "wish to win approval", right: "wish to express approval", description: "" },
    { id: 403, left: "wish to work", right: "unwillingness to work", description: "" },
    { id: 404, left: "wise man", right: "stupid jerk", description: "" }
];

// Emotional states data for Process tool
const EMOTIONS_DATA = [
    "abandoned", "abrupt", "abused", "accused", "aching", "achy", "adrift", "afflicted", "afraid", "aggravated",
    "aggressive", "agitated", "agonized", "agony", "agoraphobic", "alarmed", "alienated", "alone", "aloof", "ambivalent",
    "anguished", "animosity", "annoyed", "antagonistic", "anxious", "apathetic", "appalled", "apprehensive", "argumentative", "arrogant",
    "ashamed", "at fault", "attached", "attacked", "attacking", "authoritative", "avoiding", "awful", "awkward", "bad",
    "baffled", "banished", "barren", "bashful", "beaten down", "befuddled", "belittled", "belligerent", "bereft", "betrayed",
    "bewildered", "bitter", "blaming", "bleak", "blindsided", "blocked", "blue", "blushing", "boastful", "bored",
    "bossy", "broken-hearted", "brutal", "bugged", "bulldozed", "bullied", "bummed out", "burdened", "burned up", "captive",
    "careless", "cast off", "censured", "chaotic", "chastened", "cheap", "cheapened", "cheated", "cheerless", "clingy",
    "closed", "clumsy", "cold", "combative", "comparing", "complaining", "compromised", "compulsive", "conceited", "condemned",
    "condemning", "condescending", "confined", "conflicted", "confounded", "confused", "contemptible", "contentious", "contracted", "contradictory",
    "contrary", "controlled", "controlling", "covetous", "cowardly", "crabby", "cranky", "craving", "crazy", "crippled",
    "critical", "criticized", "cruel", "crushed", "crying", "cursed", "cut off", "cynical", "debased", "deceitful",
    "deceived", "defamed", "defeated", "defensive", "defiant", "deficient", "defiled", "deflated", "degenerate", "degraded",
    "dejected", "demanding", "demeaned", "demoralized", "dependent", "depraved", "depreciated", "depressed", "deprived", "derided",
    "desecrated", "deserted", "desolate", "despair", "despairing", "desperate", "despicable", "despondent", "destitute", "destroyed",
    "devalued", "devastated", "difficult", "diminished", "dirty", "disappointed", "discarded", "disconcerted", "disconnected", "disconsolate",
    "discontented", "discouraged", "discredited", "disdainful", "disgraced", "disgusted", "disheartened", "dishonest", "disillusioned", "dismal",
    "dismayed", "disorganized", "disoriented", "disparaged", "disparaging", "disrespectful", "disrupted", "dissatisfied", "distant", "distorted",
    "distracted", "distraught", "distressed", "distrustful", "disturbed", "dominated", "doomed", "doubtful", "down", "downcast",
    "downhearted", "drained", "drawn", "dread", "dreadful", "dreary", "dull", "embarrassed", "embroiled", "empty",
    "enraged", "envious", "estranged", "exasperated", "excluded", "exhausted", "exploited", "exposed", "failure", "faithless",
    "fake", "fatigued", "faultfinding", "fearful", "feeble", "fidgety", "filthy", "finished", "flighty", "flustered",
    "foggy", "forgetful", "forgotten", "forlorn", "forsaken", "fragile", "fragmented", "frantic", "frenzied", "fretful",
    "friendless", "frightened", "frigid", "frowning", "frustrated", "fuming", "furious", "glaring", "gloomy", "glum",
    "grieved", "grim", "groaning", "grouchy", "grumpy", "guarded", "guilty", "gullible", "haggard", "harassed",
    "hard", "hardened", "harsh", "hasty", "hateful", "hatred", "haughty", "haunted", "heartbroken", "heartless",
    "helpless", "hesitant", "hindered", "hitting", "hopeless", "horrible", "horrified", "hostile", "hot-headed", "humiliated",
    "hungry", "hurried", "hurt", "hurtful", "hypocritical", "hysterical", "ignorant", "immature", "immobile", "immobilized",
    "impaired", "impatient", "impotent", "impoverished", "imprisoned", "impulsive", "in a bind", "in hell", "inadequate", "incapable",
    "incapacitated", "incensed", "incompetent", "inconsiderate", "inconsistent", "indecisive", "indignant", "ineffective", "inefficient", "inept",
    "inferior", "inflexible", "infuriated", "inhibited", "injured", "insecure", "insensitive", "insignificant", "insincere", "insulted",
    "insulting", "intimidated", "intolerant", "invaded", "irate", "irresponsible", "irritable", "irritated", "isolated", "jealous",
    "jittery", "joyless", "judgmental", "jumpy", "lacking", "left out", "let down", "lifeless", "limited", "listless",
    "livid", "lonely", "lonesome", "longing", "lost", "loud", "lousy", "low", "mad", "malicious",
    "maligned", "manipulated", "manipulative", "masochistic", "materialistic", "mean", "mean-spirited", "melancholy", "menaced", "mentally deficient",
    "miffed", "minimized", "miserable", "miserly", "misgiving", "mistreated", "misunderstood", "misused", "mixed up", "moaning",
    "mocked", "moody", "morose", "mortified", "mournful", "muddled", "naive", "narrow", "nauseated", "negative",
    "neglected", "neglectful", "nervous", "no energy", "obnoxious", "obsessed", "obsessive", "obstinate", "obstructed", "off",
    "off-kilter", "offended", "offensive", "on edge", "opposed", "oppositional", "oppressed", "out of sorts", "outcast", "outraged",
    "overbearing", "overlooked", "oversensitive", "overwhelmed", "overworked", "overwrought", "pained", "panicked", "panicky", "paralyzed",
    "paranoid", "pathetic", "peculiar", "perfectionistic", "perplexed", "persecuted", "perturbed", "pessimistic", "petrified", "phobic",
    "phony", "pitiful", "poisonous", "powerless", "prejudiced", "preoccupied", "pressured", "provoked", "punished", "punishing",
    "puny", "pushed", "pushy", "put down", "puzzled", "quarrelsome", "ranting", "rattled", "reactive", "rebellious",
    "recoiling", "regretful", "rejected", "remorseful", "remote", "reprimanding", "reproved", "repulsed", "repulsive", "resentful",
    "reserved", "resistant", "responsible", "restless", "restrained", "restricted", "retaliating", "revengeful", "ridiculed", "rigid",
    "risky", "robotic", "rotten", "rude", "ruined", "rushed", "ruthless", "sad", "sadistic", "sarcastic",
    "scared", "scattered", "scoffed at", "scolding", "scorned", "scornful", "screaming", "secretive", "seething", "self-absorbed",
    "self-castigating", "self-conscious", "self-critical", "self-denigrating", "self-deprecating", "self-hating", "serious", "shaky", "shallow", "shameful",
    "sharp", "shocked", "short-tempered", "shot down", "shrill", "shunned", "shut down", "shy", "sick", "sinful",
    "slammed", "slandered", "slighted", "slouching", "slow", "sluggish", "slumped", "small", "smothered", "smug",
    "sorrowful", "sour", "spiteful", "squirming", "stagnant", "stern", "stiff", "stifled", "stilted", "stingy",
    "stonewalling", "stony", "stressed", "stubborn", "stuck", "stumped", "stupid", "suffering", "suicidal", "sulky",
    "sullen", "superficial", "superior", "suspicious", "swearing", "tactless", "taut", "tearful", "temperamental", "tense",
    "terrible", "terrified", "territorial", "thoughtless", "threatened", "thwarted", "ticked off", "tight", "timid", "tired",
    "tormented", "tortured", "touchy", "trapped", "trembling", "troubled", "turned off", "twitching", "unable", "unappreciated",
    "unbending", "uncaring", "uncertain", "uncomfortable", "undecided", "undesirable", "undisciplined", "uneasy", "unfair", "unforgivable",
    "unforgiving", "unfriendly", "unhappy", "unimportant", "uninterested", "unmindful", "unorganized", "unpleasant", "unprotected", "unreasonable",
    "unresponsive", "unsettled", "unsure", "unthankful", "unwanted", "unwelcoming", "unwise", "unworthy", "upset", "uptight",
    "used", "useless", "vengeful", "venomous", "vexed", "vicious", "victimized", "vindictive", "violated", "violent",
    "vulnerable", "wanton", "wary", "washed up", "wasted", "weak", "weary", "weepy", "withdrawn", "woozy",
    "worried", "worthless", "wounded", "wrong", "wronged", "yearning", "yelling",
    "able", "absolved", "absorbed", "abundant", "acceptable", "accepted", "accepting", "accommodating", "accomplished", "accountable",
    "achieving", "active", "adaptable", "adequate", "admirable", "admired", "adored", "adversarial", "affluent", "agreeable",
    "alert", "altruistic", "ambitious", "amused", "analytical", "appreciated", "appreciative", "approved", "approving", "assertive",
    "assured", "at ease", "attractive", "attached", "attentive", "authentic", "awake", "aware", "awesome", "balanced",
    "beautiful", "believing", "blessed", "blissful", "bonded", "brave", "bright", "brilliant", "calm", "capable",
    "captivated", "cared for", "carefree", "careful", "caring", "cautious", "centered", "certain", "cheerful", "cherished",
    "clean", "clear", "collected", "comfortable", "comforted", "committed", "compassionate", "complete", "composed", "comprehending",
    "confident", "congruent", "connected", "conscious", "constant", "content", "cooperative", "courageous", "creative", "credible",
    "curious", "daring", "decisive", "defended", "delighted", "dependable", "desirable", "dignified", "discerning", "disciplined",
    "distinguished", "dutiful", "dynamic", "eager", "easy going", "eccentric", "ecstatic", "edified", "efficient", "elated",
    "elegant", "elevated", "emancipated", "empathic", "empowered", "encouraged", "energetic", "energized", "enthusiastic", "euphoric",
    "exceptional", "excited", "exhilarated", "experienced", "expressive", "extroverted", "exuberant", "fair", "faithful", "fantastic",
    "favored", "firm", "flexible", "flowing", "focused", "forceful", "forgiven", "fortified", "fortunate", "free",
    "friendly", "fulfilled", "gentle", "genuine", "gifted", "glad", "glowing", "good", "graceful", "gracious",
    "grateful", "gratified", "grounded", "growing", "guarded", "happy", "harmonious", "healed", "helpful", "heroic",
    "hesitant", "high", "honest", "honourable", "honoured", "hopeful", "humble", "humorous", "idealistic", "important",
    "in control", "in service", "included", "independent", "individualistic", "infatuated", "influential", "innocent", "inspired", "intelligent",
    "interested", "introspective", "invigorated", "invincible", "invited", "invulnerable", "jovial", "joyful", "jubilant", "judicious",
    "kind", "learning", "liberated", "light", "light-hearted", "likable", "lively", "loose", "loved", "loving",
    "loyal", "lucky", "magnetic", "marvellous", "masterful", "mature", "mediating", "meek", "merciful", "methodical",
    "mindful", "modest", "motivated", "neat", "noble", "observant", "open", "open hearted", "organized", "pacified",
    "pampered", "pardoned", "passionate", "patient", "peaceful", "perfect", "persevering", "pleasant", "pleased", "popular",
    "positive", "powerful", "practical", "praised", "precious", "prepared", "present", "productive", "proficient", "progressive",
    "prosperous", "protected", "proud", "prudent", "punctual", "purified", "purposeful", "qualified", "quick", "quiet",
    "radiant", "rational", "reasonable", "reassured", "receptive", "recognized", "redeemed", "regenerated", "rejoicing", "relaxed",
    "reliable", "relieved", "remembered", "replenished", "resolute", "respected", "respectful", "responsible", "responsive", "restored",
    "revitalized", "rewarded", "rooted", "satisfied", "secure", "self accepting", "self reliant", "selfless", "sensational", "sensible",
    "sensitive", "serene", "serenity", "settled", "sharing", "simple", "skillful", "smooth", "soothed", "spirited",
    "splendid", "stable", "steadfast", "strengthened", "stimulated", "strong", "successful", "supported", "sustained", "tactful",
    "teachable", "temperate", "tenacious", "tender", "thankful", "thoughtful", "thrilled", "tolerant", "tranquil", "triumphant",
    "trusting", "unconcerned", "understanding", "understood", "undisturbed", "unhurried", "unique", "united", "unselfish", "upheld",
    "valiant", "valuable", "valued", "virile", "visionary", "vital", "warm", "wealthy", "well-meaning", "willing",
    "wise", "wonderful", "worthwhile", "worthy", "yielding", "zealous"
].map((name, index) => ({ id: index + 1, name: name, description: "" }));

// Shadow state
let shadowState = {
    integrate: {
        completed: [],    // Array of polarity IDs
        skipped: [],      // Array of polarity IDs  
        currentIndex: 0   // Next polarity to show
    },
    process: {
        completed: [],    // Array of emotion IDs
        skipped: [],      // Array of emotion IDs
        currentIndex: 0   // Next emotion to show
    },
    deepClean: {
        status: 'not_started',  // 'not_started', 'in_progress', 'paused', 'completed'
        startDate: null,
        currentDay: 0,
        isPaused: false,
        completedDate: null
    }
};

// Initialize shadow feature
function initShadow() {
    loadShadowState();
    updateShadowUI();
}

// Load shadow state from localStorage
function loadShadowState() {
    const saved = localStorage.getItem('shadowState');
    if (saved) {
        try {
            shadowState = { ...shadowState, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Error loading shadow state:', e);
        }
    }
    
    // Check and update Deep Clean progress
    updateDeepCleanProgress();
}

// Save shadow state
function saveShadowState() {
    localStorage.setItem('shadowState', JSON.stringify(shadowState));
}

// Update all Shadow UI elements
function updateShadowUI() {
    updateIntegrateUI();
    updateProcessUI();
    updateDeepCleanUI();
    updateShadowToolCards();
}

// Update Shadow tool cards on main shadow view
function updateShadowToolCards() {
    // Integrate progress
    const integrateTotal = POLARITIES_DATA.length;
    const integrateCompleted = shadowState.integrate.completed.length;
    const integratePercent = Math.round((integrateCompleted / integrateTotal) * 100);
    
    const integrateBar = document.getElementById('integrateProgressBar');
    const integrateText = document.getElementById('integrateProgressText');
    if (integrateBar) integrateBar.style.width = `${integratePercent}%`;
    if (integrateText) integrateText.textContent = `${integratePercent}% complete`;
    
    // Process progress
    const processTotal = EMOTIONS_DATA.length;
    const processCompleted = shadowState.process.completed.length;
    const processPercent = Math.round((processCompleted / processTotal) * 100);
    
    const processBar = document.getElementById('processProgressBar');
    const processText = document.getElementById('processProgressText');
    if (processBar) processBar.style.width = `${processPercent}%`;
    if (processText) processText.textContent = `${processPercent}% complete`;
    
    // Deep Clean status
    const deepCleanStatus = document.getElementById('deepCleanStatus');
    if (deepCleanStatus) {
        switch (shadowState.deepClean.status) {
            case 'not_started':
                deepCleanStatus.textContent = 'Not started';
                break;
            case 'in_progress':
                deepCleanStatus.textContent = `Day ${shadowState.deepClean.currentDay}/30`;
                break;
            case 'paused':
                deepCleanStatus.textContent = `Paused - Day ${shadowState.deepClean.currentDay}/30`;
                break;
            case 'completed':
                deepCleanStatus.textContent = 'Completed ✓';
                deepCleanStatus.style.color = '#10B981';
                break;
        }
    }
}

// ============================================
// INTEGRATE TOOL
// ============================================

function updateIntegrateUI() {
    const total = POLARITIES_DATA.length;
    const completed = shadowState.integrate.completed.length;
    const percent = Math.round((completed / total) * 100);
    
    document.getElementById('integrateCompletedCount').textContent = completed;
    document.getElementById('integrateTotalCount').textContent = total;
    document.getElementById('integratePercentage').textContent = `${percent}%`;
}

function startNextIntegration() {
    // Find next polarity that hasn't been completed or skipped
    const handled = [...shadowState.integrate.completed, ...shadowState.integrate.skipped];
    const next = POLARITIES_DATA.find(p => !handled.includes(p.id));
    
    if (!next) {
        showToast('All polarities have been processed!', 'success');
        return;
    }
    
    // Show the card
    showIntegrateCard(next);
}

function showIntegrateCard(polarity) {
    shadowState.integrate.currentPolarity = polarity;
    
    const handled = [...shadowState.integrate.completed, ...shadowState.integrate.skipped];
    const currentNum = handled.length + 1;
    const total = POLARITIES_DATA.length;
    
    document.getElementById('integrateCardNumber').textContent = `${currentNum} of ${total}`;
    document.getElementById('polarityLeft').textContent = polarity.left;
    document.getElementById('polarityRight').textContent = polarity.right;
    document.getElementById('polarityDescription').textContent = polarity.description || '';
    
    showView('integrateCard');
}

function completeIntegration() {
    const polarity = shadowState.integrate.currentPolarity;
    if (!polarity) return;
    
    shadowState.integrate.completed.push(polarity.id);
    saveShadowState();
    
    showToast('Polarity integrated ☯', 'success');
    
    // Check if more to do
    const handled = [...shadowState.integrate.completed, ...shadowState.integrate.skipped];
    const hasMore = POLARITIES_DATA.some(p => !handled.includes(p.id));
    
    if (hasMore) {
        // Show next one
        startNextIntegration();
    } else {
        showToast('All polarities integrated!', 'success');
        closeIntegrateCard();
    }
    
    updateIntegrateUI();
    updateShadowToolCards();
}

function skipIntegration() {
    const polarity = shadowState.integrate.currentPolarity;
    if (!polarity) return;
    
    shadowState.integrate.skipped.push(polarity.id);
    saveShadowState();
    
    // Check if more to do
    const handled = [...shadowState.integrate.completed, ...shadowState.integrate.skipped];
    const hasMore = POLARITIES_DATA.some(p => !handled.includes(p.id));
    
    if (hasMore) {
        startNextIntegration();
    } else {
        showToast('All polarities have been processed', 'info');
        closeIntegrateCard();
    }
    
    updateIntegrateUI();
    updateShadowToolCards();
}

function closeIntegrateCard() {
    showView('integrate');
}

function showIntegrateTab(tab) {
    // Update tab buttons
    document.querySelectorAll('#viewIntegrateHistory .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === tab);
    });
    
    renderIntegrateHistory(tab);
}

function renderIntegrateHistory(tab = 'completed') {
    const container = document.getElementById('integrateHistoryList');
    if (!container) return;
    
    const ids = tab === 'completed' ? shadowState.integrate.completed : shadowState.integrate.skipped;
    
    if (ids.length === 0) {
        container.innerHTML = `<p class="empty-state">No ${tab} polarities yet</p>`;
        return;
    }
    
    container.innerHTML = ids.map(id => {
        const polarity = POLARITIES_DATA.find(p => p.id === id);
        if (!polarity) return '';
        return `
            <div class="shadow-history-item ${tab}">
                <span class="shadow-history-text">${polarity.left} — ${polarity.right}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// PROCESS TOOL
// ============================================

function updateProcessUI() {
    const total = EMOTIONS_DATA.length;
    const completed = shadowState.process.completed.length;
    const percent = Math.round((completed / total) * 100);
    
    document.getElementById('processCompletedCount').textContent = completed;
    document.getElementById('processTotalCount').textContent = total;
    document.getElementById('processPercentage').textContent = `${percent}%`;
}

function startNextProcess() {
    const handled = [...shadowState.process.completed, ...shadowState.process.skipped];
    const next = EMOTIONS_DATA.find(e => !handled.includes(e.id));
    
    if (!next) {
        showToast('All emotional states have been processed!', 'success');
        return;
    }
    
    showProcessCard(next);
}

function showProcessCard(emotion) {
    shadowState.process.currentEmotion = emotion;
    
    const handled = [...shadowState.process.completed, ...shadowState.process.skipped];
    const currentNum = handled.length + 1;
    const total = EMOTIONS_DATA.length;
    
    document.getElementById('processCardNumber').textContent = `${currentNum} of ${total}`;
    document.getElementById('emotionName').textContent = emotion.name;
    document.getElementById('emotionDescription').textContent = emotion.description || '';
    
    showView('processCard');
}

function completeProcess() {
    const emotion = shadowState.process.currentEmotion;
    if (!emotion) return;
    
    shadowState.process.completed.push(emotion.id);
    saveShadowState();
    
    showToast('Emotional state processed ◉', 'success');
    
    const handled = [...shadowState.process.completed, ...shadowState.process.skipped];
    const hasMore = EMOTIONS_DATA.some(e => !handled.includes(e.id));
    
    if (hasMore) {
        startNextProcess();
    } else {
        showToast('All emotional states processed!', 'success');
        closeProcessCard();
    }
    
    updateProcessUI();
    updateShadowToolCards();
}

function skipProcess() {
    const emotion = shadowState.process.currentEmotion;
    if (!emotion) return;
    
    shadowState.process.skipped.push(emotion.id);
    saveShadowState();
    
    const handled = [...shadowState.process.completed, ...shadowState.process.skipped];
    const hasMore = EMOTIONS_DATA.some(e => !handled.includes(e.id));
    
    if (hasMore) {
        startNextProcess();
    } else {
        showToast('All emotional states have been processed', 'info');
        closeProcessCard();
    }
    
    updateProcessUI();
    updateShadowToolCards();
}

function closeProcessCard() {
    showView('process');
}

function showProcessTab(tab) {
    document.querySelectorAll('#viewProcessHistory .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === tab);
    });
    
    renderProcessHistory(tab);
}

function renderProcessHistory(tab = 'completed') {
    const container = document.getElementById('processHistoryList');
    if (!container) return;
    
    const ids = tab === 'completed' ? shadowState.process.completed : shadowState.process.skipped;
    
    if (ids.length === 0) {
        container.innerHTML = `<p class="empty-state">No ${tab} emotional states yet</p>`;
        return;
    }
    
    container.innerHTML = ids.map(id => {
        const emotion = EMOTIONS_DATA.find(e => e.id === id);
        if (!emotion) return '';
        return `
            <div class="shadow-history-item ${tab}">
                <span class="shadow-history-text">${emotion.name}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// DEEP CLEAN TOOL
// ============================================

function updateDeepCleanProgress() {
    if (shadowState.deepClean.status !== 'in_progress') return;
    if (shadowState.deepClean.isPaused) return;
    
    const startDate = new Date(shadowState.deepClean.startDate);
    const now = new Date();
    const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    
    shadowState.deepClean.currentDay = Math.min(daysDiff + 1, 30);
    
    if (shadowState.deepClean.currentDay >= 30) {
        shadowState.deepClean.status = 'completed';
        shadowState.deepClean.completedDate = now.toISOString();
    }
    
    saveShadowState();
}

function updateDeepCleanUI() {
    const notStarted = document.getElementById('deepCleanNotStarted');
    const inProgress = document.getElementById('deepCleanInProgress');
    const completed = document.getElementById('deepCleanCompleted');
    
    if (!notStarted || !inProgress || !completed) return;
    
    // Hide all states
    notStarted.classList.add('hidden');
    inProgress.classList.add('hidden');
    completed.classList.add('hidden');
    
    switch (shadowState.deepClean.status) {
        case 'not_started':
            notStarted.classList.remove('hidden');
            break;
            
        case 'in_progress':
        case 'paused':
            inProgress.classList.remove('hidden');
            document.getElementById('deepCleanCurrentDay').textContent = shadowState.deepClean.currentDay;
            document.getElementById('deepCleanProgressFill').style.width = `${(shadowState.deepClean.currentDay / 30) * 100}%`;
            
            const pauseBtn = document.getElementById('deepCleanPauseBtn');
            if (shadowState.deepClean.isPaused) {
                pauseBtn.textContent = 'Resume';
                document.getElementById('deepCleanStatusText').textContent = 'Paused';
            } else {
                pauseBtn.textContent = 'Pause';
                document.getElementById('deepCleanStatusText').textContent = 'Working while you sleep...';
            }
            break;
            
        case 'completed':
            completed.classList.remove('hidden');
            if (shadowState.deepClean.completedDate) {
                const date = new Date(shadowState.deepClean.completedDate).toLocaleDateString();
                document.getElementById('deepCleanCompletedDate').textContent = `Completed on: ${date}`;
            }
            break;
    }
}

function startDeepClean() {
    if (shadowState.deepClean.status === 'completed') {
        showToast('Deep Clean has already been completed', 'info');
        return;
    }
    
    shadowState.deepClean.status = 'in_progress';
    shadowState.deepClean.startDate = new Date().toISOString();
    shadowState.deepClean.currentDay = 1;
    shadowState.deepClean.isPaused = false;
    
    saveShadowState();
    updateDeepCleanUI();
    updateShadowToolCards();
    
    showToast('Deep Clean started! This will work while you sleep.', 'success');
}

function toggleDeepCleanPause() {
    shadowState.deepClean.isPaused = !shadowState.deepClean.isPaused;
    
    if (!shadowState.deepClean.isPaused) {
        // Resuming - adjust start date to account for paused time
        // For simplicity, we'll just continue from where we left off
    }
    
    saveShadowState();
    updateDeepCleanUI();
    
    showToast(shadowState.deepClean.isPaused ? 'Deep Clean paused' : 'Deep Clean resumed', 'info');
}

function stopDeepClean() {
    if (confirm('Are you sure you want to stop the Deep Clean? You will need to start over.')) {
        shadowState.deepClean.status = 'not_started';
        shadowState.deepClean.startDate = null;
        shadowState.deepClean.currentDay = 0;
        shadowState.deepClean.isPaused = false;
        
        saveShadowState();
        updateDeepCleanUI();
        updateShadowToolCards();
        
        showToast('Deep Clean stopped', 'info');
    }
}

// ============================================
// ATTUNEMENTS FEATURE
// ============================================

// Attunements state
let attunementState = {
    attunements: [],           // All available attunements
    userAttunements: {},       // { odeljuserI: [{ attunementId, attunedAt, level }] }
    currentAttunement: null,   // Currently viewing/running
    currentPage: 0,            // For multi-page description
    pages: [],                 // Description pages
    isRunning: false,
    timer: null,
    endTime: null,
    startTime: null,
    duration: 0,
    remaining: 0
};

// Initialize attunements
async function initAttunements() {
    // Load from localStorage first (for instant UI)
    loadAttunementStateFromCache();
    updateAttunementHomeCard();
    
    // Restore running attunement if any
    restoreAttunementState();
    
    // Then sync from backend (non-blocking)
    loadAttunmentsFromBackend().catch(e => console.warn('Attunements backend load error:', e));
}

// Load attunement state from localStorage cache
function loadAttunementStateFromCache() {
    const saved = localStorage.getItem('attunementState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            attunementState.attunements = parsed.attunements || [];
            attunementState.userAttunements = parsed.userAttunements || {};
        } catch (e) {
            console.error('Error loading attunement state:', e);
        }
    }
    
    // Initialize user's attunements array if needed
    if (state.currentUser) {
        const userId = state.currentUser.user_id;
        if (!attunementState.userAttunements[userId]) {
            attunementState.userAttunements[userId] = [];
        }
    }
}

// Load attunements from backend
async function loadAttunmentsFromBackend() {
    try {
        // Load all available attunements
        const attResult = await apiCall('getAttunements');
        if (attResult?.attunements) {
            attunementState.attunements = attResult.attunements;
        }
        
        // Load user's received attunements
        if (state.currentUser) {
            const userId = state.currentUser.user_id;
            const userResult = await apiCall('getUserAttunements', { userId: userId });
            if (userResult?.userAttunements) {
                attunementState.userAttunements[userId] = userResult.userAttunements;
            }
        }
        
        // Update cache
        saveAttunementStateToCache();
        updateAttunementHomeCard();
        
        console.log('Attunements loaded from backend:', attunementState.attunements.length);
    } catch (e) {
        console.error('Error loading attunements from backend:', e);
    }
}

// Save attunement state to localStorage cache
function saveAttunementStateToCache() {
    localStorage.setItem('attunementState', JSON.stringify({
        attunements: attunementState.attunements,
        userAttunements: attunementState.userAttunements
    }));
}

// Save running attunement state (for background persistence)
function saveRunningAttunementState() {
    if (attunementState.isRunning && attunementState.currentAttunement) {
        localStorage.setItem('runningAttunement', JSON.stringify({
            attunementId: attunementState.currentAttunement.id,
            startTime: attunementState.startTime,
            endTime: attunementState.endTime?.toISOString(),
            duration: attunementState.duration
        }));
    } else {
        localStorage.removeItem('runningAttunement');
    }
}

// Restore running attunement state
function restoreAttunementState() {
    const saved = localStorage.getItem('runningAttunement');
    if (!saved) return;
    
    try {
        const data = JSON.parse(saved);
        const endTime = new Date(data.endTime);
        const now = new Date();
        
        // Check if attunement already completed while away
        if (now >= endTime) {
            // Complete the attunement
            const att = attunementState.attunements.find(a => a.id === data.attunementId);
            if (att) {
                attunementState.currentAttunement = att;
                recordAttunementCompletion();
                showToast('Attunement completed while away!', 'success');
            }
            localStorage.removeItem('runningAttunement');
            return;
        }
        
        // Resume the running attunement
        const att = attunementState.attunements.find(a => a.id === data.attunementId);
        if (att) {
            attunementState.currentAttunement = att;
            attunementState.duration = data.duration;
            attunementState.startTime = data.startTime;
            attunementState.endTime = endTime;
            attunementState.remaining = Math.round((endTime - now) / 1000);
            attunementState.isRunning = true;
            
            // Setup process view
            document.getElementById('attunementProcessName').textContent = att.name;
            const seriesEl = document.getElementById('attunementProcessSeries');
            if (att.seriesName) {
                seriesEl.textContent = `${att.seriesName} Level ${att.level || 1}`;
                seriesEl.style.display = 'block';
            } else {
                seriesEl.style.display = 'none';
            }
            
            updateAttunementTimer();
            
            // Start timer interval
            attunementState.timer = setInterval(attunementTick, 1000);
            
            showView('attunementProcess');
            showToast(`Attunement resumed: ${Math.ceil(attunementState.remaining / 60)}m left`, 'info');
        }
    } catch (e) {
        console.error('Error restoring attunement state:', e);
        localStorage.removeItem('runningAttunement');
    }
}

// Record attunement completion to backend and local state
async function recordAttunementCompletion() {
    const att = attunementState.currentAttunement;
    const userId = state.currentUser?.user_id;
    
    if (userId && att) {
        // Record locally
        if (!attunementState.userAttunements[userId]) {
            attunementState.userAttunements[userId] = [];
        }
        
        const record = {
            attunementId: att.id,
            attunedAt: new Date().toISOString(),
            level: att.level || 1
        };
        
        attunementState.userAttunements[userId].push(record);
        saveAttunementStateToCache();
        
        // Sync to backend (non-blocking)
        apiCall('saveUserAttunement', {
            userId: userId,
            attunementId: att.id,
            attunedAt: record.attunedAt,
            level: record.level
        }).catch(e => console.warn('Error syncing user attunement:', e));
    }
    
    localStorage.removeItem('runningAttunement');
}

// Update home card
function updateAttunementHomeCard() {
    const userId = state.currentUser?.user_id;
    const userAtts = userId ? (attunementState.userAttunements[userId] || []) : [];
    const visibleAtts = attunementState.attunements.filter(a => a.visible !== false);
    
    const receivedEl = document.getElementById('attunementReceivedCount');
    const availableEl = document.getElementById('attunementAvailableCount');
    
    if (receivedEl) receivedEl.textContent = `${userAtts.length} received`;
    if (availableEl) availableEl.textContent = `${visibleAtts.length} available`;
}

// Render attunements list (browse view)
function renderAttunementsList() {
    const container = document.getElementById('attunementsList');
    if (!container) return;
    
    const userId = state.currentUser?.user_id;
    const userAtts = userId ? (attunementState.userAttunements[userId] || []) : [];
    const visibleAtts = attunementState.attunements.filter(a => a.visible !== false);
    
    if (visibleAtts.length === 0) {
        container.innerHTML = `
            <div class="attunements-empty">
                <p>No attunements available yet</p>
            </div>
        `;
        return;
    }
    
    // Group by series
    const standalone = visibleAtts.filter(a => !a.seriesId);
    const series = {};
    
    visibleAtts.filter(a => a.seriesId).forEach(a => {
        if (!series[a.seriesId]) {
            series[a.seriesId] = {
                name: a.seriesName,
                attunements: []
            };
        }
        series[a.seriesId].attunements.push(a);
    });
    
    // Sort series attunements by level
    Object.values(series).forEach(s => {
        s.attunements.sort((a, b) => (a.level || 1) - (b.level || 1));
    });
    
    let html = '';
    
    // Render standalone attunements
    standalone.forEach(att => {
        const received = userAtts.find(ua => ua.attunementId === att.id);
        html += renderAttunementCard(att, received);
    });
    
    // Render series
    Object.entries(series).forEach(([seriesId, seriesData]) => {
        html += `<h3 class="attunement-series-heading">${seriesData.name}</h3>`;
        
        seriesData.attunements.forEach((att, index) => {
            const received = userAtts.find(ua => ua.attunementId === att.id);
            const prevLevel = index > 0 ? seriesData.attunements[index - 1] : null;
            const prevReceived = prevLevel ? userAtts.find(ua => ua.attunementId === prevLevel.id) : null;
            
            // Check if locked (previous level not received or 30-day cooldown)
            let locked = false;
            let lockReason = '';
            
            if (index > 0 && !prevReceived) {
                locked = true;
                lockReason = `Complete Level ${index} first`;
            } else if (prevReceived) {
                const daysSince = Math.floor((Date.now() - new Date(prevReceived.attunedAt).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSince < 30) {
                    locked = true;
                    lockReason = `Available in ${30 - daysSince} days`;
                }
            }
            
            html += renderAttunementCard(att, received, locked, lockReason);
        });
    });
    
    container.innerHTML = html;
}

// Render single attunement card
function renderAttunementCard(att, received, locked = false, lockReason = '') {
    const statusClass = received ? 'received' : (locked ? 'locked' : '');
    const statusIcon = received ? 'received' : (locked ? 'locked' : '');
    
    return `
        <div class="attunement-card ${statusClass}" onclick="openAttunementDetail('${att.id}')">
            <div class="attunement-card-status ${statusIcon}"></div>
            <div class="attunement-card-header">
                <div class="attunement-card-title">${att.name}</div>
                ${att.seriesName ? `<span class="attunement-card-series">${att.seriesName} Level ${att.level || 1}</span>` : ''}
            </div>
            <div class="attunement-card-description">${att.description || ''}</div>
            <div class="attunement-card-meta">
                <span>⏱ ${att.duration} min</span>
                ${locked ? `<span style="color: #FBBF24;">🔒 ${lockReason}</span>` : ''}
                ${received ? `<span style="color: #10B981;">✓ Received</span>` : ''}
            </div>
        </div>
    `;
}

// Open attunement detail view
function openAttunementDetail(attunementId) {
    const att = attunementState.attunements.find(a => a.id === attunementId);
    if (!att) return;
    
    attunementState.currentAttunement = att;
    
    // Parse description into pages (split by double newline)
    const content = att.description || 'No description available.';
    attunementState.pages = content.split(/\n\n+/).filter(p => p.trim());
    attunementState.currentPage = 0;
    
    // Update header
    document.getElementById('attunementDetailName').textContent = att.name;
    document.getElementById('attunementDetailDuration').textContent = `${att.duration} min`;
    
    const seriesBadge = document.getElementById('attunementDetailSeries');
    if (att.seriesName) {
        seriesBadge.textContent = `${att.seriesName} Level ${att.level || 1}`;
        seriesBadge.style.display = 'inline-block';
    } else {
        seriesBadge.style.display = 'none';
    }
    
    // Check if locked
    const lockStatus = checkAttunementLock(att);
    const lockedMessage = document.getElementById('attunementLockedMessage');
    const activateBtn = document.getElementById('attunementActivateBtn');
    
    if (lockStatus.locked) {
        lockedMessage.classList.remove('hidden');
        document.getElementById('attunementLockedText').textContent = lockStatus.reason;
        activateBtn.classList.add('hidden');
    } else {
        lockedMessage.classList.add('hidden');
    }
    
    // Render dots
    renderAttunementDots();
    updateAttunementPage();
    
    showView('attunementDetail');
}

// Check if attunement is locked
function checkAttunementLock(att) {
    const userId = state.currentUser?.user_id;
    if (!userId) return { locked: true, reason: 'Please select a user first' };
    
    const userAtts = attunementState.userAttunements[userId] || [];
    
    // Check if already received
    if (userAtts.find(ua => ua.attunementId === att.id)) {
        return { locked: false, received: true };
    }
    
    // Check series requirements
    if (att.seriesId && att.level > 1) {
        // Find previous level
        const prevLevel = attunementState.attunements.find(a => 
            a.seriesId === att.seriesId && a.level === att.level - 1
        );
        
        if (prevLevel) {
            const prevReceived = userAtts.find(ua => ua.attunementId === prevLevel.id);
            
            if (!prevReceived) {
                return { locked: true, reason: `Complete Level ${att.level - 1} first` };
            }
            
            // Check 30-day cooldown
            const daysSince = Math.floor((Date.now() - new Date(prevReceived.attunedAt).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince < 30) {
                return { locked: true, reason: `Available in ${30 - daysSince} days` };
            }
        }
    }
    
    return { locked: false };
}

// Render description page dots
function renderAttunementDots() {
    const container = document.getElementById('attunementDots');
    if (!container) return;
    
    container.innerHTML = attunementState.pages.map((_, i) => 
        `<div class="attunement-dot ${i === attunementState.currentPage ? 'active' : ''}"></div>`
    ).join('');
}

// Update current description page
function updateAttunementPage() {
    const content = document.getElementById('attunementDetailContent');
    const prevBtn = document.getElementById('attunementPrevBtn');
    const nextBtn = document.getElementById('attunementNextBtn');
    const activateBtn = document.getElementById('attunementActivateBtn');
    
    const page = attunementState.pages[attunementState.currentPage] || '';
    content.innerHTML = `<p>${page}</p>`;
    
    // Update buttons
    prevBtn.classList.toggle('hidden', attunementState.currentPage === 0);
    
    const isLastPage = attunementState.currentPage === attunementState.pages.length - 1;
    nextBtn.classList.toggle('hidden', isLastPage);
    
    const lockStatus = checkAttunementLock(attunementState.currentAttunement);
    if (isLastPage && !lockStatus.locked && !lockStatus.received) {
        activateBtn.classList.remove('hidden');
    } else {
        activateBtn.classList.add('hidden');
    }
    
    // If already received, show different button
    if (lockStatus.received && isLastPage) {
        activateBtn.textContent = 'Already Received ✓';
        activateBtn.classList.remove('hidden');
        activateBtn.disabled = true;
    } else {
        activateBtn.textContent = 'Begin Attunement';
        activateBtn.disabled = false;
    }
    
    renderAttunementDots();
}

// Navigate pages
function prevAttunementPage() {
    if (attunementState.currentPage > 0) {
        attunementState.currentPage--;
        updateAttunementPage();
    }
}

function nextAttunementPage() {
    if (attunementState.currentPage < attunementState.pages.length - 1) {
        attunementState.currentPage++;
        updateAttunementPage();
    }
}

// Close detail view
function closeAttunementDetail() {
    showView('attunements');
}

// Start attunement process
async function startAttunement() {
    const att = attunementState.currentAttunement;
    if (!att) return;
    
    const lockStatus = checkAttunementLock(att);
    if (lockStatus.locked) {
        showToast(lockStatus.reason, 'error');
        return;
    }
    
    if (lockStatus.received) {
        showToast('You have already received this attunement', 'info');
        return;
    }
    
    // Request notification permission
    await ensureNotificationPermission();
    
    // Initialize audio context
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Setup process view
    document.getElementById('attunementProcessName').textContent = att.name;
    const seriesEl = document.getElementById('attunementProcessSeries');
    if (att.seriesName) {
        seriesEl.textContent = `${att.seriesName} Level ${att.level || 1}`;
        seriesEl.style.display = 'block';
    } else {
        seriesEl.style.display = 'none';
    }
    
    // Set timer
    attunementState.duration = att.duration * 60; // Convert to seconds
    attunementState.remaining = attunementState.duration;
    attunementState.startTime = new Date().toISOString();
    attunementState.endTime = new Date(Date.now() + attunementState.duration * 1000);
    attunementState.isRunning = true;
    
    // Save running state for background persistence
    saveRunningAttunementState();
    
    updateAttunementTimer();
    
    // Start timer interval
    attunementState.timer = setInterval(attunementTick, 1000);
    
    showView('attunementProcess');
    showToast('Attunement started', 'success');
}

// Timer tick
function attunementTick() {
    if (!attunementState.isRunning) return;
    
    const now = new Date();
    attunementState.remaining = Math.max(0, Math.round((attunementState.endTime - now) / 1000));
    
    updateAttunementTimer();
    
    // Save state periodically (every 30 seconds)
    if (attunementState.remaining % 30 === 0) {
        saveRunningAttunementState();
    }
    
    if (attunementState.remaining <= 0) {
        completeAttunement();
    }
}

// Update timer display
function updateAttunementTimer() {
    const remaining = attunementState.remaining;
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    document.getElementById('attunementCountdown').textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    
    const progress = ((attunementState.duration - remaining) / attunementState.duration) * 100;
    document.getElementById('attunementProgressFill').style.width = `${progress}%`;
}

// Cancel attunement
function cancelAttunement() {
    if (confirm('Are you sure you want to cancel this attunement?')) {
        clearInterval(attunementState.timer);
        attunementState.isRunning = false;
        attunementState.timer = null;
        localStorage.removeItem('runningAttunement');
        showView('attunements');
        showToast('Attunement cancelled', 'info');
    }
}

// Complete attunement
function completeAttunement() {
    clearInterval(attunementState.timer);
    attunementState.isRunning = false;
    attunementState.timer = null;
    
    const att = attunementState.currentAttunement;
    
    // Record to local state and backend
    recordAttunementCompletion();
    
    // Play completion sound
    playCompletionSound();
    vibrate([200, 100, 200, 100, 300]);
    
    // Show notification if in background
    if (document.hidden) {
        showNotification(
            'Attunement Complete! ✦',
            `You have received: ${att?.name}`,
            'attunement-complete'
        );
    }
    
    // Show completion view
    document.getElementById('attunementCompleteName').textContent = att?.name || 'Attunement';
    document.getElementById('attunementUsageContent').innerHTML = att?.usageInstructions || 'No specific instructions.';
    
    showView('attunementComplete');
    updateAttunementHomeCard();
}

// Finish attunement (close complete view)
function finishAttunement() {
    showView('attunements');
    renderAttunementsList();
}

// Render My Attunements view
function renderMyAttunements() {
    const container = document.getElementById('myAttunementsList');
    const emptyState = document.getElementById('myAttunementsEmpty');
    if (!container) return;
    
    const userId = state.currentUser?.user_id;
    const userAtts = userId ? (attunementState.userAttunements[userId] || []) : [];
    
    if (userAtts.length === 0) {
        container.classList.add('hidden');
        emptyState?.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyState?.classList.add('hidden');
    
    // Sort by date (newest first)
    const sortedAtts = [...userAtts].sort((a, b) => 
        new Date(b.attunedAt) - new Date(a.attunedAt)
    );
    
    container.innerHTML = sortedAtts.map(ua => {
        const att = attunementState.attunements.find(a => a.id === ua.attunementId);
        if (!att) return '';
        
        const date = new Date(ua.attunedAt).toLocaleDateString();
        
        return `
            <div class="my-attunement-card">
                ${att.seriesName ? `<span class="my-attunement-series">${att.seriesName} Level ${att.level || 1}</span>` : ''}
                <div class="my-attunement-header">
                    <span class="my-attunement-name">${att.name}</span>
                    <span class="my-attunement-date">${date}</span>
                </div>
                ${att.usageInstructions ? `
                    <div class="my-attunement-usage">
                        <strong>How to use:</strong><br>
                        ${att.usageInstructions}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Render admin attunements list
function renderAdminAttunements() {
    const container = document.getElementById('adminAttunementsList');
    const seriesSelect = document.getElementById('newAttunementSeries');
    if (!container) return;
    
    if (attunementState.attunements.length === 0) {
        container.innerHTML = '<p class="settings-hint">No attunements created yet</p>';
    } else {
        container.innerHTML = attunementState.attunements.map(att => `
            <div class="admin-attunement-row">
                <div class="admin-attunement-info">
                    <div class="admin-attunement-name">${att.name}</div>
                    <div class="admin-attunement-meta">
                        ${att.seriesName ? `${att.seriesName} L${att.level}` : 'Standalone'} • 
                        ${att.duration}min • 
                        ${att.visible !== false ? 'Visible' : 'Hidden'}
                    </div>
                </div>
                <div class="admin-attunement-actions">
                    <button onclick="toggleAttunementVisibility('${att.id}')" title="${att.visible !== false ? 'Hide' : 'Show'}">
                        ${att.visible !== false ? '👁' : '👁‍🗨'}
                    </button>
                    <button class="delete" onclick="deleteAttunement('${att.id}')" title="Delete">×</button>
                </div>
            </div>
        `).join('');
    }
    
    // Update series dropdown
    if (seriesSelect) {
        const existingSeries = new Map();
        attunementState.attunements.forEach(a => {
            if (a.seriesId && a.seriesName) {
                existingSeries.set(a.seriesId, a.seriesName);
            }
        });
        
        seriesSelect.innerHTML = '<option value="">No Series (Standalone)</option>';
        existingSeries.forEach((name, id) => {
            seriesSelect.innerHTML += `<option value="${id}">${name}</option>`;
        });
    }
}

// Toggle new series input
function toggleNewSeriesInput() {
    const input = document.getElementById('newSeriesName');
    const select = document.getElementById('newAttunementSeries');
    const levelGroup = document.getElementById('levelGroup');
    const btn = document.getElementById('toggleNewSeries');
    
    if (input.classList.contains('hidden')) {
        input.classList.remove('hidden');
        select.classList.add('hidden');
        btn.textContent = 'Use Existing';
        levelGroup.classList.remove('hidden');
    } else {
        input.classList.add('hidden');
        select.classList.remove('hidden');
        btn.textContent = '+ New Series';
        
        // Show level if series selected
        levelGroup.classList.toggle('hidden', !select.value);
    }
}

// Handle series select change
function onSeriesSelectChange() {
    const select = document.getElementById('newAttunementSeries');
    const levelGroup = document.getElementById('levelGroup');
    const levelInput = document.getElementById('newAttunementLevel');
    
    if (select.value) {
        // Auto-calculate next level
        const seriesAtts = attunementState.attunements.filter(a => a.seriesId === select.value);
        const nextLevel = seriesAtts.length > 0 
            ? Math.max(...seriesAtts.map(a => a.level || 1)) + 1 
            : 1;
        levelInput.value = nextLevel;
        levelGroup.classList.remove('hidden');
    } else {
        levelGroup.classList.add('hidden');
    }
}

// Add new attunement
async function addAttunement() {
    const name = document.getElementById('newAttunementName').value.trim();
    const duration = parseInt(document.getElementById('newAttunementDuration').value) || 30;
    const description = document.getElementById('newAttunementDescription').value.trim();
    const usage = document.getElementById('newAttunementUsage').value.trim();
    
    if (!name) {
        showToast('Please enter an attunement name', 'error');
        return;
    }
    
    // Handle series
    let seriesId = null;
    let seriesName = null;
    let level = 1;
    
    const existingSeries = document.getElementById('newAttunementSeries').value;
    const newSeriesName = document.getElementById('newSeriesName').value.trim();
    
    if (newSeriesName) {
        seriesId = 'series-' + Date.now();
        seriesName = newSeriesName;
        level = parseInt(document.getElementById('newAttunementLevel').value) || 1;
    } else if (existingSeries) {
        seriesId = existingSeries;
        const existingAtt = attunementState.attunements.find(a => a.seriesId === existingSeries);
        seriesName = existingAtt?.seriesName;
        
        // Auto-calculate next level
        const seriesAtts = attunementState.attunements.filter(a => a.seriesId === existingSeries);
        level = Math.max(...seriesAtts.map(a => a.level || 1)) + 1;
    }
    
    const newAttunement = {
        id: 'att-' + Date.now(),
        name,
        description,
        usageInstructions: usage,
        duration,
        seriesId,
        seriesName,
        level,
        visible: true,
        createdAt: new Date().toISOString()
    };
    
    // Add to local state
    attunementState.attunements.push(newAttunement);
    saveAttunementStateToCache();
    
    // Sync to backend
    apiCall('saveAttunement', newAttunement).catch(e => console.warn('Error syncing attunement:', e));
    
    // Clear form
    document.getElementById('newAttunementName').value = '';
    document.getElementById('newAttunementDescription').value = '';
    document.getElementById('newAttunementUsage').value = '';
    document.getElementById('newAttunementDuration').value = '30';
    document.getElementById('newSeriesName').value = '';
    document.getElementById('newAttunementLevel').value = '1';
    
    renderAdminAttunements();
    updateAttunementHomeCard();
    
    showToast(`Added "${name}"`, 'success');
}

// Toggle attunement visibility
function toggleAttunementVisibility(attId) {
    const att = attunementState.attunements.find(a => a.id === attId);
    if (att) {
        att.visible = att.visible === false ? true : false;
        saveAttunementStateToCache();
        
        // Sync to backend
        apiCall('saveAttunement', att).catch(e => console.warn('Error syncing attunement visibility:', e));
        
        renderAdminAttunements();
        updateAttunementHomeCard();
    }
}

// Delete attunement
function deleteAttunement(attId) {
    const att = attunementState.attunements.find(a => a.id === attId);
    if (!att) return;
    
    if (confirm(`Delete "${att.name}"? This cannot be undone.`)) {
        attunementState.attunements = attunementState.attunements.filter(a => a.id !== attId);
        saveAttunementStateToCache();
        
        // Sync to backend
        apiCall('deleteAttunement', { attunementId: attId }).catch(e => console.warn('Error deleting attunement:', e));
        
        renderAdminAttunements();
        updateAttunementHomeCard();
        showToast(`Deleted "${att.name}"`, 'success');
    }
}

// ============================================
// HABIT TRACKER FEATURE
// ============================================

// Default habits configuration
const DEFAULT_HABITS = [
    { id: 'energy-work', name: 'Energy Work', icon: '⚡', autoTracked: true, enabled: true },
    { id: 'meditation', name: 'Meditation', icon: '🧘', autoTracked: false, enabled: true },
    { id: 'nature', name: 'Time in Nature', icon: '🌿', autoTracked: false, enabled: true },
    { id: 'gratitude', name: 'Gratitude', icon: '🙏', autoTracked: false, enabled: true },
    { id: 'signal', name: 'Signal', icon: '📡', autoTracked: true, enabled: true },
    { id: 'intentions', name: 'Intentions', icon: '🎯', autoTracked: false, enabled: true }
];

// Habit state
let habitState = {
    habits: [],           // All habits (default + custom)
    completions: {},      // { date: { habitId: true/false } }
    stats: {
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: {}  // { habitId: count }
    }
};

// Initialize habit tracker
function initHabitTracker() {
    loadHabitState();
    updateHabitsView();
    updateHabitHomeCard();
}

// Load habit state from localStorage
function loadHabitState() {
    const saved = localStorage.getItem('habitState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            habitState = {
                ...habitState,
                ...parsed,
                habits: parsed.habits || [...DEFAULT_HABITS]
            };
        } catch (e) {
            console.error('Error loading habit state:', e);
            habitState.habits = [...DEFAULT_HABITS];
        }
    } else {
        habitState.habits = [...DEFAULT_HABITS];
    }
    
    // Ensure all default habits exist (in case new ones were added)
    DEFAULT_HABITS.forEach(defaultHabit => {
        const exists = habitState.habits.find(h => h.id === defaultHabit.id);
        if (!exists) {
            habitState.habits.push({ ...defaultHabit });
        }
    });
    
    // Initialize completions for today if not exists
    const today = getTodayDateString();
    if (!habitState.completions[today]) {
        habitState.completions[today] = {};
    }
    
    // Check auto-tracked habits for today
    checkAutoTrackedHabits();
}

// Save habit state to localStorage
function saveHabitState() {
    localStorage.setItem('habitState', JSON.stringify(habitState));
}

// Get today's date string (YYYY-MM-DD)
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// Check and update auto-tracked habits based on app activity
function checkAutoTrackedHabits() {
    const today = getTodayDateString();
    
    // Check for energy work sessions today
    if (state.sessions) {
        const todaySessions = state.sessions.filter(s => {
            const sessionDate = new Date(s.start_time).toISOString().split('T')[0];
            return sessionDate === today;
        });
        if (todaySessions.length > 0) {
            habitState.completions[today]['energy-work'] = true;
        }
    }
    
    // Check for signal completions today
    if (typeof signalState !== 'undefined' && signalState.stats) {
        if (signalState.stats.todayCount > 0) {
            habitState.completions[today]['signal'] = true;
        }
    }
    
    saveHabitState();
}

// Mark habit as completed when session is saved (called from saveSession)
function markEnergyWorkHabit() {
    const today = getTodayDateString();
    if (!habitState.completions[today]) {
        habitState.completions[today] = {};
    }
    habitState.completions[today]['energy-work'] = true;
    saveHabitState();
    updateHabitsView();
    updateHabitHomeCard();
}

// Mark signal habit as completed (called from Signal feature)
function markSignalHabit() {
    const today = getTodayDateString();
    if (!habitState.completions[today]) {
        habitState.completions[today] = {};
    }
    habitState.completions[today]['signal'] = true;
    saveHabitState();
    updateHabitsView();
    updateHabitHomeCard();
}

// Toggle habit completion
function toggleHabit(habitId) {
    const today = getTodayDateString();
    if (!habitState.completions[today]) {
        habitState.completions[today] = {};
    }
    
    // Check if habit is auto-tracked and completed - don't allow manual unchecking
    const habit = habitState.habits.find(h => h.id === habitId);
    if (habit && habit.autoTracked && habitState.completions[today][habitId]) {
        showToast('This habit is automatically tracked', 'info');
        return;
    }
    
    habitState.completions[today][habitId] = !habitState.completions[today][habitId];
    saveHabitState();
    
    // Update UI
    updateHabitsView();
    updateHabitHomeCard();
    
    // Provide feedback
    if (habitState.completions[today][habitId]) {
        showToast(`${habit?.name || 'Habit'} completed! ✓`, 'success');
    }
}

// Update the habits view
function updateHabitsView() {
    const grid = document.getElementById('habitsGrid');
    if (!grid) return;
    
    const today = getTodayDateString();
    const todayCompletions = habitState.completions[today] || {};
    
    // Filter enabled habits only
    const enabledHabits = habitState.habits.filter(h => h.enabled);
    
    if (enabledHabits.length === 0) {
        grid.innerHTML = `
            <div class="habits-empty" style="grid-column: span 2;">
                <p>No habits enabled</p>
                <button class="btn secondary" onclick="showView('habitSettings')">Configure Habits</button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = enabledHabits.map(habit => {
        const isCompleted = todayCompletions[habit.id] || false;
        const autoClass = habit.autoTracked ? 'auto-tracked' : '';
        const completedClass = isCompleted ? 'completed' : '';
        
        return `
            <div class="habit-card ${completedClass} ${autoClass}" onclick="toggleHabit('${habit.id}')">
                <div class="habit-check">${isCompleted ? '✓' : ''}</div>
                <div class="habit-icon">${habit.icon}</div>
                <div class="habit-name">${habit.name}</div>
            </div>
        `;
    }).join('');
    
    // Update date display
    const dateEl = document.getElementById('habitsCurrentDate');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    // Update summary
    const completedCount = enabledHabits.filter(h => todayCompletions[h.id]).length;
    document.getElementById('habitsCompletedCount').textContent = completedCount;
    
    // Calculate streak
    const streak = calculateHabitStreak();
    document.getElementById('habitsStreakCount').textContent = streak;
    habitState.stats.currentStreak = streak;
    if (streak > habitState.stats.longestStreak) {
        habitState.stats.longestStreak = streak;
    }
    saveHabitState();
}

// Calculate current habit streak (all enabled habits completed)
function calculateHabitStreak() {
    const enabledHabits = habitState.habits.filter(h => h.enabled);
    if (enabledHabits.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    
    // Check if all habits are completed today first
    const todayStr = getTodayDateString();
    const todayCompletions = habitState.completions[todayStr] || {};
    const allCompletedToday = enabledHabits.every(h => todayCompletions[h.id]);
    
    // Start from yesterday if today isn't complete
    let checkDate = new Date(today);
    if (!allCompletedToday) {
        checkDate.setDate(checkDate.getDate() - 1);
    } else {
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Count consecutive days going backward
    for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const completions = habitState.completions[dateStr] || {};
        const allCompleted = enabledHabits.every(h => completions[h.id]);
        
        if (allCompleted) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    return streak;
}

// Update habit home card
function updateHabitHomeCard() {
    const today = getTodayDateString();
    const todayCompletions = habitState.completions[today] || {};
    const enabledHabits = habitState.habits.filter(h => h.enabled);
    
    const completedCount = enabledHabits.filter(h => todayCompletions[h.id]).length;
    const totalCount = enabledHabits.length;
    
    const progressEl = document.getElementById('habitTodayProgress');
    if (progressEl) {
        progressEl.textContent = `${completedCount} of ${totalCount} today`;
    }
    
    const streakEl = document.getElementById('habitStreakDisplay');
    if (streakEl) {
        const streak = habitState.stats.currentStreak || 0;
        streakEl.textContent = `🔥 ${streak} day streak`;
    }
}

// Update habit settings view
function updateHabitSettingsView() {
    const list = document.getElementById('habitSettingsList');
    if (!list) return;
    
    // Show default habits with toggle
    const defaultHabits = habitState.habits.filter(h => 
        DEFAULT_HABITS.find(d => d.id === h.id)
    );
    
    list.innerHTML = defaultHabits.map(habit => `
        <div class="habit-setting-row">
            <div class="habit-setting-info">
                <span class="habit-setting-icon">${habit.icon}</span>
                <span class="habit-setting-name">${habit.name}</span>
                ${habit.autoTracked ? '<span class="habit-setting-auto">Auto-tracked</span>' : ''}
            </div>
            <label class="toggle">
                <input type="checkbox" ${habit.enabled ? 'checked' : ''} 
                    onchange="toggleHabitEnabled('${habit.id}', this.checked)">
                <span class="toggle-slider"></span>
            </label>
        </div>
    `).join('');
    
    // Show custom habits
    const customList = document.getElementById('customHabitsList');
    if (!customList) return;
    
    const customHabits = habitState.habits.filter(h => 
        !DEFAULT_HABITS.find(d => d.id === h.id)
    );
    
    if (customHabits.length === 0) {
        customList.innerHTML = '<p class="settings-hint">No custom habits yet</p>';
    } else {
        customList.innerHTML = customHabits.map(habit => `
            <div class="custom-habit-row">
                <span class="custom-habit-name">${habit.icon} ${habit.name}</span>
                <button class="custom-habit-delete" onclick="removeCustomHabit('${habit.id}')" title="Delete">×</button>
            </div>
        `).join('');
    }
}

// Toggle habit enabled/disabled
function toggleHabitEnabled(habitId, enabled) {
    const habit = habitState.habits.find(h => h.id === habitId);
    if (habit) {
        habit.enabled = enabled;
        saveHabitState();
        updateHabitsView();
        updateHabitHomeCard();
    }
}

// Add custom habit
function addCustomHabit() {
    const input = document.getElementById('newHabitName');
    const name = input.value.trim();
    
    if (!name) {
        showToast('Please enter a habit name', 'error');
        return;
    }
    
    if (name.length > 30) {
        showToast('Habit name too long (max 30 characters)', 'error');
        return;
    }
    
    // Generate unique ID
    const id = 'custom-' + Date.now();
    
    // Add to habits list
    habitState.habits.push({
        id: id,
        name: name,
        icon: '⭐',  // Default icon for custom habits
        autoTracked: false,
        enabled: true
    });
    
    saveHabitState();
    input.value = '';
    
    updateHabitSettingsView();
    updateHabitsView();
    updateHabitHomeCard();
    
    showToast(`Added "${name}"`, 'success');
}

// Remove custom habit
function removeCustomHabit(habitId) {
    const habit = habitState.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    if (confirm(`Remove "${habit.name}"?`)) {
        habitState.habits = habitState.habits.filter(h => h.id !== habitId);
        saveHabitState();
        
        updateHabitSettingsView();
        updateHabitsView();
        updateHabitHomeCard();
        
        showToast(`Removed "${habit.name}"`, 'success');
    }
}

// Update habit statistics in stats view
function updateHabitStats() {
    const grid = document.getElementById('habitStatsGrid');
    if (!grid) return;
    
    const enabledHabits = habitState.habits.filter(h => h.enabled);
    
    // Calculate completion rate for each habit (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let totalPossible = 0;
    let totalCompleted = 0;
    
    grid.innerHTML = enabledHabits.map(habit => {
        let completed = 0;
        let possible = 0;
        
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];
            
            // Only count days where we have any data (habit was enabled)
            if (habitState.completions[dateStr]) {
                possible++;
                totalPossible++;
                if (habitState.completions[dateStr][habit.id]) {
                    completed++;
                    totalCompleted++;
                }
            }
        }
        
        const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
        
        return `
            <div class="habit-stat-item">
                <span class="habit-stat-name">
                    <span class="habit-stat-icon">${habit.icon}</span>
                    ${habit.name}
                </span>
                <span class="habit-stat-value">${rate}%</span>
            </div>
        `;
    }).join('');
    
    // Update summary stats
    document.getElementById('statsHabitStreak').textContent = 
        `${habitState.stats.currentStreak || 0} days`;
    document.getElementById('statsHabitBestStreak').textContent = 
        `${habitState.stats.longestStreak || 0} days`;
    
    const overallRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    document.getElementById('statsHabitCompletionRate').textContent = `${overallRate}%`;
}

// ============================================
// SIGNAL FEATURE
// ============================================

// Sample signal data (will be replaced with .md file loading later)
// ============================================
// SIGNAL LESSON DATA
// ============================================

// GitHub configuration for lesson files
const SIGNAL_CONFIG = {
    // Base URL for raw GitHub content (user should update this)
    baseUrl: 'https://raw.githubusercontent.com/tuomashel/energy-tracker/main/signals',
    categories: ['foundations', 'presence', 'collective-wisdom', 'creation', 'thought-leaders'],
    categoryLabels: {
        'foundations': 'Foundations',
        'presence': 'Presence',
        'collective-wisdom': 'Collective Wisdom',
        'creation': 'Creation',
        'thought-leaders': 'Life, Business & Beyond'
    },
    cacheKey: 'signalLessonsCache',
    versionKey: 'signalLessonsVersion',
    // How often to check for updates (in hours)
    updateCheckInterval: 24
};

// Lesson data (loaded from cache or fetched)
let SIGNAL_DATA = {
    'foundations': [],
    'presence': [],
    'collective-wisdom': [],
    'creation': [],
    'thought-leaders': []
};

// Load signal lessons from cache or fetch from GitHub
async function loadSignalLessons() {
    try {
        // First, try to load from cache
        const cached = localStorage.getItem(SIGNAL_CONFIG.cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            SIGNAL_DATA = parsed.data;
            console.log('Loaded signal lessons from cache');
            
            // Check if we should update in background
            const lastCheck = localStorage.getItem(SIGNAL_CONFIG.versionKey);
            const hoursSinceCheck = lastCheck ? 
                (Date.now() - parseInt(lastCheck)) / (1000 * 60 * 60) : 999;
            
            if (hoursSinceCheck > SIGNAL_CONFIG.updateCheckInterval) {
                // Update in background (don't await)
                fetchSignalLessonsFromGitHub().catch(e => console.log('Background update failed:', e));
            }
            
            return true;
        }
        
        // No cache - fetch from GitHub
        return await fetchSignalLessonsFromGitHub();
        
    } catch (error) {
        console.error('Error loading signal lessons:', error);
        // If all else fails, use fallback sample data
        loadFallbackLessons();
        return false;
    }
}

// Fetch lessons from GitHub
async function fetchSignalLessonsFromGitHub() {
    console.log('Fetching signal lessons from GitHub...');
    
    const newData = {};
    let hasUpdates = false;
    
    for (const category of SIGNAL_CONFIG.categories) {
        try {
            const url = `${SIGNAL_CONFIG.baseUrl}/${category}.md`;
            const response = await fetch(url, { cache: 'no-store' });
            
            if (!response.ok) {
                console.warn(`Failed to fetch ${category}.md: ${response.status}`);
                // Keep existing data for this category
                newData[category] = SIGNAL_DATA[category] || [];
                continue;
            }
            
            let markdown = await response.text();
            // Normalize line endings (Windows/Mac -> Unix)
            markdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            const lessons = parseMarkdownLessons(markdown, category);
            
            if (lessons.length > 0) {
                newData[category] = lessons;
                hasUpdates = true;
                console.log(`Loaded ${lessons.length} ${category} lessons`);
            } else {
                newData[category] = SIGNAL_DATA[category] || [];
            }
            
        } catch (error) {
            console.warn(`Error fetching ${category} lessons:`, error);
            newData[category] = SIGNAL_DATA[category] || [];
        }
    }
    
    // Update data and cache
    if (hasUpdates) {
        SIGNAL_DATA = newData;
        
        // Save to cache (with error handling for quota exceeded)
        try {
            localStorage.setItem(SIGNAL_CONFIG.cacheKey, JSON.stringify({
                data: SIGNAL_DATA,
                timestamp: Date.now()
            }));
            localStorage.setItem(SIGNAL_CONFIG.versionKey, Date.now().toString());
            console.log('Signal lessons cached successfully');
        } catch (e) {
            console.warn('Failed to cache lessons (storage quota?):', e);
            // Continue without caching - data is still in memory
        }
        
        return true;
    }
    
    return false;
}

// Parse markdown file into lessons array
function parseMarkdownLessons(markdown, category) {
    const lessons = [];
    
    // Split by --- separator (flexible: handles multiple newlines/whitespace around it)
    const sections = markdown.split(/\n+\s*---\s*\n+/).filter(s => s.trim());
    
    console.log(`Parsing ${category}: found ${sections.length} sections`);
    
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (!section) continue;
        
        // Skip TOC and header sections
        if (section.includes('Table of Contents') || 
            section.includes('## Table of') ||
            section.match(/^#\s*Your Title/i) ||
            section.match(/^\*Source:/m)) {
            console.log(`Skipping TOC/header section ${i}`);
            continue;
        }
        
        // Extract title from ### Lesson N: Title format (anywhere in section)
        const titleMatch = section.match(/###\s*Lesson\s*(\d+):\s*(.+?)(?:\n|$)/i);
        
        if (titleMatch) {
            const lessonNumber = parseInt(titleMatch[1]);
            const title = titleMatch[2].trim();
            
            // Content is everything after the title line
            const titleEndIndex = titleMatch.index + titleMatch[0].length;
            let content = section.substring(titleEndIndex).trim();
            
            // If no content, use a placeholder
            if (!content) {
                content = 'Content coming soon.';
            }
            
            lessons.push({
                id: `${category}-${lessonNumber}`,
                number: lessonNumber,
                title: title,
                content: content
            });
        } else {
            // Fallback: Try to extract any heading (for non-standard formats)
            const headingMatch = section.match(/^#+\s*(.+?)(?:\n|$)/m);
            if (headingMatch) {
                const title = headingMatch[1].trim().toLowerCase();
                // Skip part/section/toc headers
                if (title.startsWith('part ') || 
                    title.includes('section') ||
                    title.includes('table of contents') ||
                    title.includes('your title')) {
                    continue;
                }
                const contentStart = section.indexOf('\n', headingMatch.index) + 1;
                let content = section.substring(contentStart).trim();
                
                if (!content) {
                    content = 'Content coming soon.';
                }
                
                lessons.push({
                    id: `${category}-${i + 1}`,
                    number: i + 1,
                    title: headingMatch[1].trim(),
                    content: content
                });
            }
        }
    }
    
    // Sort by lesson number
    lessons.sort((a, b) => a.number - b.number);
    
    console.log(`Parsed ${lessons.length} lessons from ${category}`);
    return lessons;
}

// Fallback sample lessons if GitHub fetch fails
function loadFallbackLessons() {
    SIGNAL_DATA = {
        'foundations': [
            {
                id: 'foundations-1',
                number: 1,
                title: 'Building a Strong Foundation',
                content: `Every transformation begins with a solid foundation. Before you can build higher, you must ensure your base is stable.

Take time to examine your current foundations. What beliefs, habits, and patterns are you building upon?

The strongest structures are built slowly, with attention to each layer. Your development is no different.`
            }
        ],
        'presence': [
            {
                id: 'presence-1',
                number: 1,
                title: 'The Power of Now',
                content: `Presence is your natural state, obscured only by thinking. When you're fully here, problems dissolve into situations that can be dealt with.

Notice where your attention is right now. Is it here, or is it lost in past or future?

The present moment is the only moment you ever have. Everything else is memory or imagination.`
            }
        ],
        'collective-wisdom': [
            {
                id: 'collective-wisdom-1',
                number: 1,
                title: 'Standing on Giants',
                content: `We don't have to figure everything out alone. Countless teachers, thinkers, and practitioners have walked this path before us.

Their insights are available to us if we're willing to receive them. Not as dogma to follow blindly, but as maps to consider.

The wisdom of the ages is your inheritance. Claim it, test it, and make it your own.`
            }
        ],
        'creation': [
            {
                id: 'creation-1',
                number: 1,
                title: 'You Are a Creator',
                content: `Creation is not reserved for artists. Every thought you think, every word you speak, every action you take is an act of creation.

What are you creating with your life? What patterns are you reinforcing? What possibilities are you opening?

When you recognize yourself as a creator, victimhood becomes impossible. You are always making something.`
            }
        ],
        'thought-leaders': [
            {
                id: 'thought-leaders-1',
                number: 1,
                title: 'Principles in Action',
                content: `True wisdom isn't just understood—it's applied. The gap between knowing and doing is where most growth opportunities live.

How are you applying what you've learned? Where is your knowledge outpacing your practice?

Life, business, and relationships all respond to the same fundamental principles. See them, and you see everywhere.`
            }
        ]
    };
    console.log('Loaded fallback signal lessons');
}

// Force refresh lessons from GitHub
async function refreshSignalLessons() {
    showToast('Checking for new lessons...', 'success');
    const success = await fetchSignalLessonsFromGitHub();
    if (success) {
        showToast('Lessons updated!', 'success');
    } else {
        showToast('No updates available', 'success');
    }
    return success;
}

// Get lesson count for a category
function getSignalLessonCount(category) {
    return SIGNAL_DATA[category]?.length || 0;
}

// Signal state
const signalState = {
    currentSignal: null,
    currentCategory: 'all',
    isFavorited: false,
    currentRating: null,    // 'up' or 'down'
    steps: [],              // Parsed content steps for reader
    currentStep: 0,         // Current step in reader
    history: [],            // Local history cache
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
        categoriesEnabled: ['foundations', 'presence', 'collective-wisdom', 'creation', 'thought-leaders'],
        categoryRatios: { 
            'foundations': 20, 
            'presence': 20, 
            'collective-wisdom': 20, 
            'creation': 20, 
            'thought-leaders': 20 
        },
        categoryOrder: { 
            'foundations': 'sequential', 
            'presence': 'sequential', 
            'collective-wisdom': 'sequential', 
            'creation': 'sequential', 
            'thought-leaders': 'sequential' 
        },
        categoryIndex: { 
            'foundations': 0, 
            'presence': 0, 
            'collective-wisdom': 0, 
            'creation': 0, 
            'thought-leaders': 0 
        },
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
        
        // Sync with backend after a short delay (non-blocking)
        setTimeout(() => {
            syncSignalDataWithBackend().catch(e => console.warn('Signal sync error:', e));
        }, 1000);
        
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
    updateSignalCategoryOptions();
    
    // Reset to prompt view
    document.getElementById('signalPrompt').classList.remove('hidden');
    document.getElementById('signalDisplay').classList.add('hidden');
    signalState.currentSignal = null;
    signalState.isFavorited = false;
}

// Update category select options with lesson counts
function updateSignalCategoryOptions() {
    const select = document.getElementById('signalCategorySelect');
    if (!select) return;
    
    // Calculate total count
    let totalCount = 0;
    for (const cat of SIGNAL_CONFIG.categories) {
        totalCount += getSignalLessonCount(cat);
    }
    
    // Build options
    let optionsHtml = `<option value="all">All (${totalCount})</option>`;
    
    for (const cat of SIGNAL_CONFIG.categories) {
        const count = getSignalLessonCount(cat);
        const label = SIGNAL_CONFIG.categoryLabels[cat] || cat;
        optionsHtml += `<option value="${cat}">${label} (${count})</option>`;
    }
    
    select.innerHTML = optionsHtml;
    
    // Restore selected value
    select.value = signalState.currentCategory;
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

// Recalculate stats from history (after backend sync)
function recalculateSignalStats() {
    const today = new Date().toDateString();
    
    // Count today's completions
    const todayCompletions = signalState.history.filter(h => 
        h.status === 'completed' && 
        h.completedAt && 
        new Date(h.completedAt).toDateString() === today
    ).length;
    
    // Total completions
    const totalCompleted = signalState.history.filter(h => h.status === 'completed').length;
    
    // Calculate streak from history
    let currentStreak = 0;
    let longestStreak = signalState.stats.longestStreak || 0;
    
    // Get unique days with completions, sorted descending
    const completionDays = [...new Set(
        signalState.history
            .filter(h => h.status === 'completed' && h.completedAt)
            .map(h => new Date(h.completedAt).toDateString())
    )].sort((a, b) => new Date(b) - new Date(a));
    
    if (completionDays.length > 0) {
        // Check if today or yesterday has completions
        const todayStr = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        if (completionDays[0] === todayStr || completionDays[0] === yesterdayStr) {
            currentStreak = 1;
            let checkDate = new Date(completionDays[0]);
            
            for (let i = 1; i < completionDays.length; i++) {
                checkDate.setDate(checkDate.getDate() - 1);
                if (completionDays[i] === checkDate.toDateString()) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }
    }
    
    // Update stats
    signalState.stats.todayCount = todayCompletions;
    signalState.stats.todayDate = today;
    signalState.stats.totalCompleted = totalCompleted;
    signalState.stats.currentStreak = currentStreak;
    if (currentStreak > longestStreak) {
        signalState.stats.longestStreak = currentStreak;
    }
    
    saveSignalState();
}

// Update signal category filter
function updateSignalCategory() {
    signalState.currentCategory = document.getElementById('signalCategorySelect').value;
}

// Get random signal
function getRandomSignal() {
    let category = signalState.currentCategory;
    let selectedCategory = category;
    let availableLessons = [];
    
    if (category === 'all') {
        // Use weighted selection based on ratios to pick a category
        const categories = Object.keys(SIGNAL_DATA).filter(cat => 
            signalState.settings.categoriesEnabled.includes(cat)
        );
        
        if (categories.length === 0) {
            showToast('No categories enabled', 'error');
            return;
        }
        
        const totalWeight = categories.reduce((sum, cat) => sum + (signalState.settings.categoryRatios[cat] || 50), 0);
        const rand = Math.random() * totalWeight;
        let cumulative = 0;
        
        for (const cat of categories) {
            cumulative += (signalState.settings.categoryRatios[cat] || 50);
            if (rand <= cumulative) {
                selectedCategory = cat;
                break;
            }
        }
    }
    
    availableLessons = SIGNAL_DATA[selectedCategory] || [];
    
    if (availableLessons.length === 0) {
        showToast('No signals available in this category', 'error');
        return;
    }
    
    // Get lesson based on order setting (sequential or random)
    const orderMode = signalState.settings.categoryOrder[selectedCategory] || 'sequential';
    let lesson;
    
    if (orderMode === 'sequential') {
        // Get current index for this category
        let currentIndex = signalState.settings.categoryIndex[selectedCategory] || 0;
        
        // Wrap around if past end
        if (currentIndex >= availableLessons.length) {
            currentIndex = 0;
        }
        
        lesson = availableLessons[currentIndex];
        
        // Increment index for next time
        signalState.settings.categoryIndex[selectedCategory] = currentIndex + 1;
        saveSignalState();
    } else {
        // Random selection
        const randomIndex = Math.floor(Math.random() * availableLessons.length);
        lesson = availableLessons[randomIndex];
    }
    
    // Display the signal
    displaySignal(lesson, selectedCategory);
}

// Display a signal in the step-by-step reader
function displaySignal(lesson, category) {
    signalState.currentSignal = { ...lesson, category };
    signalState.isFavorited = isSignalFavorited(lesson.id);
    signalState.currentRating = null;
    
    // Parse content into steps (title + paragraphs)
    // Normalize line endings and split by double newlines (handles \r\n, multiple spaces, etc.)
    const normalizedContent = lesson.content
        .replace(/\r\n/g, '\n')     // Windows -> Unix
        .replace(/\r/g, '\n')       // Old Mac -> Unix
        .replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines
    
    const paragraphs = normalizedContent.split(/\n\n+/).filter(p => p.trim());
    
    signalState.steps = [
        { type: 'title', content: lesson.title },
        ...paragraphs.map(p => ({ type: 'paragraph', content: p.trim() }))
    ];
    signalState.currentStep = 0;
    
    // Set category badge
    const badge = document.getElementById('readerCategoryBadge');
    const categoryLabel = SIGNAL_CONFIG.categoryLabels[category] || category;
    badge.textContent = categoryLabel.toUpperCase();
    badge.className = 'signal-reader-badge ' + category;
    
    // Set lesson number
    document.getElementById('readerLessonNumber').textContent = `Lesson ${lesson.number}`;
    
    // Generate dots
    renderSignalDots();
    
    // Reset end screen
    document.getElementById('signalEndScreen').classList.add('hidden');
    document.getElementById('readerNav').classList.remove('hidden');
    document.querySelector('.signal-reader-content').classList.remove('hidden');
    
    // Reset rating buttons
    document.querySelectorAll('.signal-rating-btn').forEach(btn => btn.classList.remove('selected'));
    
    // Show first step
    renderSignalStep();
    
    // Show the reader view
    document.getElementById('viewSignalReader').classList.add('active');
    
    // Setup swipe handlers
    setupSignalSwipe();
    
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
    const navEl = document.getElementById('readerNav');
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
    
    // Change button text on last step
    nextBtn.textContent = isLast ? 'Finish →' : 'Next →';
    
    // Always show nav during content steps
    navEl.classList.remove('hidden');
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
    } else {
        // On last step - show end screen
        showSignalEndScreen();
    }
}

// Show the end screen
function showSignalEndScreen() {
    // Hide content and nav
    document.querySelector('.signal-reader-content').classList.add('hidden');
    document.getElementById('readerNav').classList.add('hidden');
    
    // Show end screen
    document.getElementById('signalEndScreen').classList.remove('hidden');
    
    // Update favorite button state
    updateReaderFavoriteButton();
}

// Exit signal reader (X button) - with confirmation
function confirmExitSignal() {
    document.getElementById('exitSignalModal').classList.add('active');
}

function closeExitSignalModal() {
    document.getElementById('exitSignalModal').classList.remove('active');
}

function confirmExitSignalNow() {
    closeExitSignalModal();
    exitSignalReader();
}

// Actually exit the reader
function exitSignalReader() {
    document.getElementById('viewSignalReader').classList.remove('active');
    signalState.currentSignal = null;
    signalState.steps = [];
    signalState.currentStep = 0;
    signalState.currentRating = null;
}

// Rate signal (thumbs up/down)
function rateSignal(rating) {
    signalState.currentRating = rating;
    
    // Update UI
    document.querySelectorAll('.signal-rating-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.rating === rating);
    });
    
    // Store rating in history
    if (signalState.currentSignal) {
        const historyItem = signalState.history.find(h => h.id === signalState.currentSignal.id);
        if (historyItem) {
            historyItem.rating = rating;
            saveSignalState();
        }
    }
}

// Setup swipe navigation
function setupSignalSwipe() {
    const content = document.getElementById('signalReaderContent');
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;
    
    const handleTouchStart = (e) => {
        touchStartX = e.changedTouches[0].screenX;
    };
    
    const handleTouchEnd = (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    };
    
    const handleSwipe = () => {
        const distance = touchEndX - touchStartX;
        
        if (Math.abs(distance) < minSwipeDistance) return;
        
        if (distance > 0) {
            // Swipe right - go back
            prevSignalStep();
        } else {
            // Swipe left - go forward
            nextSignalStep();
        }
    };
    
    // Remove existing listeners if any
    content.removeEventListener('touchstart', handleTouchStart);
    content.removeEventListener('touchend', handleTouchEnd);
    
    // Add new listeners
    content.addEventListener('touchstart', handleTouchStart, { passive: true });
    content.addEventListener('touchend', handleTouchEnd, { passive: true });
}

// Set signal order for a category
function setSignalOrder(category, order) {
    signalState.settings.categoryOrder[category] = order;
    
    // Update UI
    document.querySelectorAll(`.order-btn[data-cat="${category}"]`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.order === order);
    });
    
    saveSignalState();
    showToast(`${capitalize(category)}: ${order === 'sequential' ? 'Sequential' : 'Random'} order`, 'success');
}

// Update favorite button in reader
function updateReaderFavoriteButton() {
    const btn = document.getElementById('readerFavoriteBtn');
    const icon = btn.querySelector('.favorite-icon');
    const text = btn.querySelector('.favorite-text');
    
    btn.classList.toggle('active', signalState.isFavorited);
    icon.textContent = signalState.isFavorited ? '♥' : '♡';
    if (text) {
        text.textContent = signalState.isFavorited ? 'Saved to Favorites' : 'Save to Favorites';
    }
}

// Record signal shown in history
function recordSignalShown(lesson, category) {
    const record = {
        id: lesson.id,
        lessonId: lesson.id,
        lessonNumber: lesson.number,
        title: lesson.title,
        category: category,
        status: 'shown',
        isFavorite: false,
        rating: null,  // 'up' or 'down'
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
        
        // Sync to backend (non-blocking)
        syncSignalHistoryRecord(record);
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
        
        // Sync to backend (non-blocking)
        syncSignalHistoryRecord(historyItem);
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
        historyItem.rating = signalState.currentRating;
        
        // Sync to backend (non-blocking)
        syncSignalHistoryRecord(historyItem);
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
    
    // Mark signal habit as completed
    markSignalHabit();
    
    // Sync settings (for categoryIndex updates)
    syncSignalSettingsToBackend();
    
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
        
        // Sync to backend (non-blocking)
        syncSignalHistoryRecord(historyItem);
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
    const categoryLabel = SIGNAL_CONFIG.categoryLabels[category] || category;
    badge.textContent = categoryLabel.toUpperCase();
    badge.className = 'signal-category-badge ' + category;
    
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
    
    // Categories - loop through all
    for (const cat of SIGNAL_CONFIG.categories) {
        const checkbox = document.getElementById(`signalCat-${cat}`);
        const slider = document.getElementById(`signalRatio-${cat}`);
        
        if (checkbox) {
            checkbox.checked = s.categoriesEnabled.includes(cat);
        }
        if (slider) {
            slider.value = s.categoryRatios[cat] || 20;
        }
        
        // Order buttons
        const order = s.categoryOrder?.[cat] || 'sequential';
        document.querySelectorAll(`.order-btn[data-cat="${cat}"]`).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.order === order);
        });
    }
    
    updateCategoryRatios();
    
    // Notifications
    document.getElementById('signalNotificationsEnabled').checked = s.notificationsEnabled;
    
    // Lesson counts - generate dynamically
    const container = document.getElementById('lessonCountsContainer');
    if (container) {
        container.innerHTML = SIGNAL_CONFIG.categories.map(cat => {
            const count = getSignalLessonCount(cat);
            const label = SIGNAL_CONFIG.categoryLabels[cat] || cat;
            return `
                <div class="lesson-count-row">
                    <span class="lesson-category-name">${label}</span>
                    <span class="lesson-count">${count} lesson${count !== 1 ? 's' : ''}</span>
                </div>
            `;
        }).join('');
    }
    
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
    // Get all slider values
    const values = {};
    let total = 0;
    
    for (const cat of SIGNAL_CONFIG.categories) {
        const slider = document.getElementById(`signalRatio-${cat}`);
        if (slider) {
            values[cat] = parseInt(slider.value) || 0;
            total += values[cat];
        }
    }
    
    // Update percentage displays
    for (const cat of SIGNAL_CONFIG.categories) {
        const ratioEl = document.getElementById(`ratio-${cat}`);
        if (ratioEl) {
            const pct = total > 0 ? Math.round((values[cat] / total) * 100) : 0;
            ratioEl.textContent = `${pct}%`;
        }
    }
}

// Save signal settings
function saveSignalSettings() {
    const s = signalState.settings;
    
    s.signalsPerDay = parseInt(document.getElementById('signalGoalValue').textContent);
    s.windowStart = parseInt(document.getElementById('signalWindowStart').value);
    s.windowEnd = parseInt(document.getElementById('signalWindowEnd').value);
    
    // Categories enabled - loop through all
    s.categoriesEnabled = [];
    const values = {};
    let total = 0;
    
    for (const cat of SIGNAL_CONFIG.categories) {
        const checkbox = document.getElementById(`signalCat-${cat}`);
        const slider = document.getElementById(`signalRatio-${cat}`);
        
        if (checkbox?.checked) {
            s.categoriesEnabled.push(cat);
        }
        
        if (slider) {
            values[cat] = parseInt(slider.value) || 0;
            total += values[cat];
        }
    }
    
    // Normalize ratios to percentages
    s.categoryRatios = {};
    for (const cat of SIGNAL_CONFIG.categories) {
        s.categoryRatios[cat] = total > 0 ? Math.round((values[cat] / total) * 100) : 20;
    }
    
    s.notificationsEnabled = document.getElementById('signalNotificationsEnabled').checked;
    
    saveSignalState();
    updateSignalStats();
    updateSignalHomeCard();
    
    // Reschedule notifications with new settings
    rescheduleSignalNotifications();
    
    // Sync to backend (non-blocking)
    syncSignalSettingsToBackend();
    
    showToast('Settings saved', 'success');
}

// ============================================
// SIGNAL BACKEND SYNC
// ============================================

// Sync signal settings to backend
async function syncSignalSettingsToBackend() {
    if (!state.currentUser) return;
    
    const s = signalState.settings;
    
    try {
        const response = await fetch(`${API_URL}?action=saveSignalSettings`, {
            method: 'POST',
            body: JSON.stringify({
                userId: state.currentUser.user_id,
                signalsPerDay: s.signalsPerDay,
                windowStart: s.windowStart,
                windowEnd: s.windowEnd,
                categoriesEnabled: s.categoriesEnabled,
                categoryRatios: s.categoryRatios,
                categoryOrder: s.categoryOrder,
                categoryIndex: s.categoryIndex,
                notificationsEnabled: s.notificationsEnabled
            })
        });
        
        const result = await response.json();
        if (!result.success) {
            console.warn('Failed to sync signal settings:', result.error);
        } else {
            console.log('Signal settings synced to backend');
        }
    } catch (error) {
        console.warn('Error syncing signal settings:', error);
    }
}

// Load signal settings from backend
async function loadSignalSettingsFromBackend() {
    if (!state.currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}?action=getSignalSettings&userId=${state.currentUser.user_id}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            
            // Merge with current settings (backend takes precedence for shared fields)
            if (data.signalsPerDay) signalState.settings.signalsPerDay = data.signalsPerDay;
            if (data.windowStart) signalState.settings.windowStart = data.windowStart;
            if (data.windowEnd) signalState.settings.windowEnd = data.windowEnd;
            if (data.categoriesEnabled) signalState.settings.categoriesEnabled = data.categoriesEnabled;
            if (data.categoryRatios) signalState.settings.categoryRatios = data.categoryRatios;
            if (data.categoryOrder) signalState.settings.categoryOrder = data.categoryOrder;
            if (data.categoryIndex) signalState.settings.categoryIndex = data.categoryIndex;
            if (typeof data.notificationsEnabled === 'boolean') {
                signalState.settings.notificationsEnabled = data.notificationsEnabled;
            }
            
            saveSignalState();
            console.log('Signal settings loaded from backend');
        }
    } catch (error) {
        console.warn('Error loading signal settings from backend:', error);
    }
}

// Sync single history record to backend
async function syncSignalHistoryRecord(record) {
    if (!state.currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}?action=saveSignalHistory`, {
            method: 'POST',
            body: JSON.stringify({
                recordId: record.id,
                lessonId: record.lessonId,
                userId: state.currentUser.user_id,
                category: record.category,
                status: record.status,
                isFavorite: record.isFavorite,
                rating: record.rating,
                shownAt: record.shownAt,
                completedAt: record.completedAt
            })
        });
        
        const result = await response.json();
        if (!result.success) {
            console.warn('Failed to sync history record:', result.error);
        }
    } catch (error) {
        console.warn('Error syncing history record:', error);
    }
}

// Load signal history from backend
async function loadSignalHistoryFromBackend() {
    if (!state.currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}?action=getSignalHistory&userId=${state.currentUser.user_id}&limit=100`);
        const result = await response.json();
        
        if (result.success && result.data) {
            // Merge with local history
            const backendRecords = result.data;
            const localIds = new Set(signalState.history.map(h => h.id));
            
            // Add any records from backend not in local
            for (const record of backendRecords) {
                if (!localIds.has(record.record_id)) {
                    signalState.history.push({
                        id: record.record_id,
                        lessonId: record.lesson_id,
                        category: record.category,
                        status: record.status,
                        isFavorite: record.is_favorite,
                        rating: record.rating,
                        shownAt: record.shown_at,
                        completedAt: record.completed_at
                    });
                }
            }
            
            // Update local records with backend state (for favorites etc)
            for (const backendRecord of backendRecords) {
                const localRecord = signalState.history.find(h => h.id === backendRecord.record_id);
                if (localRecord) {
                    localRecord.isFavorite = backendRecord.is_favorite;
                    localRecord.rating = backendRecord.rating;
                    localRecord.status = backendRecord.status;
                }
            }
            
            saveSignalState();
            console.log('Signal history loaded from backend:', backendRecords.length, 'records');
        }
    } catch (error) {
        console.warn('Error loading signal history from backend:', error);
    }
}

// Full signal sync (called on init and user change)
async function syncSignalDataWithBackend() {
    await Promise.all([
        loadSignalSettingsFromBackend(),
        loadSignalHistoryFromBackend()
    ]);
    
    // Update UI after sync
    updateSignalView();
    updateSignalSettingsView();
    updateSignalHistory();
    recalculateSignalStats();
}

// ============================================
// SIGNAL NOTIFICATIONS
// ============================================

// Notification state
const signalNotificationState = {
    scheduledTimes: [],      // Scheduled notification times for today
    lastNotificationDate: null,
    snoozeUntil: null,       // If user clicked "Later", snooze for 30 mins
    isShowing: false
};

// Initialize notification scheduling
function initSignalNotifications() {
    // Load state from localStorage
    const saved = localStorage.getItem('signalNotificationState');
    if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(signalNotificationState, parsed);
    }
    
    // Check if we need to schedule for today
    const today = new Date().toDateString();
    if (signalNotificationState.lastNotificationDate !== today) {
        scheduleSignalNotifications();
    }
    
    // Start checking for notifications
    checkForSignalNotification();
    setInterval(checkForSignalNotification, 60000); // Check every minute
}

// Schedule notifications for today based on settings
function scheduleSignalNotifications() {
    const s = signalState.settings;
    
    if (!s.notificationsEnabled || s.categoriesEnabled.length === 0) {
        signalNotificationState.scheduledTimes = [];
        return;
    }
    
    const now = new Date();
    const today = now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Calculate time window
    const startHour = s.windowStart;
    const endHour = s.windowEnd;
    const windowMinutes = (endHour - startHour) * 60;
    
    if (windowMinutes <= 0) {
        signalNotificationState.scheduledTimes = [];
        return;
    }
    
    // Generate random times within window
    const times = [];
    const signalsToSchedule = s.signalsPerDay - signalState.stats.todayCount;
    
    for (let i = 0; i < signalsToSchedule; i++) {
        // Random minute within window
        const randomMinute = Math.floor(Math.random() * windowMinutes);
        const scheduledHour = startHour + Math.floor(randomMinute / 60);
        const scheduledMinute = randomMinute % 60;
        
        // Only schedule if it's in the future
        if (scheduledHour > currentHour || 
            (scheduledHour === currentHour && scheduledMinute > currentMinute)) {
            times.push({
                hour: scheduledHour,
                minute: scheduledMinute,
                triggered: false
            });
        }
    }
    
    // Sort by time
    times.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
    
    signalNotificationState.scheduledTimes = times;
    signalNotificationState.lastNotificationDate = today;
    signalNotificationState.snoozeUntil = null;
    
    saveSignalNotificationState();
    
    console.log('Scheduled signal notifications:', times);
}

// Check if it's time to show a notification
function checkForSignalNotification() {
    const s = signalState.settings;
    
    // Skip if notifications disabled
    if (!s.notificationsEnabled) return;
    
    // Skip if already showing
    if (signalNotificationState.isShowing) return;
    
    // Skip if currently in a signal
    if (signalState.currentSignal) return;
    
    // Check snooze
    if (signalNotificationState.snoozeUntil) {
        if (Date.now() < signalNotificationState.snoozeUntil) {
            return;
        }
        signalNotificationState.snoozeUntil = null;
    }
    
    // Check if any scheduled notification is due
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    for (const scheduled of signalNotificationState.scheduledTimes) {
        if (scheduled.triggered) continue;
        
        if (scheduled.hour < currentHour || 
            (scheduled.hour === currentHour && scheduled.minute <= currentMinute)) {
            // Time to show notification!
            scheduled.triggered = true;
            saveSignalNotificationState();
            showSignalNotification();
            return;
        }
    }
}

// Show the notification banner
function showSignalNotification() {
    const banner = document.getElementById('signalNotificationBanner');
    if (!banner) return;
    
    signalNotificationState.isShowing = true;
    
    // Show banner with animation
    banner.classList.remove('hidden');
    requestAnimationFrame(() => {
        banner.classList.add('visible');
    });
    
    // Also try native notification if permission granted
    if (Notification.permission === 'granted') {
        try {
            const notification = new Notification('Daily Signal', {
                body: 'Time for a moment of insight',
                icon: 'icons/icon.svg',
                tag: 'signal-notification',
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                dismissSignalNotification('now');
                notification.close();
            };
        } catch (e) {
            console.log('Native notification failed:', e);
        }
    }
}

// Hide the notification banner
function hideSignalNotification() {
    const banner = document.getElementById('signalNotificationBanner');
    if (!banner) return;
    
    banner.classList.remove('visible');
    setTimeout(() => {
        banner.classList.add('hidden');
        signalNotificationState.isShowing = false;
    }, 400);
}

// Handle notification action
function dismissSignalNotification(action) {
    hideSignalNotification();
    
    if (action === 'now') {
        // Go to signal and get a random one
        showView('signal');
        setTimeout(() => {
            getRandomSignal();
        }, 300);
    } else if (action === 'later') {
        // Snooze for 30 minutes
        signalNotificationState.snoozeUntil = Date.now() + (30 * 60 * 1000);
        saveSignalNotificationState();
        showToast('Reminder in 30 minutes', 'success');
    }
}

// Save notification state
function saveSignalNotificationState() {
    localStorage.setItem('signalNotificationState', JSON.stringify({
        scheduledTimes: signalNotificationState.scheduledTimes,
        lastNotificationDate: signalNotificationState.lastNotificationDate,
        snoozeUntil: signalNotificationState.snoozeUntil
    }));
}

// Reschedule when settings change or signal completed
function rescheduleSignalNotifications() {
    // Reset for today
    signalNotificationState.lastNotificationDate = null;
    scheduleSignalNotifications();
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
