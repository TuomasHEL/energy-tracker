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
        
        // Initialize push notifications
        loadPushSettings();
        initOneSignal();
        
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
            icon: 'icons/icon.svg',
            badge: 'icons/icon.svg',
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
            
            // Send push notification for session complete
            sendLocalNotification('Session Complete', `${timerData.targetName} - ${durationMinutes} minutes completed 🎉`);
            
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
            case 'shadowSettings':
                renderShadowSettings();
                break;
            case 'pushSettings':
                updatePushUI();
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
            case 'liberation':
                updateLiberationUI();
                break;
            case 'liberationProcess':
                // Handled by startLiberationProcess
                break;
            case 'liberationComplete':
                // Handled by completeLiberationProcess
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
        
        // Always send push notification on completion
        if (pushState.settings.session) {
            sendLocalNotification(
                'Session Complete! 🎉',
                `${state.timer.targetName} - ${durationMinutes} minutes`
            );
        }
        
        // Also show browser notification if app is hidden
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
    { id: 1, left: "ability (to do something)", right: "disability", description: "The spectrum between capability and limitation. Integration recognizes that our abilities and disabilities are contextual - where we're strong in one area, we may be limited in another, and both shape who we are." },
    { id: 2, left: "abnormal", right: "normal", description: "The judgment of what fits social expectations versus what deviates. Integration frees us from the tyranny of normalcy while honoring the value of shared human experience." },
    { id: 3, left: "indifference", right: "sympathy", description: "The range from emotional detachment to feeling with others. Neither cold distance nor overwhelming emotional fusion serves us - integration brings compassionate presence." },
    { id: 4, left: "absolute", right: "relative", description: "The tension between fixed, unchanging truth and context-dependent perspective. Integration allows holding both universal principles and situational wisdom without conflict." },
    { id: 5, left: "abstract", right: "concrete", description: "The movement between conceptual thinking and tangible reality. Integration bridges ideas and their practical manifestation in the world." },
    { id: 6, left: "acceptable", right: "unacceptable", description: "The boundary between what we permit and what we reject. Integration brings discernment without rigid judgment, allowing fluid responsiveness to each situation." },
    { id: 7, left: "acceptance", right: "rejection", description: "The polarity of embracing versus pushing away what arises in experience. Neither pure acceptance nor discernment alone serves us - wholeness includes both." },
    { id: 8, left: "acceptance of someone else's points of view", right: "unacceptance of someone else's points of view", description: "The capacity to hold others' perspectives alongside our own. Integration allows genuine openness without losing our own center or discernment." },
    { id: 9, left: "accessibility", right: "inaccessibility", description: "The spectrum of openness and availability versus being closed or unreachable. Integration knows when to be available and when healthy boundaries serve." },
    { id: 10, left: "active", right: "passive", description: "The dance between doing and allowing, initiating and receiving. Wholeness includes both the power to act and the wisdom to be still." },
    { id: 11, left: "activity", right: "passivity", description: "The polarity of engagement versus withdrawal from life. Integration brings dynamic responsiveness - knowing when to move and when to rest." },
    { id: 12, left: "adequate", right: "inadequate", description: "The felt sense of being enough versus falling short. Integration dissolves the constant measuring and reveals inherent completeness." },
    { id: 13, left: "advancement", right: "retreat", description: "Moving forward versus pulling back. Both serve life - sometimes we grow through pushing ahead, sometimes through strategic withdrawal." },
    { id: 14, left: "all", right: "nothing", description: "The ultimate polarity of totality and void. Integration reveals these as two faces of the same mystery - form and emptiness inseparable." },
    { id: 15, left: "altruism", right: "egoism", description: "Service to others versus service to self. Integration recognizes that healthy self-care enables genuine giving, and true service includes oneself." },
    { id: 16, left: "always", right: "never", description: "The absolutes of time - eternal presence versus permanent absence. Integration frees us from these extremes into the fluid reality of now." },
    { id: 17, left: "analysis", right: "synthesis", description: "Breaking things apart to understand versus bringing things together to create. Both movements of mind serve understanding and creation." },
    { id: 18, left: "anxiety", right: "peace", description: "The agitation of uncertain threat versus settled calm. Integration doesn't eliminate anxiety but allows peace to hold it." },
    { id: 19, left: "anxiety", right: "tranquility", description: "Nervous unease versus serene stillness. Integration brings the capacity to remain tranquil even when anxiety arises." },
    { id: 20, left: "appearance", right: "disappearance", description: "The arising and passing of all phenomena. Integration embraces the transient nature of experience without grasping or aversion." },
    { id: 21, left: "approaching to a goal", right: "moving away from a goal", description: "The dynamic of progress and regression on our path. Integration accepts both as part of the journey, releasing attachment to linear advancement." },
    { id: 22, left: "arrival", right: "departure", description: "Coming and going, beginning and ending. Integration recognizes every arrival contains departure, every ending a new beginning." },
    { id: 23, left: "attack", right: "counter-attack", description: "Aggression and defensive response. Integration transcends the cycle of action and reaction, finding response beyond reactivity." },
    { id: 24, left: "attraction", right: "repulsion", description: "The fundamental forces of drawing toward and pushing away. Integration allows natural movement without compulsive grasping or aversion." },
    { id: 25, left: "attraction to people", right: "rejection of people", description: "The pull toward human connection versus the push toward isolation. Integration honors both our social nature and need for solitude." },
    { id: 26, left: "balance", right: "compulsion", description: "Centered equilibrium versus driven urgency. Integration brings freedom from compulsive patterns while maintaining passionate engagement." },
    { id: 27, left: "beauty", right: "ugliness", description: "Aesthetic attraction and repulsion. Integration perceives the beauty hidden in what appears ugly and the shadow within apparent beauty." },
    { id: 28, left: "beginning", right: "end", description: "The bookends of all cycles and experiences. Integration rests in the eternal present where beginning and end meet." },
    { id: 29, left: "belief", right: "disbelief", description: "Holding something as true versus rejecting it. Integration allows beliefs to be held lightly, open to revision by experience." },
    { id: 30, left: "benevolence", right: "hostility", description: "Goodwill toward others versus ill will. Integration transforms hostility through understanding while maintaining benevolent intent." },
    { id: 31, left: "better", right: "worse", description: "The constant comparison and judgment of relative value. Integration releases the measuring mind while retaining practical discernment." },
    { id: 32, left: "big", right: "small", description: "Magnitude and scale. Integration recognizes the infinite in the infinitesimal, the cosmic in the intimate." },
    { id: 33, left: "body", right: "mind", description: "The apparent split between physical and mental experience. Integration reveals bodymind as one seamless process." },
    { id: 34, left: "body", right: "spirit", description: "Matter and consciousness, flesh and soul. Integration embodies spirit and spiritualizes the body - no separation." },
    { id: 35, left: "boredom", right: "interest", description: "Dull disengagement versus alive curiosity. Integration finds interest even in apparent boredom, discovering richness in simplicity." },
    { id: 36, left: "change", right: "stagnation", description: "Movement and growth versus stuck immobility. Integration embraces change while finding stability within flux." },
    { id: 37, left: "chaos", right: "order", description: "Disorder and structure, randomness and pattern. Integration perceives the hidden order in chaos and creative potential in structure." },
    { id: 38, left: "charisma", right: "dullness", description: "Magnetic presence versus flat invisibility. Integration allows natural radiance without performing or hiding." },
    { id: 39, left: "cheerful", right: "tired", description: "Bright energy versus depleted weariness. Integration honors natural rhythms of vitality and rest." },
    { id: 40, left: "cheerfulness", right: "gloominess", description: "Light mood versus heavy darkness. Integration holds space for both sun and shadow in emotional weather." },
    { id: 41, left: "clean", right: "dirty", description: "Purity and contamination. Integration releases obsessive cleanliness while honoring healthy boundaries." },
    { id: 42, left: "communication", right: "silence", description: "Expression and quiet. Integration knows when words serve and when silence speaks louder." },
    { id: 43, left: "conclusion", right: "beginning", description: "Ending and starting, completion and initiation. Integration sees the seed of the new in every ending." },
    { id: 44, left: "condensation", right: "dissolution", description: "Concentration and dispersal, coming together and falling apart. Integration embraces both gathering and releasing." },
    { id: 45, left: "confidence", right: "doubt", description: "Certainty and uncertainty, trust and questioning. Integration holds confidence lightly, allowing doubt its wisdom." },
    { id: 46, left: "confidence about the abundance of the universe", right: "fear that you will receive nothing", description: "Trust in life's provision versus scarcity panic. Integration opens to receiving while releasing desperate grasping." },
    { id: 47, left: "confirmation", right: "denial", description: "Validation and negation of what is. Integration neither blindly confirms nor reflexively denies." },
    { id: 48, left: "consciousness", right: "body", description: "Awareness and physical form. Integration realizes consciousness embodied, body aware - not two things." },
    { id: 49, left: "consciousness", right: "instincts", description: "Aware choice and automatic response. Integration honors instinctual wisdom while bringing consciousness to reactive patterns." },
    { id: 50, left: "consciousness", right: "materiality", description: "Awareness and matter. Integration perceives matter as crystallized consciousness, consciousness as subtle matter." },
    { id: 51, left: "consciousness", right: "unconsciousness", description: "The dance between aware presence and the vast unknown operating beneath awareness. Integration honors both the light of knowing and the mystery of what remains unseen." },
    { id: 52, left: "contempt", right: "respect", description: "Looking down upon versus honoring. Integration transforms contempt through understanding while maintaining healthy standards." },
    { id: 53, left: "control", right: "freedom", description: "Managing outcomes versus allowing natural flow. Integration brings the wisdom to know when to steer and when to surrender." },
    { id: 54, left: "correct", right: "incorrect", description: "Right and wrong, accurate and mistaken. Integration releases rigid rightness while maintaining commitment to truth." },
    { id: 55, left: "creation", right: "destruction", description: "Building up and breaking down. Integration recognizes destruction as necessary for new creation, and creation as eventual dissolution." },
    { id: 56, left: "danger", right: "safety", description: "Threat and security. Integration develops accurate threat assessment while releasing paranoid vigilance or naive denial." },
    { id: 57, left: "darkness", right: "light", description: "The fundamental polarity of shadow and illumination. Integration embraces the dark as the womb of light, light as revealer of darkness." },
    { id: 58, left: "day", right: "night", description: "Activity and rest, visibility and mystery. Integration honors the rhythm of light and dark in life's cycles." },
    { id: 59, left: "decent", right: "indecent", description: "Proper and improper, respectable and shameful. Integration frees us from excessive propriety while honoring genuine ethics." },
    { id: 60, left: "dependence", right: "independence", description: "Relying on others versus self-sufficiency. Integration brings healthy interdependence - autonomous yet connected." },
    { id: 61, left: "depth", right: "surface", description: "Profound and superficial, hidden and apparent. Integration values both the depths and the surface of experience." },
    { id: 62, left: "difference", right: "similarity", description: "What distinguishes and what unites. Integration celebrates uniqueness while recognizing common humanity." },
    { id: 63, left: "difference", right: "agreement", description: "Divergence and convergence of views. Integration holds difference without conflict, agreement without conformity." },
    { id: 64, left: "dissatisfaction", right: "satisfaction", description: "Discontent and fulfillment. Integration allows contentment while remaining open to growth and change." },
    { id: 65, left: "distrust of people", right: "trust of people", description: "Suspicion and faith in others. Integration brings discerning trust - open-hearted yet appropriately cautious." },
    { id: 66, left: "divine", right: "ordinary", description: "Sacred and mundane. Integration reveals the divine in the ordinary, the ordinary as expression of the divine." },
    { id: 67, left: "dominance", right: "submission", description: "Power over and yielding to. Integration brings appropriate assertion and graceful surrender, as situations require." },
    { id: 68, left: "dork", right: "charmer", description: "Social awkwardness and smooth charisma. Integration allows authentic presence beyond performance or hiding." },
    { id: 69, left: "dream", right: "reality", description: "Imagination and actuality. Integration honors both the visionary dream and practical reality, bridging them into manifestation." },
    { id: 70, left: "dynamics", right: "statics", description: "Movement and stillness, change and stability. Integration finds the still point within movement, the potential for change in stillness." },
    { id: 71, left: "earthly", right: "divine", description: "Human and transcendent, material and spiritual. Integration grounds the divine in earth and elevates the earthly to sacred." },
    { id: 72, left: "effort", right: "apathy", description: "Striving and indifference. Integration brings engaged ease - caring deeply while holding outcomes lightly." },
    { id: 73, left: "effort", right: "rest", description: "Work and relaxation. Integration honors both exertion and recovery as essential rhythms of sustainable action." },
    { id: 74, left: "emotions", right: "lack of emotions", description: "Feeling and numbness. Integration welcomes emotional aliveness while not being overwhelmed by it." },
    { id: 75, left: "emotions", right: "mind", description: "Feeling and thinking. Integration brings thinking that includes feeling, feeling informed by thought." },
    { id: 76, left: "emotions", right: "reason", description: "Heart and head. Integration allows emotion and reason to inform each other rather than compete." },
    { id: 77, left: "emotions", right: "void", description: "Feeling states and empty awareness. Integration rests as the spacious void in which all emotions arise and pass." },
    { id: 78, left: "energetic", right: "inactive", description: "Vital and dormant. Integration respects natural energy cycles without forcing or collapsing." },
    { id: 79, left: "enlightened master", right: "moron", description: "Spiritual wisdom and foolishness. Integration releases spiritual hierarchy, finding wisdom in simplicity and humility in attainment." },
    { id: 80, left: "enlightenment", right: "ignorance", description: "Awakening and delusion. Integration recognizes enlightenment includes everything - even ignorance is embraced." },
    { id: 81, left: "entering experience", right: "avoiding experience", description: "Moving toward and away from what life presents. Integration brings courage to engage while honoring natural self-protection." },
    { id: 82, left: "enthusiasm", right: "apathy", description: "Excited engagement and dull indifference. Integration maintains vital interest without manic intensity." },
    { id: 83, left: "eternity", right: "moment", description: "Timeless and temporal. Integration touches the eternal within each passing moment." },
    { id: 84, left: "everybody", right: "nobody", description: "Being someone important and being invisible. Integration frees us from both inflated self-importance and deflated insignificance." },
    { id: 85, left: "everything depends on me", right: "nothing depends on me", description: "Total responsibility and complete powerlessness. Integration holds appropriate responsibility while releasing grandiosity and helplessness." },
    { id: 86, left: "existence", right: "creation", description: "Being and becoming, what is and what is made. Integration rests in existence while participating in creation." },
    { id: 87, left: "existence", right: "non-existence", description: "Being and nothingness. Integration touches the ground of being from which both existence and non-existence emerge." },
    { id: 88, left: "expansion", right: "compression", description: "Growing larger and contracting smaller. Integration breathes with life's natural expansion and contraction." },
    { id: 89, left: "extrovert", right: "introvert", description: "Outward and inward orientation. Integration accesses both external engagement and internal reflection as needed." },
    { id: 90, left: "faith", right: "knowledge", description: "Trust beyond evidence and verified understanding. Integration holds faith open to knowledge, knowledge humble before mystery." },
    { id: 91, left: "far", right: "near", description: "Distance and proximity. Integration collapses the apparent distance between self and other, here and there." },
    { id: 92, left: "fear", right: "courage", description: "The paralysis of threat and the power to act despite it. Integration includes fear within courage rather than eliminating it." },
    { id: 93, left: "fear", right: "peace", description: "Anxious alarm and serene calm. Integration allows peace to hold fear, fear to resolve into peace." },
    { id: 94, left: "fire", right: "water", description: "Elemental passion and emotion, transformation and flow. Integration balances fiery intensity with watery receptivity." },
    { id: 95, left: "folding", right: "unfolding", description: "Collapsing inward and expanding outward. Integration participates in life's breathing rhythm of involution and evolution." },
    { id: 96, left: "forever", right: "temporarily", description: "Permanent and impermanent. Integration releases grasping at permanence while fully inhabiting the temporary." },
    { id: 97, left: "form", right: "formlessness", description: "Structure and shapelessness. Integration perceives form arising from formlessness, formlessness as the nature of form." },
    { id: 98, left: "formation", right: "disappearance", description: "Coming into being and fading away. Integration witnesses the arising and passing without clinging or pushing." },
    { id: 99, left: "forward", right: "backward", description: "Progress and regression. Integration releases linear thinking, finding value in both directions of movement." },
    { id: 100, left: "fragrant", right: "malodorous", description: "Pleasant and unpleasant smells. Integration releases judgmental aversion while maintaining practical preferences." },
    { id: 101, left: "freedom", right: "depression", description: "Liberation and heavy stuckness. Integration finds movement possible even in depression, rest natural within freedom." },
    { id: 102, left: "freedom", right: "fate/karma", description: "Free will and destiny. Integration holds both - we choose within conditions we did not choose." },
    { id: 103, left: "freedom", right: "responsibility", description: "Liberty and accountability. Integration recognizes freedom and responsibility as inseparable - true freedom includes caring for consequences." },
    { id: 104, left: "freedom", right: "slavery", description: "Liberation and bondage. Integration frees us from inner slavery while engaging skillfully with outer constraints." },
    { id: 105, left: "freedom", right: "submission", description: "Autonomy and yielding. Integration knows when to assert independence and when to surrender." },
    { id: 106, left: "freedom", right: "lack of freedom", description: "Open possibility and constraint. Integration finds inner freedom regardless of outer limitations." },
    { id: 107, left: "fresh", right: "sluggish", description: "Vital alertness and heavy dullness. Integration respects energy rhythms without forcing or indulging." },
    { id: 108, left: "front", right: "back", description: "What we show and what we hide. Integration brings congruence between our public face and private reality." },
    { id: 109, left: "full", right: "empty", description: "Completeness and vacancy. Integration realizes fullness and emptiness as perspectives on the same reality." },
    { id: 110, left: "fullness", right: "emptiness", description: "Abundance and void. Integration discovers emptiness as pregnant with potential, fullness as including space." },
    { id: 111, left: "fundamentality", right: "shakiness", description: "Solid ground and unstable foundation. Integration finds stability in groundlessness, flexibility in structure." },
    { id: 112, left: "future", right: "past", description: "What is coming and what has been. Integration lives fully in the present where future and past meet." },
    { id: 113, left: "generous", right: "mean", description: "Giving freely and withholding stingily. Integration brings natural generosity without depleting or enabling." },
    { id: 114, left: "genius", right: "madness", description: "Brilliant insight and deranged confusion. Integration honors creative genius while remaining grounded in sanity." },
    { id: 115, left: "gently sloping", right: "steep", description: "Gradual and sudden change. Integration accepts both gentle transitions and steep transformations on the path." },
    { id: 116, left: "god", right: "devil", description: "Divine good and absolute evil. Integration transcends this dualism while maintaining ethical discernment." },
    { id: 117, left: "good", right: "bad", description: "The fundamental moral judgment. Integration releases rigid good/bad thinking while retaining ethical sensitivity." },
    { id: 118, left: "good", right: "evil", description: "Moral virtue and wickedness. Integration confronts evil with good while understanding the conditions that create both." },
    { id: 119, left: "gratitude", right: "ingratitude", description: "Thankfulness and taking for granted. Integration cultivates grateful appreciation while releasing guilt about natural fluctuations." },
    { id: 120, left: "greatness", right: "smallness", description: "Magnitude of significance. Integration releases comparison, finding greatness in small things and humility in large." },
    { id: 121, left: "happiness", right: "grief", description: "Joy and sorrow. Integration allows both their full expression, discovering they can coexist." },
    { id: 122, left: "happiness", right: "sadness", description: "Uplift and downcast. Integration makes room for the full emotional spectrum without preference." },
    { id: 123, left: "hardness", right: "fragility", description: "Tough resilience and delicate vulnerability. Integration brings strength that includes tenderness, openness with backbone." },
    { id: 124, left: "heavy", right: "light", description: "Weight and weightlessness. Integration carries what is heavy with lightness, brings substance to the light." },
    { id: 125, left: "hell", right: "heaven", description: "States of suffering and bliss. Integration recognizes both as mind states available here and now." },
    { id: 126, left: "here", right: "now", description: "Spatial and temporal presence. Integration unifies here and now into complete present-moment awareness." },
    { id: 127, left: "here", right: "there", description: "This location and that location. Integration dissolves the imaginary boundary between here and there." },
    { id: 128, left: "high", right: "low", description: "Elevated and depressed, superior and inferior. Integration releases the vertical hierarchy of judgment." },
    { id: 129, left: "honest man", right: "swindler", description: "Integrity and deception. Integration commits to honesty while understanding the fears that drive dishonesty." },
    { id: 130, left: "hopelessness", right: "hope", description: "Despair and expectation. Integration finds peace beyond both hopelessness and hope, resting in what is." },
    { id: 131, left: "horizontal", right: "vertical", description: "Flat extension and upright elevation. Integration moves freely in all dimensions of experience." },
    { id: 132, left: "hot", right: "cold", description: "Temperature extremes. Integration finds equanimity in both heat and cold, passion and coolness." },
    { id: 133, left: "hunger", right: "satiety", description: "Want and satisfaction. Integration relates wisely to desire - neither starving nor stuffing." },
    { id: 134, left: "I am bad", right: "I am good", description: "Negative and positive self-judgment. Integration releases both self-condemnation and self-inflation for simple presence." },
    { id: 135, left: "I am not good at anything", right: "I am good at everything", description: "Total incompetence and total competence. Integration releases these extremes for realistic self-assessment." },
    { id: 136, left: "I am the source", right: "I am not the source", description: "The paradox of personal agency and universal unfolding. You are both the creative origin of your experience and an expression of something far greater." },
    { id: 137, left: "I am unique", right: "I am like everybody else", description: "Special and ordinary. Integration honors both your irreplaceable uniqueness and common humanity." },
    { id: 138, left: "I exist", right: "I don't exist", description: "The fundamental question of being. Integration rests prior to the question of existence." },
    { id: 139, left: "I must", right: "I want", description: "Obligation and desire. Integration aligns duty and desire, finding want within must." },
    { id: 140, left: "I must be right", right: "I am not right", description: "The need to be correct and the fear of being wrong. Integration releases the grip of rightness." },
    { id: 141, left: "I want to be aware", right: "I don't want to be aware", description: "The desire for consciousness and the pull of unconsciousness. Integration allows awareness of both impulses." },
    { id: 142, left: "I want to communicate with people", right: "I don't want to communicate with people", description: "Social engagement and withdrawal. Integration honors both connection and solitude needs." },
    { id: 143, left: "I-don't-care-ness", right: "enthusiasm", description: "Indifference and passionate engagement. Integration brings caring without attachment, ease without apathy." },
    { id: 144, left: "ignorant people", right: "wise people", description: "The judgment of stupidity and intelligence. Integration finds wisdom in simplicity, ignorance in cleverness." },
    { id: 145, left: "illusion", right: "reality", description: "The false and the true. Integration questions the boundary, finding reality in illusion and illusion in assumed reality." },
    { id: 146, left: "indifference", right: "involvement", description: "Detachment and engagement. Integration brings passionate equanimity - fully involved yet not attached." },
    { id: 147, left: "infinitely small", right: "infinitely large", description: "The cosmic and the microscopic. Integration perceives the infinite in both directions of scale." },
    { id: 148, left: "initiative", right: "inactive", description: "Starting action and remaining still. Integration brings timely initiative and patient waiting." },
    { id: 149, left: "inner world", right: "outer world", description: "Subjective experience and objective reality. Integration realizes inner and outer as two sides of one experience." },
    { id: 150, left: "inside", right: "outside", description: "Interior and exterior. Integration dissolves the membrane between self and world." },
    { id: 151, left: "intellect", right: "emotion", description: "Thinking and feeling. Integration brings emotional intelligence and intelligent emotion." },
    { id: 152, left: "intellect", right: "instincts", description: "Rational thought and primal knowing. Integration honors gut wisdom alongside analytical mind." },
    { id: 153, left: "interest", right: "boredom", description: "Engaged curiosity and dull disconnection. Integration finds interest even in boredom itself." },
    { id: 154, left: "interest", right: "indifference", description: "Caring attention and unconcerned detachment. Integration brings interested equanimity." },
    { id: 155, left: "intuition", right: "consciousness", description: "Direct knowing and reflective awareness. Integration allows intuition to inform consciousness, consciousness to refine intuition." },
    { id: 156, left: "irritation", right: "acceptance", description: "Frustrated resistance and allowing. Integration accepts irritation while moving toward ease." },
    { id: 157, left: "joy", right: "sorrow", description: "The poles of emotional experience. Integration allows both their natural arising and passing." },
    { id: 158, left: "joyous", right: "angry", description: "Delight and rage. Integration includes the full emotional spectrum without suppression." },
    { id: 159, left: "knowledge", right: "action", description: "Understanding and doing. Integration bridges knowing and acting - wisdom embodied in deed." },
    { id: 160, left: "knowledge", right: "ignorance", description: "Knowing and not knowing. Integration holds knowledge humbly, respects the vast unknown." },
    { id: 161, left: "lack of self-confidence", right: "self-confidence", description: "Self-doubt and self-trust. Integration brings realistic confidence without arrogance or collapse." },
    { id: 162, left: "laziness", right: "willingness to act", description: "Resistance to effort and ready engagement. Integration distinguishes wise rest from avoidant laziness." },
    { id: 163, left: "lechery", right: "chastity", description: "Sexual excess and restraint. Integration brings healthy relationship with desire - neither indulgent nor repressed." },
    { id: 164, left: "left", right: "right", description: "Directional opposition. Integration moves beyond lateral preference to centered presence." },
    { id: 165, left: "left hemisphere", right: "right hemisphere", description: "Analytical and holistic brain function. Integration brings whole-brain awareness - detail and context, logic and intuition." },
    { id: 166, left: "life", right: "death", description: "The great polarity of existence. Integration lives fully by embracing mortality, finds life within death." },
    { id: 167, left: "light", right: "darkness", description: "Illumination and shadow. Integration needs both - light to see, darkness to rest and renew." },
    { id: 168, left: "lightness", right: "heaviness", description: "Buoyancy and weight. Integration carries burdens lightly, brings gravity to lightness." },
    { id: 169, left: "limited consciousness", right: "unlimited consciousness", description: "Bounded and infinite awareness. Integration finds the unlimited within apparent limits." },
    { id: 170, left: "limitedness", right: "limitlessness", description: "Constraint and infinite possibility. Integration accepts limits while touching limitless nature." },
    { id: 171, left: "literacy", right: "illiteracy", description: "The capacity to read and its absence. Integration values both book knowledge and direct experience." },
    { id: 172, left: "localization", right: "non-localization", description: "Being somewhere specific and everywhere/nowhere. Integration is fully here while not confined to here." },
    { id: 173, left: "logic", right: "creativity", description: "Linear reasoning and lateral imagination. Integration brings creative logic and logical creativity." },
    { id: 174, left: "logic", right: "emotions", description: "Rational thought and feeling. Integration allows thinking and feeling to inform each other." },
    { id: 175, left: "logical thinking", right: "creative thinking", description: "Step-by-step reasoning and imaginative leaps. Integration accesses both modes as needed." },
    { id: 176, left: "long", right: "short", description: "Duration and brevity. Integration releases time anxiety, fully present to each moment's length." },
    { id: 177, left: "love", right: "aggressiveness", description: "Tender care and forceful assertion. Integration loves fiercely, asserts lovingly." },
    { id: 178, left: "love", right: "fear", description: "The two fundamental orientations. Integration chooses love while acknowledging fear." },
    { id: 179, left: "love", right: "freedom", description: "Connection and independence. Integration finds freedom through love, love that liberates." },
    { id: 180, left: "love", right: "hatred", description: "The opposites of relational feeling. Integration transforms hatred through understanding, deepens love through shadow work." },
    { id: 181, left: "love", right: "loneliness", description: "Connection and isolation. Integration finds inner companionship, and love that includes solitude." },
    { id: 182, left: "love", right: "pain", description: "Heart opening and heart hurting. Integration loves despite pain, finds love within pain." },
    { id: 183, left: "love", right: "power", description: "Often seen as opposites - soft versus strong. Integration reveals that true power flows from love, and authentic love requires the power to act on it." },
    { id: 184, left: "love", right: "refusal", description: "Acceptance and rejection in relationship. Integration says yes and no from love." },
    { id: 185, left: "love of people", right: "hatred of people", description: "Embrace and rejection of humanity. Integration loves people while seeing clearly." },
    { id: 186, left: "luck", right: "misfortune", description: "Good and bad fortune. Integration releases identification with lucky or unlucky self-image." },
    { id: 187, left: "lucky", right: "unlucky", description: "Blessed and cursed by circumstance. Integration appreciates grace while not depending on luck." },
    { id: 188, left: "male", right: "female", description: "Masculine and feminine principles. Integration embraces both within, regardless of gender." },
    { id: 189, left: "man", right: "woman", description: "Gender identities. Integration honors distinction while recognizing shared humanity." },
    { id: 190, left: "material", right: "emptiness", description: "Substance and void. Integration perceives matter as patterned emptiness, emptiness as potential material." },
    { id: 191, left: "material", right: "immaterial", description: "Physical and non-physical. Integration moves fluidly between tangible and intangible realms." },
    { id: 192, left: "material", right: "spiritual", description: "Matter and spirit. Integration spiritualizes matter, materializes spirit - no gap." },
    { id: 193, left: "material world", right: "spiritual world", description: "Physical and metaphysical realms. Integration lives in both simultaneously." },
    { id: 194, left: "material world", right: "subtle world", description: "Gross and fine dimensions of existence. Integration perceives subtle energies within physical reality." },
    { id: 195, left: "matter", right: "energy", description: "Solid substance and dynamic force. Integration sees matter as condensed energy, energy as freed matter." },
    { id: 196, left: "matter", right: "void", description: "Something and nothing. Integration perceives form and emptiness as inseparable." },
    { id: 197, left: "me", right: "abundance of the universe", description: "Small self and cosmic wealth. Integration opens personal boundaries to universal flow." },
    { id: 198, left: "me", right: "Buddha", description: "The apparent gap between your current sense of self and fully awakened nature. This polarity dissolves when you recognize what you seek is what is looking." },
    { id: 199, left: "me", right: "complete enlightenment", description: "Current state and full awakening. Integration realizes enlightenment is not elsewhere or later." },
    { id: 200, left: "me", right: "eternity", description: "Mortal self and timeless being. Integration touches the eternal within temporal existence." },
    { id: 201, left: "me", right: "everyone", description: "Individual and collective identity. Integration holds both unique selfhood and shared being." },
    { id: 202, left: "me", right: "extraterrestrial intelligence", description: "Human and cosmic consciousness. Integration opens to intelligence beyond human form." },
    { id: 203, left: "me", right: "galaxy", description: "Personal and cosmic scale. Integration holds both intimate self and vast universe." },
    { id: 204, left: "me", right: "intuition", description: "Ego and inner knowing. Integration allows intuition to guide the personal self." },
    { id: 205, left: "me", right: "life", description: "Individual and universal life force. Integration realizes personal life as expression of Life." },
    { id: 206, left: "me", right: "movement", description: "Static self and dynamic process. Integration realizes self as movement, movement as self." },
    { id: 207, left: "me", right: "nothing", description: "Somebodyness and nobodyness. Integration holds being and non-being simultaneously." },
    { id: 208, left: "me", right: "others", description: "Self and other. Integration dissolves the hard boundary while maintaining functional distinction." },
    { id: 209, left: "me", right: "people", description: "Individual and collective humanity. Integration belongs while remaining unique." },
    { id: 210, left: "me", right: "someone else", description: "Self and another person. Integration sees self in other, other in self." },
    { id: 211, left: "me", right: "subtle worlds", description: "Physical self and subtle dimensions. Integration opens perception to non-physical reality." },
    { id: 212, left: "me", right: "the whole world", description: "Part and whole. Integration realizes the whole world lives within and you live within it." },
    { id: 213, left: "me", right: "unity", description: "Separate self and oneness. Integration maintains functional individuality within unity." },
    { id: 214, left: "me", right: "universe", description: "Personal and cosmic. Integration recognizes self as the universe experiencing itself." },
    { id: 215, left: "me", right: "void", description: "Somebody and emptiness. Integration rests as aware emptiness appearing as somebody." },
    { id: 216, left: "me", right: "world", description: "Subject and object. Integration realizes self and world arising together, inseparable." },
    { id: 217, left: "merciful", right: "merciless", description: "Compassionate and harsh. Integration brings mercy without enabling, firmness without cruelty." },
    { id: 218, left: "minus", right: "plus", description: "Negative and positive. Integration holds both poles of experience without preference." },
    { id: 219, left: "misfortune", right: "good fortune", description: "Bad and good luck. Integration releases the story of fortunate or unfortunate self." },
    { id: 220, left: "monotony", right: "diversity", description: "Sameness and variety. Integration finds richness in simplicity, unity in diversity." },
    { id: 221, left: "motion", right: "immobility", description: "Movement and stillness. Integration finds stillness in motion, potential movement in stillness." },
    { id: 222, left: "motion", right: "rest", description: "Activity and pause. Integration honors the rhythm of effort and recovery." },
    { id: 223, left: "motion", right: "stopping", description: "Continuation and cessation. Integration knows when to keep going and when to stop." },
    { id: 224, left: "moving", right: "staying", description: "Going and remaining. Integration chooses movement or stability as appropriate." },
    { id: 225, left: "multitude", right: "uniqueness", description: "Many and one. Integration sees the unique in multitude, multitude expressing uniqueness." },
    { id: 226, left: "must do", right: "don't want to do", description: "Obligation and resistance. Integration finds alignment between duty and desire." },
    { id: 227, left: "must", right: "must not", description: "Compulsion and prohibition. Integration moves beyond rigid rules to wise responsiveness." },
    { id: 228, left: "my", right: "somebody else's", description: "Mine and not mine. Integration loosens possessive grip while honoring responsibility." },
    { id: 229, left: "my father", right: "my mother", description: "Paternal and maternal influences. Integration honors both parental lineages and energies." },
    { id: 230, left: "my wishes", right: "somebody else's wishes", description: "Personal and others' desires. Integration balances self-care and consideration." },
    { id: 231, left: "mysticism", right: "narrow-mindedness", description: "Expanded and contracted consciousness. Integration opens to mystery while remaining grounded." },
    { id: 232, left: "nature", right: "civilization", description: "Wild and cultivated. Integration honors both natural wisdom and human development." },
    { id: 233, left: "near", right: "remote", description: "Close and far. Integration collapses psychological distance while respecting physical space." },
    { id: 234, left: "negative", right: "positive", description: "The fundamental valence. Integration holds both without automatic preference." },
    { id: 235, left: "negative emotions", right: "positive emotions", description: "Painful and pleasant feelings. Integration allows all emotions equal right to exist and pass." },
    { id: 236, left: "noble", right: "ignoble", description: "Elevated and base. Integration acts nobly while accepting human weakness." },
    { id: 237, left: "nobleness", right: "baseness", description: "High and low character. Integration aspires to nobility while embracing shadow." },
    { id: 238, left: "noise/sounds", right: "silence", description: "Sound and quiet. Integration finds silence within sound, sound within silence." },
    { id: 239, left: "now", right: "later", description: "Present and future. Integration acts appropriately now while planning for later." },
    { id: 240, left: "observer", right: "observed", description: "Subject and object of awareness. Integration realizes observer and observed arise together." },
    { id: 241, left: "old", right: "young", description: "Age and youth. Integration honors both wisdom of age and vitality of youth." },
    { id: 242, left: "optimism", right: "pessimism", description: "Positive and negative outlook. Integration sees clearly without rose-colored or dark glasses." },
    { id: 243, left: "others are right", right: "I am right", description: "Deferring and insisting. Integration holds views lightly while speaking truth." },
    { id: 244, left: "panic", right: "tranquillity", description: "Overwhelming alarm and deep peace. Integration finds the still point even in panic." },
    { id: 245, left: "part", right: "whole", description: "Fragment and totality. Integration perceives the whole in each part, parts composing whole." },
    { id: 246, left: "passion", right: "spirituality", description: "Intense desire and transcendent aspiration. Integration brings passionate spirituality, spiritual passion." },
    { id: 247, left: "past", right: "future", description: "Memory and anticipation. Integration lives fully present, informed by past, open to future." },
    { id: 248, left: "path", right: "goal", description: "Journey and destination. Integration realizes the path is the goal, each step complete." },
    { id: 249, left: "peace", right: "aggression", description: "Harmony and conflict. Integration maintains inner peace while confronting what must be confronted." },
    { id: 250, left: "peace", right: "disorders", description: "Calm and chaos. Integration finds peace within disorder, order within peace." },
    { id: 251, left: "peace", right: "fear", description: "Serenity and anxiety. Integration allows fear within peace rather than opposing them." },
    { id: 252, left: "peace", right: "power", description: "Gentleness and force. Integration brings peaceful power and powerful peace." },
    { id: 253, left: "people", right: "animals", description: "Human and animal nature. Integration honors our animal nature within human consciousness." },
    { id: 254, left: "perfection", right: "imperfection", description: "Flawless and flawed. Integration sees the perfection of imperfection, accepts human fallibility." },
    { id: 255, left: "permanence", right: "transience", description: "Lasting and passing. Integration touches the permanent within the transient." },
    { id: 256, left: "permanent", right: "temporary", description: "Enduring and fleeting. Integration releases grasping at permanence while fully embracing the temporary." },
    { id: 257, left: "permission", right: "prohibition", description: "Allowed and forbidden. Integration moves beyond external rules to internal wisdom." },
    { id: 258, left: "point", right: "space", description: "Located and extended. Integration is both precisely here and everywhere." },
    { id: 259, left: "point", right: "three-dimensional object", description: "Dimensionless and dimensional. Integration perceives the point in the object, the object in the point." },
    { id: 260, left: "poor", right: "wealthy", description: "Material lack and abundance. Integration finds richness beyond material circumstance." },
    { id: 261, left: "positive", right: "negative", description: "Affirming and denying. Integration holds both without preference." },
    { id: 262, left: "positive element", right: "negative element", description: "Contributing and detracting factors. Integration sees value in both." },
    { id: 263, left: "positive polarity", right: "negative polarity", description: "Opposite charges. Integration transcends polarity while functioning within it." },
    { id: 264, left: "possible", right: "impossible", description: "Can be and cannot be. Integration opens to possibility while accepting limits." },
    { id: 265, left: "poverty", right: "wealth", description: "Scarcity and abundance. Integration relates wisely to resources regardless of quantity." },
    { id: 266, left: "power", right: "helplessness", description: "Capacity and incapacity. Integration holds realistic power assessment without inflation or deflation." },
    { id: 267, left: "power", right: "impotence", description: "Effective and ineffective. Integration acts where possible, accepts where not." },
    { id: 268, left: "power of the night", right: "power of the day", description: "Lunar and solar energy. Integration honors both dark feminine and bright masculine power." },
    { id: 269, left: "presence of thoughts", right: "absence of thoughts", description: "Thinking and stillness of mind. Integration rests as awareness whether thoughts arise or not." },
    { id: 270, left: "present", right: "future", description: "Now and not yet. Integration acts in the present informed by future vision." },
    { id: 271, left: "present", right: "past", description: "Now and no longer. Integration lives now while honoring what has been." },
    { id: 272, left: "present moment", right: "eternity", description: "This instant and timelessness. Integration touches the eternal within each moment." },
    { id: 273, left: "progress", right: "degradation", description: "Improvement and decline. Integration releases attachment to progress while moving forward." },
    { id: 274, left: "proof", right: "disproof", description: "Evidence for and against. Integration holds beliefs open to revision." },
    { id: 275, left: "prudent", right: "imprudent", description: "Wise caution and recklessness. Integration brings discernment without fearful paralysis." },
    { id: 276, left: "quickly", right: "slowly", description: "Speed and deliberation. Integration moves at appropriate pace for each situation." },
    { id: 277, left: "reason", right: "consequence", description: "Cause and effect. Integration understands causality while acting freely." },
    { id: 278, left: "reasonable", right: "hasty", description: "Thoughtful and impulsive. Integration brings timely responsiveness, neither too slow nor too fast." },
    { id: 279, left: "relationship", right: "loneliness", description: "Connection and aloneness. Integration finds solitude within relationship, connection within aloneness." },
    { id: 280, left: "relaxation", right: "stress", description: "Ease and tension. Integration allows relaxation even under stress." },
    { id: 281, left: "resoluteness to do something", right: "postponement", description: "Commitment to act and delay. Integration knows when to act now and when to wait." },
    { id: 282, left: "responsibility", right: "irresponsibility", description: "Accountability and carelessness. Integration takes appropriate responsibility without taking others'." },
    { id: 283, left: "right", right: "wrong", description: "Correct and incorrect. Integration holds rightness lightly while committed to truth." },
    { id: 284, left: "saint", right: "sinner", description: "Holy and fallen. Integration embraces the saint and sinner within, judging neither." },
    { id: 285, left: "salted", right: "unsalted", description: "Flavored and plain. Integration appreciates both seasoned and simple." },
    { id: 286, left: "sane", right: "insane", description: "Mental health and illness. Integration maintains sanity while honoring non-ordinary states." },
    { id: 287, left: "satisfaction", right: "displeasure", description: "Content and discontent. Integration finds satisfaction that includes healthy discontent." },
    { id: 288, left: "scream", right: "silence", description: "Loud expression and quiet. Integration knows when to shout and when to remain silent." },
    { id: 289, left: "security", right: "insecurity", description: "Safety and threat. Integration builds inner security that holds outer insecurity." },
    { id: 290, left: "sensible", right: "thoughtless", description: "Reasonable and careless. Integration brings mindful sensitivity." },
    { id: 291, left: "sentimentalism", right: "heartlessness", description: "Excessive emotion and cold indifference. Integration feels deeply without drowning or numbing." },
    { id: 292, left: "separateness", right: "integrity", description: "Division and wholeness. Integration maintains individuality within connected wholeness." },
    { id: 293, left: "seriousness", right: "light-mindedness", description: "Gravity and levity. Integration brings serious engagement with lightness of spirit." },
    { id: 294, left: "severity", right: "mildness", description: "Harsh and gentle. Integration is firm when needed, gentle when possible." },
    { id: 295, left: "shame of failure", right: "delight of victory", description: "Humiliation and pride. Integration releases identification with success or failure." },
    { id: 296, left: "shining", right: "dim", description: "Bright and dull. Integration allows natural radiance without forcing or hiding." },
    { id: 297, left: "short life", right: "eternity", description: "Brief span and endless time. Integration lives fully in limited time while touching the eternal." },
    { id: 298, left: "should save one's face", right: "shouldn't save one's face", description: "Protecting and exposing image. Integration releases concern with appearance while maintaining dignity." },
    { id: 299, left: "silently", right: "loudly", description: "Quiet and noisy expression. Integration speaks at appropriate volume for each situation." },
    { id: 300, left: "silly", right: "enlightened", description: "Foolish and wise. Integration finds wisdom in foolishness, humility in enlightenment." },
    { id: 301, left: "sky", right: "earth", description: "Heaven and ground. Integration grounds heavenly vision, elevates earthly life." },
    { id: 302, left: "small", right: "big", description: "Little and large. Integration finds significance regardless of scale." },
    { id: 303, left: "something", right: "nothing", description: "Existence and void. Integration rests in the ground from which both arise." },
    { id: 304, left: "something has to be done", right: "nothing has to be done", description: "Urgency and completion. Integration acts when needed, rests in completeness." },
    { id: 305, left: "sorrow", right: "joy", description: "Grief and happiness. Integration allows both their full expression and passing." },
    { id: 306, left: "stability", right: "changes", description: "Steadiness and flux. Integration finds stability within change, change within stability." },
    { id: 307, left: "stability", right: "shock", description: "Equilibrium and disruption. Integration maintains center through shock." },
    { id: 308, left: "standing", right: "lying", description: "Upright and horizontal. Integration embodies appropriate posture for each situation." },
    { id: 309, left: "straight", right: "curved", description: "Direct and winding. Integration moves both directly and with graceful curves." },
    { id: 310, left: "strength", right: "weakness", description: "Power and vulnerability. Integration draws strength from accepting weakness." },
    { id: 311, left: "structured", right: "unstructured", description: "Organized and free-form. Integration brings appropriate structure without rigidity." },
    { id: 312, left: "subject", right: "object", description: "Knower and known. Integration realizes their inseparability." },
    { id: 313, left: "subtle humor", right: "vulgar humor", description: "Refined and crude comedy. Integration appreciates humor across the spectrum." },
    { id: 314, left: "success", right: "defeat", description: "Winning and losing. Integration releases identification with outcomes." },
    { id: 315, left: "success", right: "disappointment", description: "Achievement and letdown. Integration holds success lightly, learns from disappointment." },
    { id: 316, left: "successful", right: "unsuccessful", description: "Achieving and failing. Integration defines success beyond conventional measures." },
    { id: 317, left: "sun", right: "moon", description: "Solar and lunar energies. Integration honors both illuminating and reflective power." },
    { id: 318, left: "sweet", right: "not sweet", description: "Pleasant taste and its absence. Integration appreciates the full spectrum of experience." },
    { id: 319, left: "symmetric", right: "asymmetric", description: "Balance and imbalance. Integration finds harmony in both symmetry and asymmetry." },
    { id: 320, left: "sympathy", right: "antipathy", description: "Attraction and aversion to others. Integration relates openly without compulsive like or dislike." },
    { id: 321, left: "talent", right: "lack of talent", description: "Gift and limitation. Integration develops talents while accepting limits." },
    { id: 322, left: "teacher", right: "pupil", description: "Instructor and student. Integration is always both teaching and learning." },
    { id: 323, left: "teaching", right: "knowledge", description: "Transmitting and possessing understanding. Integration teaches from genuine knowing." },
    { id: 324, left: "the one who knows", right: "the thing which is known", description: "Subject and object of knowledge. Integration realizes knowing as relationship, not separation." },
    { id: 325, left: "the world is bad", right: "the world is good", description: "Negative and positive worldview. Integration sees clearly without rose-colored or dark glasses." },
    { id: 326, left: "the world is dangerous", right: "the world is safe", description: "Threat and security perception. Integration develops accurate risk assessment." },
    { id: 327, left: "the world is unfair", right: "the world is fair", description: "Injustice and justice. Integration works for fairness while accepting reality." },
    { id: 328, left: "theory", right: "practice", description: "Ideas and application. Integration bridges understanding and embodied action." },
    { id: 329, left: "this world", right: "other world", description: "Earthly and transcendent realms. Integration lives fully here while open to beyond." },
    { id: 330, left: "thrifty", right: "thriftless", description: "Economical and wasteful. Integration uses resources wisely without hoarding." },
    { id: 331, left: "to agree", right: "to disagree", description: "Alignment and opposition. Integration holds views while remaining open to others." },
    { id: 332, left: "to be", right: "not to be", description: "The fundamental existential question. Integration rests prior to the question." },
    { id: 333, left: "to be always conscious of oneself", right: "to be never conscious of oneself", description: "Self-awareness and self-forgetting. Integration brings effortless awareness without fixation." },
    { id: 334, left: "to be aware of the essence", right: "to see the surface", description: "Depth and surface perception. Integration sees both essence and appearance simultaneously." },
    { id: 335, left: "to be flexible", right: "to be fixated on", description: "Adaptability and rigidity. Integration brings principled flexibility." },
    { id: 336, left: "to be united with one's roots", right: "to be separated with them", description: "Connection and disconnection from origins. Integration honors roots while growing beyond them." },
    { id: 337, left: "to begin", right: "to stop", description: "Starting and ending. Integration knows when to initiate and when to cease." },
    { id: 338, left: "to believe everything will be OK", right: "to disbelieve everything will be OK", description: "Optimistic and pessimistic faith. Integration acts wisely regardless of outcome beliefs." },
    { id: 339, left: "to bless", right: "to curse", description: "Bestowing good and ill wishes. Integration blesses all, curses none." },
    { id: 340, left: "to forget", right: "to remember", description: "Releasing and holding memory. Integration remembers what serves, forgets what burdens." },
    { id: 341, left: "to give", right: "to get", description: "Offering and receiving. Integration flows freely in both directions." },
    { id: 342, left: "to have a higher purpose", right: "to live without a purpose", description: "Meaning and meaninglessness. Integration finds purpose while releasing attachment to it." },
    { id: 343, left: "to have a possibility to choose", right: "to have no choice", description: "Freedom and determinism. Integration chooses fully within apparent constraints." },
    { id: 344, left: "to have results", right: "to have no results", description: "Achievement and futility. Integration acts wholeheartedly while releasing attachment to results." },
    { id: 345, left: "to have time", right: "to have no time", description: "The felt sense of abundance versus scarcity around time. Both are mental constructs - integration frees you from time's tyranny while honoring practical reality." },
    { id: 346, left: "to know", right: "not to know", description: "Knowledge and ignorance. Integration holds knowing humbly, respects not-knowing." },
    { id: 347, left: "to know everything", right: "to know nothing", description: "Omniscience and complete ignorance. Integration embraces vast not-knowing." },
    { id: 348, left: "to know one's predestination", right: "to not know one's predestination", description: "Certainty and uncertainty about fate. Integration lives fully without needing to know." },
    { id: 349, left: "to give a gift", right: "to take a gift", description: "Offering and receiving gifts. Integration gives and receives with equal grace." },
    { id: 350, left: "to possess everything", right: "to possess nothing", description: "Total ownership and total emptiness. Integration releases possessiveness while caring for what's entrusted." },
    { id: 351, left: "to remember", right: "to forget", description: "Holding and releasing memory. Integration balances remembering and letting go." },
    { id: 352, left: "to see", right: "to understand", description: "Perception and comprehension. Integration sees deeply and understands what is seen." },
    { id: 353, left: "to stay", right: "to leave", description: "Remaining and departing. Integration knows when to stay and when to go." },
    { id: 354, left: "to survive", right: "to die", description: "Living and ending. Integration lives fully, accepting mortality." },
    { id: 355, left: "to survive", right: "to give up", description: "Persisting and surrendering. Integration fights when appropriate, surrenders when wise." },
    { id: 356, left: "to take", right: "to give", description: "Receiving and offering. Integration balances taking and giving." },
    { id: 357, left: "to take responsibility", right: "to reject responsibility", description: "Owning and disowning. Integration takes appropriate responsibility, not more or less." },
    { id: 358, left: "to throw", right: "to pick up", description: "Releasing and gathering. Integration knows when to let go and when to collect." },
    { id: 359, left: "to turn pale", right: "to turn red", description: "Withdrawal and rush of blood. Integration allows natural somatic responses without shame." },
    { id: 360, left: "to win", right: "to lose", description: "Victory and defeat. Integration competes fully while releasing attachment to winning." },
    { id: 361, left: "to withstand", right: "to give up", description: "Enduring and surrendering. Integration knows when resilience serves and when release is needed." },
    { id: 362, left: "tolerance", right: "intolerance", description: "Acceptance and rejection of difference. Integration practices tolerance without tolerating harm." },
    { id: 363, left: "top", right: "bottom", description: "Highest and lowest. Integration transcends vertical hierarchy." },
    { id: 364, left: "topical", right: "non-topical", description: "Relevant and irrelevant. Integration finds relevance beyond surface appearance." },
    { id: 365, left: "tragedy", right: "comedy", description: "Sorrowful and humorous perspectives. Integration sees the tragic and comic in all of life." },
    { id: 366, left: "true memory", right: "illusive memory", description: "Accurate and false recollection. Integration holds memory lightly, knowing its construction." },
    { id: 367, left: "truth", right: "hallucinations", description: "Reality and delusion. Integration distinguishes truth while respecting visionary experience." },
    { id: 368, left: "truth", right: "lie", description: "Honesty and deception. Integration commits to truth while understanding why we deceive." },
    { id: 369, left: "uncertainty", right: "certainty", description: "Doubt and conviction. Integration holds certainty lightly, embraces uncertainty." },
    { id: 370, left: "uncertainty about the future", right: "certainty about the future", description: "Not knowing and knowing what comes. Integration acts wisely in genuine uncertainty." },
    { id: 371, left: "understanding", right: "misunderstanding", description: "Grasping and missing meaning. Integration seeks understanding while accepting misunderstanding." },
    { id: 372, left: "unity", right: "duality", description: "Oneness and twoness. Integration perceives unity within apparent duality." },
    { id: 373, left: "unity", right: "separation", description: "Connection and division. Integration feels unity while functioning in apparent separation." },
    { id: 374, left: "unity with others", right: "isolation", description: "Belonging and aloneness. Integration finds inner unity regardless of outer connection." },
    { id: 375, left: "unpleasant", right: "pleasant", description: "Aversive and attractive. Integration meets both with equanimity." },
    { id: 376, left: "unwillingness to change", right: "willingness to change", description: "Resistance and openness to transformation. Integration honors stability while remaining open to growth." },
    { id: 377, left: "unwillingness to live", right: "enjoyment of life", description: "Death wish and life embrace. Integration transforms despair into appreciation for life." },
    { id: 378, left: "unwillingness to live", right: "lust for life", description: "Suicidal impulse and vital engagement. Integration chooses life while acknowledging darkness." },
    { id: 379, left: "up", right: "down", description: "Ascending and descending. Integration moves freely in both directions." },
    { id: 380, left: "usual people", right: "enlightened people", description: "Ordinary and awakened beings. Integration sees buddha nature in all, specialness in none." },
    { id: 381, left: "victory", right: "defeat", description: "Winning and losing. Integration transcends the victory/defeat paradigm." },
    { id: 382, left: "victory", right: "loss", description: "Gain and forfeiture. Integration holds both lightly." },
    { id: 383, left: "virtual world", right: "real world", description: "Simulated and actual. Integration engages both while knowing the difference." },
    { id: 384, left: "visibility", right: "invisibility", description: "Being seen and unseen. Integration is comfortable visible or invisible." },
    { id: 385, left: "void", right: "the whole world", description: "Emptiness and fullness. Integration perceives the world as void, void as full." },
    { id: 386, left: "vulnerability", right: "invulnerability", description: "Openness to harm and protection from it. Integration brings strength through vulnerability." },
    { id: 387, left: "war", right: "peace", description: "Conflict and harmony. Integration works for peace while accepting reality of conflict." },
    { id: 388, left: "wealth", right: "poverty", description: "Abundance and scarcity. Integration finds richness regardless of material circumstance." },
    { id: 389, left: "weekdays", right: "holiday", description: "Work time and rest time. Integration brings holiday consciousness to weekdays." },
    { id: 390, left: "white", right: "black", description: "Light and dark, often representing moral poles. Integration transcends black-white thinking." },
    { id: 391, left: "wish to be approved", right: "wish to approve", description: "Seeking and giving validation. Integration releases need for approval while offering genuine appreciation." },
    { id: 392, left: "wish to be lonely", right: "wish to be with everyone", description: "Desire for solitude and community. Integration honors both needs appropriately." },
    { id: 393, left: "wish to be loved", right: "wish to love", description: "Receiving and giving love. Integration flows freely in both directions." },
    { id: 394, left: "wish to be with people", right: "unwillingness to be with people", description: "Social desire and aversion. Integration honors both connection and solitude needs." },
    { id: 395, left: "wish to control", right: "wish to release control", description: "The pull between directing outcomes and surrendering to flow. Integration brings the wisdom to know when to steer and when to let the river carry you." },
    { id: 396, left: "wish to control the others", right: "wish to be controlled by the others", description: "Dominance and submission desires. Integration releases both while relating authentically." },
    { id: 397, left: "wish to debate", right: "unwillingness to debate", description: "Desire to argue and avoid argument. Integration engages or declines debate as appropriate." },
    { id: 398, left: "wish to have love", right: "wish to give love", description: "Receiving and offering love. Integration balances receiving and giving love." },
    { id: 399, left: "wish to live", right: "wish to die", description: "Life force and death wish. Integration chooses life while accepting mortality." },
    { id: 400, left: "wish to move", right: "fear to move", description: "Impulse and resistance to action. Integration moves through fear when appropriate." },
    { id: 401, left: "wish to move", right: "unwillingness to move", description: "Desire for change and resistance to it. Integration honors both stability and growth." },
    { id: 402, left: "wish to win approval", right: "wish to express approval", description: "Seeking and giving validation. Integration releases approval-seeking while offering genuine appreciation." },
    { id: 403, left: "wish to work", right: "unwillingness to work", description: "Work drive and resistance. Integration aligns work with meaning and purpose." },
    { id: 404, left: "wise man", right: "stupid jerk", description: "Wisdom and foolishness. Integration finds wisdom in simplicity, humility beyond cleverness." }
];

// Emotional states data for Process tool
const EMOTIONS_DATA = [
    // Negative/Shadow emotions
    { id: 1, name: "abandoned", description: "The painful sense of being left behind, forgotten, or deemed unworthy of care. Often rooted in early experiences of separation or neglect." },
    { id: 2, name: "abrupt", description: "A sudden, jarring quality of energy - cut off, disconnected, or harshly ended. The feeling of being interrupted or interrupting without grace." },
    { id: 3, name: "abused", description: "The wound of having been mistreated, violated, or harmed by those who should have protected. Carries deep betrayal and powerlessness." },
    { id: 4, name: "accused", description: "The painful experience of being blamed, whether justly or not. Often triggers shame, defensiveness, or righteous anger." },
    { id: 5, name: "aching", description: "A persistent, dull emotional pain that doesn't go away. The heart's way of signaling unresolved grief or longing." },
    { id: 6, name: "achy", description: "A low-grade, constant discomfort - emotionally sore and tender, as if bruised from within." },
    { id: 7, name: "adrift", description: "Floating without anchor or direction. The disorienting sense of having lost your moorings, uncertain where you belong." },
    { id: 8, name: "afflicted", description: "Burdened by suffering or hardship. The sense of being struck by misfortune beyond your control." },
    { id: 9, name: "afraid", description: "The primal emotion of perceived threat - body on alert, mind scanning for danger, heart racing with anticipation of harm." },
    { id: 10, name: "aggravated", description: "Irritation intensified - something that was merely annoying has become genuinely disturbing and hard to tolerate." },
    { id: 11, name: "aggressive", description: "Energy mobilized for attack or defense. The impulse to push against, dominate, or harm - can be protective or destructive." },
    { id: 12, name: "agitated", description: "Restless disturbance - unable to settle, nerves jangling, inner turbulence seeking outlet or resolution." },
    { id: 13, name: "agonized", description: "Extreme suffering that feels unbearable. The soul crying out in intense pain, whether physical, emotional, or spiritual." },
    { id: 14, name: "agony", description: "The peak of suffering - overwhelming pain that consumes awareness and seems to have no end or relief." },
    { id: 15, name: "agoraphobic", description: "Fear of open spaces or situations where escape feels difficult. The anxiety of being trapped, exposed, or unable to reach safety." },
    { id: 16, name: "alarmed", description: "Sudden alertness to danger - the system has detected threat and is mobilizing for response. Heart racing, senses sharpening." },
    { id: 17, name: "alienated", description: "Estranged from others, from self, or from life itself. The painful sense of not belonging anywhere or to anyone." },
    { id: 18, name: "alone", description: "The experience of solitude that feels unwanted - isolation without choice, separation without connection to fall back on." },
    { id: 19, name: "aloof", description: "Distant and detached, holding oneself apart. May be protective withdrawal or genuine disinterest in connection." },
    { id: 20, name: "ambivalent", description: "Pulled in opposite directions simultaneously - wanting and not wanting, loving and hating, approaching and avoiding." },
    { id: 21, name: "anguished", description: "Deep emotional torment - the kind of suffering that twists the soul and feels impossible to escape or resolve." },
    { id: 22, name: "animosity", description: "Active ill will toward someone - stronger than dislike, carrying hostile energy and desire for the other's misfortune." },
    { id: 23, name: "annoyed", description: "Mild irritation at something that disrupts peace or patience. A small thorn that nevertheless demands attention." },
    { id: 24, name: "antagonistic", description: "Actively oppositional - positioned against someone or something, ready to resist, counter, or fight." },
    { id: 25, name: "anxious", description: "Worried anticipation of future threat or difficulty. The mind racing ahead to problems, the body tight with preparation." },
    { id: 26, name: "apathetic", description: "Without feeling or interest - emotional flatness where nothing seems to matter or spark engagement." },
    { id: 27, name: "appalled", description: "Shocked by something morally offensive or deeply disturbing. Combines disgust, horror, and disbelief." },
    { id: 28, name: "apprehensive", description: "Uneasy anticipation of something difficult or dangerous. Worry about what's coming without certainty of harm." },
    { id: 29, name: "argumentative", description: "The tendency to dispute, contradict, or debate - energy organized around opposition and proving points." },
    { id: 30, name: "arrogant", description: "Inflated self-importance that dismisses or looks down on others. Often masks deeper insecurity or shame." },
    { id: 31, name: "ashamed", description: "The painful sense of being exposed as flawed, wrong, or unworthy. Wants to hide, disappear, or undo what was done." },
    { id: 32, name: "at fault", description: "The recognition of being responsible for something wrong - may carry guilt, regret, or defensive justification." },
    { id: 33, name: "attached", description: "Emotionally bound to someone or something - can be healthy connection or anxious clinging that fears loss." },
    { id: 34, name: "attacked", description: "The experience of being assaulted - physically, verbally, or energetically. Triggers defense, fear, or counter-attack." },
    { id: 35, name: "attacking", description: "Actively aggressive toward another - the energy of offense, criticism, or harm directed outward." },
    { id: 36, name: "authoritative", description: "Carrying power and command - can be healthy leadership or domineering control that doesn't allow questioning." },
    { id: 37, name: "avoiding", description: "The energy of turning away, escaping, or refusing to face something. Protective but can become limiting." },
    { id: 38, name: "awful", description: "Extremely bad or unpleasant - the sense that something is deeply wrong, disturbing, or unbearable." },
    { id: 39, name: "awkward", description: "Uncomfortable lack of ease - socially clumsy, physically ungraceful, or emotionally out of sync with the situation." },
    { id: 40, name: "bad", description: "A basic negative self-assessment - feeling wrong, harmful, or unworthy at a fundamental level." },
    { id: 41, name: "baffled", description: "Completely confused and unable to understand - the mind hitting a wall it cannot penetrate or make sense of." },
    { id: 42, name: "banished", description: "Cast out, exiled, forbidden to belong. The pain of being deliberately excluded from community or connection." },
    { id: 43, name: "barren", description: "Empty and unfruitful - nothing growing, nothing alive, nothing to offer. Inner desolation and sterility." },
    { id: 44, name: "bashful", description: "Shy self-consciousness in social situations - the wish to connect mixed with fear of exposure or rejection." },
    { id: 45, name: "beaten down", description: "Worn out by repeated defeat or criticism. The spirit crushed by persistent negative experience." },
    { id: 46, name: "befuddled", description: "Muddled and confused - thinking unclear, judgment impaired, unable to find mental clarity." },
    { id: 47, name: "belittled", description: "Made to feel small, unimportant, or inferior. The wound of being diminished by another's words or actions." },
    { id: 48, name: "belligerent", description: "Aggressively hostile and ready to fight. Combative energy looking for conflict or provocation." },
    { id: 49, name: "bereft", description: "A profound sense of loss and emptiness, as if something essential has been taken away. Deeper than sadness - a feeling of being stripped bare." },
    { id: 50, name: "betrayed", description: "The deep wound of trust violated - someone who should have been loyal or honest chose otherwise." },
    { id: 51, name: "bewildered", description: "Lost in confusion - disoriented, unable to understand or find direction in a perplexing situation." },
    { id: 52, name: "bitter", description: "Resentful hardness from accumulated disappointment or hurt. Sweetness turned sour through suffering." },
    { id: 53, name: "blaming", description: "Pointing finger at others for what went wrong - deflecting responsibility or seeking target for anger." },
    { id: 54, name: "bleak", description: "Dark, cold, and hopeless - a landscape without comfort, color, or promise of improvement." },
    { id: 55, name: "blindsided", description: "Hit by something completely unexpected - shocked by what you never saw coming." },
    { id: 56, name: "blocked", description: "Obstructed and unable to move forward - energy stuck, progress prevented, expression suppressed." },
    { id: 57, name: "blue", description: "Sad and melancholy - the emotional color of mild depression, low spirits, or quiet grief." },
    { id: 58, name: "blushing", description: "The physical and emotional experience of embarrassed self-consciousness - blood rushing to face as exposure is felt." },
    { id: 59, name: "boastful", description: "Excessive self-promotion - loudly claiming achievements or qualities, often to compensate for insecurity." },
    { id: 60, name: "bored", description: "Understimulated and disengaged - nothing captures interest, time drags, life feels flat and meaningless." },
    { id: 61, name: "bossy", description: "Dominating and controlling - telling others what to do without regard for their autonomy or preferences." },
    { id: 62, name: "broken-hearted", description: "The shattering of the emotional center through loss or rejection. Deep grief that feels like physical damage to the heart." },
    { id: 63, name: "brutal", description: "Harsh, cruel, and without mercy - savage energy that doesn't care about causing pain." },
    { id: 64, name: "bugged", description: "Persistently irritated by something that won't leave you alone - a nagging annoyance you can't shake." },
    { id: 65, name: "bulldozed", description: "Run over by overwhelming force - your position, feelings, or boundaries flattened by another's power." },
    { id: 66, name: "bullied", description: "Targeted for repeated mistreatment by someone with more power - harassed, intimidated, or dominated." },
    { id: 67, name: "bummed out", description: "Disappointed and deflated - something hoped for didn't happen, leaving you down and discouraged." },
    { id: 68, name: "burdened", description: "Weighed down by responsibility, problems, or emotional heaviness. Carrying more than feels sustainable." },
    { id: 69, name: "burned up", description: "Intensely angry - the heat of rage consuming you, ready to explode or consume what angered you." },
    { id: 70, name: "captive", description: "Held against your will - trapped by circumstances, relationships, or inner patterns you cannot escape." },
    { id: 71, name: "careless", description: "Without sufficient care or attention - sloppy, negligent, not taking appropriate responsibility." },
    { id: 72, name: "cast off", description: "Discarded, thrown away, deemed no longer useful or wanted. The pain of being rejected as worthless." },
    { id: 73, name: "censured", description: "Officially criticized or condemned - formally judged and found wanting by authority." },
    { id: 74, name: "chaotic", description: "In disorder and confusion - inner or outer life without structure, pattern, or stability." },
    { id: 75, name: "chastened", description: "Humbled by correction or failure - subdued and more cautious after being shown your limits or mistakes." },
    { id: 76, name: "cheap", description: "Feeling of low value or worth - either self-assessment or being treated as disposable or inferior." },
    { id: 77, name: "cheapened", description: "Made to feel less valuable - dignity reduced, worth diminished by circumstance or treatment." },
    { id: 78, name: "cheated", description: "Deprived of something rightfully yours through deception - betrayed by dishonest dealing." },
    { id: 79, name: "cheerless", description: "Without joy or brightness - a gray emotional landscape lacking warmth or lightness." },
    { id: 80, name: "clingy", description: "Desperately holding on for fear of loss - attachment driven by anxiety rather than genuine connection." },
    { id: 81, name: "closed", description: "Shut down and unavailable - barriers up, not letting anything or anyone in." },
    { id: 82, name: "clumsy", description: "Lacking grace or skill - awkward in movement, speech, or social interaction." },
    { id: 83, name: "cold", description: "Emotionally distant and unresponsive - lacking warmth, affection, or engagement." },
    { id: 84, name: "combative", description: "Ready and eager to fight - aggressive energy seeking confrontation or conflict." },
    { id: 85, name: "comparing", description: "Measuring self against others - the constant evaluation that leaves you feeling better or worse than." },
    { id: 86, name: "complaining", description: "Expressing dissatisfaction repeatedly - focused on what's wrong without moving toward solution." },
    { id: 87, name: "compromised", description: "Integrity or position weakened - you've given ground you didn't want to give or been exposed in vulnerability." },
    { id: 88, name: "compulsive", description: "Driven by urges you cannot control - repeating behaviors despite knowing better." },
    { id: 89, name: "conceited", description: "Excessive pride in yourself - self-admiration that blinds you to faults and alienates others." },
    { id: 90, name: "condemned", description: "Judged guilty and sentenced - declared wrong, bad, or worthy of punishment." },
    { id: 91, name: "condemning", description: "Harshly judging others - pronouncing them guilty, wrong, or worthy of punishment." },
    { id: 92, name: "condescending", description: "Looking down on others from assumed superiority - treating them as lesser or inferior." },
    { id: 93, name: "confined", description: "Restricted to a limited space or range of options - freedom curtailed, movement restricted." },
    { id: 94, name: "conflicted", description: "Torn by opposing forces within - unable to resolve competing desires, values, or directions." },
    { id: 95, name: "confounded", description: "Utterly confused and defeated by complexity - unable to figure out what's happening or what to do." },
    { id: 96, name: "confused", description: "Unable to think clearly or understand - mental fog, uncertain about what's true or right." },
    { id: 97, name: "contemptible", description: "Feeling deserving of contempt - seeing yourself as worthy of scorn and disrespect." },
    { id: 98, name: "contentious", description: "Argumentative and quarrelsome - inclined to disagree and create conflict." },
    { id: 99, name: "contracted", description: "Pulled inward and made smaller - energy withdrawn, body tight, presence diminished." },
    { id: 100, name: "contradictory", description: "Internally inconsistent - holding positions or feelings that oppose each other." },
    { id: 101, name: "contrary", description: "Inclined to oppose or do the opposite - resistant, obstinate, or deliberately different." },
    { id: 102, name: "controlled", description: "Under someone else's power or influence - autonomy limited, choices constrained by another." },
    { id: 103, name: "controlling", description: "Attempting to dominate others or situations - managing through manipulation or force." },
    { id: 104, name: "covetous", description: "Wanting what others have - envious desire for possessions, qualities, or relationships that aren't yours." },
    { id: 105, name: "cowardly", description: "Lacking courage to face fear - avoiding necessary confrontation, hiding from difficulty." },
    { id: 106, name: "crabby", description: "Irritable and grumpy - snapping at others, easily annoyed, unpleasant to be around." },
    { id: 107, name: "cranky", description: "Bad-tempered and irritable - out of sorts and showing it through complaints and criticism." },
    { id: 108, name: "craving", description: "Intense wanting or needing - powerful desire that feels urgent and consuming." },
    { id: 109, name: "crazy", description: "Feeling mentally unstable or irrational - thoughts and feelings that seem wild, out of control, or abnormal." },
    { id: 110, name: "crippled", description: "Severely limited in function or capacity - disabled in ways that prevent normal life." },
    { id: 111, name: "critical", description: "Focused on faults and problems - judging harshly, finding what's wrong rather than what's right." },
    { id: 112, name: "criticized", description: "Being judged negatively by others - receiving disapproval, correction, or attack on your actions or character." },
    { id: 113, name: "cruel", description: "Deliberately causing pain or suffering - taking pleasure or satisfaction in another's distress." },
    { id: 114, name: "crushed", description: "Completely defeated or devastated - spirit broken by overwhelming force or loss." },
    { id: 115, name: "crying", description: "The release of grief or overwhelm through tears - the body's way of expressing and discharging emotional pain." },
    { id: 116, name: "cursed", description: "Feeling marked for misfortune - as if bad luck or negative forces specifically target you." },
    { id: 117, name: "cut off", description: "Severed from connection or flow - isolated, excluded, or blocked from what you need." },
    { id: 118, name: "cynical", description: "Distrustful of others' motives - assuming the worst, believing in selfishness over goodness." },
    { id: 119, name: "debased", description: "Reduced in quality, character, or value - degraded from a higher state to something lower." },
    { id: 120, name: "deceitful", description: "Engaging in deception - lying, misleading, or hiding truth to manipulate." },
    { id: 121, name: "deceived", description: "Being lied to or misled - trust violated through another's dishonesty." },
    { id: 122, name: "defamed", description: "Having your reputation damaged by false statements - publicly shamed through lies." },
    { id: 123, name: "defeated", description: "Beaten, conquered, or overcome - the experience of losing a battle or competition." },
    { id: 124, name: "defensive", description: "Protecting yourself from perceived attack - guarded, ready to explain, justify, or counter-attack." },
    { id: 125, name: "defiant", description: "Openly resisting authority or opposition - bold refusal to submit or comply." },
    { id: 126, name: "deficient", description: "Lacking what's needed - falling short, not enough, missing essential qualities or resources." },
    { id: 127, name: "defiled", description: "Made impure or corrupted - violated in a way that feels spiritually or essentially damaging." },
    { id: 128, name: "deflated", description: "Energy and confidence suddenly gone - punctured, collapsed, emptied of vitality or hope." },
    { id: 129, name: "degenerate", description: "Declined from a better state - morally or otherwise deteriorated, degraded." },
    { id: 130, name: "degraded", description: "Lowered in status, quality, or dignity - reduced to something less than you were." },
    { id: 131, name: "dejected", description: "Sad and dispirited - cast down, disappointed, lacking energy or hope." },
    { id: 132, name: "demanding", description: "Insistently requiring attention or satisfaction - pressing needs on others without consideration." },
    { id: 133, name: "demeaned", description: "Treated as inferior or unworthy - dignity attacked through condescension or contempt." },
    { id: 134, name: "demoralized", description: "Spirit and confidence destroyed - beaten down until hope and motivation collapse." },
    { id: 135, name: "dependent", description: "Relying on others for what you cannot provide yourself - may be healthy interdependence or unhealthy clinging." },
    { id: 136, name: "depraved", description: "Morally corrupt - engaged in or drawn to what is wrong, harmful, or degrading." },
    { id: 137, name: "depreciated", description: "Value decreased over time - worth less than before, diminished in importance or respect." },
    { id: 138, name: "depressed", description: "Pressed down, flattened - low mood, low energy, low hope. The weight of sadness that doesn't lift." },
    { id: 139, name: "deprived", description: "Lacking what is needed or deserved - kept from having basic necessities or rights." },
    { id: 140, name: "derided", description: "Mocked and ridiculed - made fun of in a way meant to hurt and belittle." },
    { id: 141, name: "desecrated", description: "Something sacred has been violated - profound disrespect for what was holy or precious." },
    { id: 142, name: "deserted", description: "Left alone by those who should have stayed - abandoned in a time or place of need." },
    { id: 143, name: "desolate", description: "Utterly alone and empty - a barren landscape of the soul without comfort or hope." },
    { id: 144, name: "despair", description: "Complete loss of hope - the conviction that nothing can improve, nothing matters, nothing will help." },
    { id: 145, name: "despairing", description: "In the grip of despair - actively experiencing hopelessness and futility." },
    { id: 146, name: "desperate", description: "Driven by urgency and fear - willing to try anything because the situation feels critical." },
    { id: 147, name: "despicable", description: "Feeling deserving of contempt - seeing yourself as morally worthless or disgusting." },
    { id: 148, name: "despondent", description: "Deep discouragement without hope - low and heavy with no expectation of improvement." },
    { id: 149, name: "destitute", description: "Completely without resources - lacking the basics needed for survival or functioning." },
    { id: 150, name: "destroyed", description: "Completely ruined or broken - nothing left of what was, no possibility of repair." },
    { id: 151, name: "devalued", description: "Worth reduced or dismissed - treated as less important or valuable than you are." },
    { id: 152, name: "devastated", description: "Completely overwhelmed by loss or shock - emotionally flattened, unable to function normally." },
    { id: 153, name: "difficult", description: "Hard to deal with or please - creating problems for yourself or others, not easy." },
    { id: 154, name: "diminished", description: "Made smaller or less - reduced in size, importance, or effectiveness." },
    { id: 155, name: "dirty", description: "Feeling unclean, contaminated, or morally soiled - wanting to wash away something shameful." },
    { id: 156, name: "disappointed", description: "Expectations unmet - the letdown when reality falls short of hope or anticipation." },
    { id: 157, name: "discarded", description: "Thrown away as useless - rejected as no longer needed or wanted." },
    { id: 158, name: "disconcerted", description: "Thrown off balance, unsettled by something unexpected. The discomfort of having your assumptions or expectations disrupted." },
    { id: 159, name: "disconnected", description: "Separated from others, self, or life - the link that should connect is broken or absent." },
    { id: 160, name: "disconsolate", description: "Beyond comfort or consolation - grief so deep that nothing can ease it." },
    { id: 161, name: "discontented", description: "Not satisfied with what is - restless dissatisfaction with current conditions." },
    { id: 162, name: "discouraged", description: "Lost heart or confidence - setbacks have diminished your hope or motivation." },
    { id: 163, name: "discredited", description: "Reputation or credibility damaged - no longer believed or trusted." },
    { id: 164, name: "disdainful", description: "Looking down with contempt - superior dismissal of someone or something seen as beneath you." },
    { id: 165, name: "disgraced", description: "Publicly shamed - honor lost through exposure of wrongdoing or failure." },
    { id: 166, name: "disgusted", description: "Strong aversion and revulsion - the impulse to turn away from something offensive." },
    { id: 167, name: "disheartened", description: "Lost courage or enthusiasm - the heart gone out of your effort or hope." },
    { id: 168, name: "dishonest", description: "Not truthful or trustworthy - engaged in deception or misrepresentation." },
    { id: 169, name: "disillusioned", description: "Painful loss of cherished beliefs - discovering that what you believed was false or naive." },
    { id: 170, name: "dismal", description: "Depressing and gloomy - dark outlook without brightness or hope." },
    { id: 171, name: "dismayed", description: "Distressed and disappointed - shocked by something that undermines hope or confidence." },
    { id: 172, name: "disorganized", description: "Lacking order or structure - chaotic, scattered, unable to function effectively." },
    { id: 173, name: "disoriented", description: "Lost sense of direction or identity - confused about where you are or who you are." },
    { id: 174, name: "disparaged", description: "Feeling belittled, spoken of with contempt, or treated as worthless. The sting of being dismissed or devalued by others." },
    { id: 175, name: "disparaging", description: "Speaking contemptuously of others - belittling, dismissing, or devaluing." },
    { id: 176, name: "disrespectful", description: "Showing contempt or lack of regard - failing to honor what deserves respect." },
    { id: 177, name: "disrupted", description: "Normal flow interrupted - thrown into disorder by unexpected interference." },
    { id: 178, name: "dissatisfied", description: "Not content with what is - wanting something other or better than current reality." },
    { id: 179, name: "distant", description: "Emotionally remote - not engaged, not available, keeping separation." },
    { id: 180, name: "distorted", description: "Twisted out of true shape - perception or expression warped from accuracy." },
    { id: 181, name: "distracted", description: "Attention pulled away from focus - unable to concentrate, mind scattered." },
    { id: 182, name: "distraught", description: "Deeply agitated and upset - emotional distress that disrupts normal functioning." },
    { id: 183, name: "distressed", description: "In a state of suffering or anxiety - troubled, worried, uncomfortable." },
    { id: 184, name: "distrustful", description: "Lacking trust - suspicious, wary, expecting betrayal or disappointment." },
    { id: 185, name: "disturbed", description: "Troubled or upset - inner peace disrupted by something wrong or worrying." },
    { id: 186, name: "dominated", description: "Controlled by another's power - your will subordinated to someone else's." },
    { id: 187, name: "doomed", description: "Condemned to a terrible fate - no escape from coming disaster." },
    { id: 188, name: "doubtful", description: "Uncertain and questioning - unable to trust or believe fully." },
    { id: 189, name: "down", description: "Low in mood or energy - feeling beneath your usual level, diminished." },
    { id: 190, name: "downcast", description: "Dejected and dispirited - eyes and energy cast downward, lacking lift." },
    { id: 191, name: "downhearted", description: "Heart sunk low - discouraged, sad, lacking emotional buoyancy." },
    { id: 192, name: "drained", description: "Energy depleted - emptied of vitality, exhausted physically or emotionally." },
    { id: 193, name: "drawn", description: "Pulled thin, haggard, stressed - showing the effects of strain or suffering." },
    { id: 194, name: "dread", description: "Anticipatory fear of something terrible - the heavy weight of expecting disaster." },
    { id: 195, name: "dreadful", description: "Causing or feeling dread - terrible, frightening, extremely unpleasant." },
    { id: 196, name: "dreary", description: "Dull, bleak, and depressing - lacking brightness, hope, or interest." },
    { id: 197, name: "dull", description: "Lacking sharpness, brightness, or interest - flat, boring, unstimulating." },
    { id: 198, name: "embarrassed", description: "Self-conscious discomfort from exposure - wanting to hide from others' attention." },
    { id: 199, name: "embroiled", description: "Caught up in conflict or difficulty - deeply involved in something messy or troublesome." },
    { id: 200, name: "empty", description: "Lacking content, meaning, or feeling - hollow inside, nothing there to give or feel." },
    { id: 201, name: "enraged", description: "Filled with rage - intense anger that feels overwhelming and demands expression." },
    { id: 202, name: "envious", description: "Wanting what others have - painful awareness of their advantages compared to yours." },
    { id: 203, name: "estranged", description: "Alienated from those you were once close to - relationship damaged or broken." },
    { id: 204, name: "exasperated", description: "Intensely frustrated and annoyed - patience exhausted by repeated difficulty." },
    { id: 205, name: "excluded", description: "Left out, not included - deliberately or accidentally shut out from belonging." },
    { id: 206, name: "exhausted", description: "Completely depleted - no energy reserves left, physically or emotionally spent." },
    { id: 207, name: "exploited", description: "Used unfairly for another's benefit - taken advantage of without regard for your welfare." },
    { id: 208, name: "exposed", description: "Vulnerable and visible - protective covering removed, open to judgment or harm." },
    { id: 209, name: "failure", description: "The identity of having failed - not just experiencing defeat but being a failure." },
    { id: 210, name: "faithless", description: "Without faith or loyalty - either lacking trust or being untrustworthy." },
    { id: 211, name: "fake", description: "Not authentic or genuine - pretending to be something you're not." },
    { id: 212, name: "fatigued", description: "Tired and worn out - energy depleted by sustained effort or stress." },
    { id: 213, name: "faultfinding", description: "Habitually looking for what's wrong - critical focus that sees problems everywhere." },
    { id: 214, name: "fearful", description: "Full of fear - anxious, worried, anticipating threat or danger." },
    { id: 215, name: "feeble", description: "Weak and lacking strength - unable to exert much force or influence." },
    { id: 216, name: "fidgety", description: "Restlessly moving - unable to be still, nervous energy seeking outlet." },
    { id: 217, name: "filthy", description: "Extremely dirty or morally disgusting - contaminated beyond simple uncleanness." },
    { id: 218, name: "finished", description: "Done, complete, but also potentially destroyed - nothing left to give or do." },
    { id: 219, name: "flighty", description: "Unstable and changeable - attention and commitment shifting unpredictably." },
    { id: 220, name: "flustered", description: "Agitated and confused - thrown off balance and unable to think clearly." },
    { id: 221, name: "foggy", description: "Mentally unclear - thoughts obscured, unable to see or think distinctly." },
    { id: 222, name: "forgetful", description: "Memory failing - unable to remember what should be remembered." },
    { id: 223, name: "forgotten", description: "Left behind in others' minds - not remembered, erased from attention or care." },
    { id: 224, name: "forlorn", description: "Pitifully sad and lonely - abandoned and hopeless, evoking compassion." },
    { id: 225, name: "forsaken", description: "Abandoned by those who should have stayed - left alone when loyalty was expected." },
    { id: 226, name: "fragile", description: "Easily broken or damaged - delicate, vulnerable, lacking resilience." },
    { id: 227, name: "fragmented", description: "Broken into pieces - not whole, lacking integration or coherence." },
    { id: 228, name: "frantic", description: "Wildly urgent and out of control - desperate activity driven by panic." },
    { id: 229, name: "frenzied", description: "In a frenzy - wildly excited or active in an uncontrolled way." },
    { id: 230, name: "fretful", description: "Anxiously worried - nagging concern that won't let you rest." },
    { id: 231, name: "friendless", description: "Without friends - alone, lacking the support and companionship of friendship." },
    { id: 232, name: "frightened", description: "Scared by immediate threat - fear activated by something dangerous or shocking." },
    { id: 233, name: "frigid", description: "Extremely cold emotionally - frozen, unresponsive, lacking warmth." },
    { id: 234, name: "frowning", description: "The facial and emotional expression of displeasure or concern - brow contracted, mood negative." },
    { id: 235, name: "frustrated", description: "Blocked from achieving goals - the irritation of effort that doesn't succeed." },
    { id: 236, name: "fuming", description: "Silently seething with anger - rage building heat that hasn't yet exploded." },
    { id: 237, name: "furious", description: "Extremely angry - rage at full intensity, ready to attack or destroy." },
    { id: 238, name: "glaring", description: "Staring with anger or hostility - eyes expressing disapproval or aggression." },
    { id: 239, name: "gloomy", description: "Dark and depressing - low mood casting shadow over everything." },
    { id: 240, name: "glum", description: "Quietly unhappy - low-spirited without dramatic expression." },
    { id: 241, name: "grieved", description: "Experiencing grief - mourning a loss, heart heavy with sorrow." },
    { id: 242, name: "grim", description: "Stern, serious, and foreboding - harsh outlook without lightness or hope." },
    { id: 243, name: "groaning", description: "Expressing suffering through sound - the voice of pain or burden." },
    { id: 244, name: "grouchy", description: "Bad-tempered and complaining - irritable mood showing through words and behavior." },
    { id: 245, name: "grumpy", description: "Ill-tempered and displeased - sullen irritability without clear cause." },
    { id: 246, name: "guarded", description: "Protective and wary - not allowing access, keeping defenses up." },
    { id: 247, name: "guilty", description: "Feeling responsible for wrongdoing - the weight of having done harm or broken rules." },
    { id: 248, name: "gullible", description: "Easily deceived or fooled - too trusting, lacking skepticism." },
    { id: 249, name: "haggard", description: "Looking exhausted and worn - appearance showing the effects of stress, illness, or worry." },
    { id: 250, name: "harassed", description: "Persistently bothered or attacked - under pressure from ongoing unwanted attention." },
    { id: 251, name: "hard", description: "Tough, unyielding, or harsh - lacking softness, gentleness, or flexibility." },
    { id: 252, name: "hardened", description: "Made hard through experience - defenses calcified, heart closed." },
    { id: 253, name: "harsh", description: "Rough and severe - lacking gentleness or kindness in treatment or judgment." },
    { id: 254, name: "hasty", description: "Moving too fast without care - rushing in ways that cause problems." },
    { id: 255, name: "hateful", description: "Full of hate - intense dislike and ill will, wanting harm to come to others." },
    { id: 256, name: "hatred", description: "The emotion of hate itself - intense animosity and desire for destruction or harm." },
    { id: 257, name: "haughty", description: "Arrogantly superior - looking down on others from assumed high position." },
    { id: 258, name: "haunted", description: "Troubled by persistent memories or guilt - something from the past won't let you go." },
    { id: 259, name: "heartbroken", description: "Heart shattered by loss or rejection - the deep wound of love disappointed or destroyed." },
    { id: 260, name: "heartless", description: "Without compassion or feeling - cold and cruel, unmoved by others' suffering." },
    { id: 261, name: "helpless", description: "Unable to help yourself - powerless, dependent, lacking capacity to change situation." },
    { id: 262, name: "hesitant", description: "Holding back, reluctant to proceed - uncertain, waiting, not fully committed." },
    { id: 263, name: "hindered", description: "Blocked or slowed in progress - obstacles preventing forward movement." },
    { id: 264, name: "hitting", description: "The energy of striking out - physically or emotionally attacking." },
    { id: 265, name: "hopeless", description: "Without hope - no expectation of improvement, trapped in despair." },
    { id: 266, name: "horrible", description: "Extremely bad or frightening - causing horror, deeply unpleasant." },
    { id: 267, name: "horrified", description: "Shocked and disgusted - reacting to something terrible with fear and revulsion." },
    { id: 268, name: "hostile", description: "Unfriendly and aggressive - opposing, attacking, or unwelcoming." },
    { id: 269, name: "hot-headed", description: "Quick to anger - easily provoked, reactive, lacking cool restraint." },
    { id: 270, name: "humiliated", description: "Deeply shamed and degraded - dignity destroyed through public exposure or treatment." },
    { id: 271, name: "hungry", description: "Wanting or lacking nourishment - physical hunger or deeper need for something missing." },
    { id: 272, name: "hurried", description: "Rushed and pressured by time - not enough time to do things properly." },
    { id: 273, name: "hurt", description: "In pain - wounded physically, emotionally, or both by what has happened." },
    { id: 274, name: "hurtful", description: "Causing hurt to others - words or actions that wound." },
    { id: 275, name: "hypocritical", description: "Saying one thing while doing another - pretending to values you don't actually hold." },
    { id: 276, name: "hysterical", description: "Uncontrolled emotional excess - overwhelmed beyond capacity to self-regulate." },
    { id: 277, name: "ignorant", description: "Lacking knowledge or awareness - not knowing what you should or could know." },
    { id: 278, name: "immature", description: "Not fully developed - childish or undeveloped in ways inappropriate to your age." },
    { id: 279, name: "immobile", description: "Unable to move - stuck, frozen, physically or emotionally paralyzed." },
    { id: 280, name: "immobilized", description: "Rendered unable to move - trapped or frozen by fear, shock, or circumstance." },
    { id: 281, name: "impaired", description: "Functioning diminished - not working at full capacity due to damage or limitation." },
    { id: 282, name: "impatient", description: "Unable to wait or tolerate delay - wanting things to happen now, frustrated by slowness." },
    { id: 283, name: "impotent", description: "Powerless, unable to act effectively - lacking strength or ability to make things happen." },
    { id: 284, name: "impoverished", description: "Lacking resources - poor in money, spirit, or options." },
    { id: 285, name: "imprisoned", description: "Locked up, confined - freedom taken away, trapped within walls." },
    { id: 286, name: "impulsive", description: "Acting without thinking - driven by sudden urges without consideration of consequences." },
    { id: 287, name: "in a bind", description: "Caught in a difficult situation - constrained, with no good options available." },
    { id: 288, name: "in hell", description: "Experiencing extreme suffering - tormented, as if in a place of punishment." },
    { id: 289, name: "inadequate", description: "Not sufficient or capable enough - falling short of what's needed or expected." },
    { id: 290, name: "incapable", description: "Unable to do something - lacking the capacity, skill, or power required." },
    { id: 291, name: "incapacitated", description: "Rendered unable to function - disabled by injury, illness, or overwhelm." },
    { id: 292, name: "incensed", description: "Extremely angry - fury ignited by offense or injustice." },
    { id: 293, name: "incompetent", description: "Lacking ability to do the job - unable to perform adequately." },
    { id: 294, name: "inconsiderate", description: "Not thinking about others - lacking care for how your actions affect people." },
    { id: 295, name: "inconsistent", description: "Not steady or reliable - changing unpredictably, contradicting yourself." },
    { id: 296, name: "indecisive", description: "Unable to make decisions - paralyzed by choice, going back and forth." },
    { id: 297, name: "indignant", description: "Righteously angry at unfair treatment - feeling you deserve better." },
    { id: 298, name: "ineffective", description: "Not producing desired results - efforts failing to achieve goals." },
    { id: 299, name: "inefficient", description: "Wasting time or resources - not getting good results from effort expended." },
    { id: 300, name: "inept", description: "Lacking skill or competence - clumsy and ineffective in attempts." },
    { id: 301, name: "inferior", description: "Lower in quality or status - not as good as others, less than." },
    { id: 302, name: "inflexible", description: "Unable or unwilling to bend - rigid, stuck in patterns or positions." },
    { id: 303, name: "infuriated", description: "Made extremely angry - rage provoked by offense or frustration." },
    { id: 304, name: "inhibited", description: "Held back from expression - restrained by fear, shame, or social pressure." },
    { id: 305, name: "injured", description: "Hurt or damaged - wounded in body, feelings, or position." },
    { id: 306, name: "insecure", description: "Lacking confidence or stability - uncertain of self, afraid of failure or rejection." },
    { id: 307, name: "insensitive", description: "Not aware of or responsive to others' feelings - lacking empathy or care." },
    { id: 308, name: "insignificant", description: "Unimportant, not mattering - too small to count or be noticed." },
    { id: 309, name: "insincere", description: "Not genuine or honest - saying what you don't mean, pretending." },
    { id: 310, name: "insulted", description: "Dignity offended by disrespect - hurt by words or treatment meant to demean." },
    { id: 311, name: "insulting", description: "Being disrespectful to others - words or behavior that demean." },
    { id: 312, name: "intimidated", description: "Frightened into compliance - made afraid by threat or imposing presence." },
    { id: 313, name: "intolerant", description: "Unable to accept difference - rejecting what doesn't fit your standards or beliefs." },
    { id: 314, name: "invaded", description: "Boundaries violated by intrusion - personal space or privacy breached." },
    { id: 315, name: "irate", description: "Very angry - intense irritation that demands expression." },
    { id: 316, name: "irresponsible", description: "Not taking proper care of duties - careless about obligations or consequences." },
    { id: 317, name: "irritable", description: "Easily annoyed - quick to become irritated, low tolerance for frustration." },
    { id: 318, name: "irritated", description: "Annoyed and bothered - something is rubbing you the wrong way." },
    { id: 319, name: "isolated", description: "Separated from others - alone, cut off from connection and support." },
    { id: 320, name: "jealous", description: "Afraid of losing what you have to another - or wanting what someone else has." },
    { id: 321, name: "jittery", description: "Nervously jumpy - body and mind restless with anxiety." },
    { id: 322, name: "joyless", description: "Without joy - life lacking pleasure, happiness absent." },
    { id: 323, name: "judgmental", description: "Quick to judge negatively - critical, condemning, finding fault." },
    { id: 324, name: "jumpy", description: "Easily startled - nervous system on high alert, reactive to stimuli." },
    { id: 325, name: "lacking", description: "Not having enough - deficient, missing something needed." },
    { id: 326, name: "left out", description: "Excluded from the group - not invited, not included, on the outside." },
    { id: 327, name: "let down", description: "Disappointed by someone - expectations unmet, trust broken." },
    { id: 328, name: "lifeless", description: "Without energy or vitality - dull, flat, as if the life force has left." },
    { id: 329, name: "limited", description: "Constrained in scope or ability - not free, not fully capable." },
    { id: 330, name: "listless", description: "Lacking energy or enthusiasm - limp, passive, without motivation." },
    { id: 331, name: "livid", description: "Furiously angry - rage so intense it shows in your face." },
    { id: 332, name: "lonely", description: "Painfully alone - lacking desired companionship or connection." },
    { id: 333, name: "lonesome", description: "Sad from being alone - aching for company and connection." },
    { id: 334, name: "longing", description: "Deeply wanting something absent - ache for what is missing or lost." },
    { id: 335, name: "lost", description: "Not knowing where you are or what to do - disoriented, without direction." },
    { id: 336, name: "loud", description: "Too much volume - overwhelming or inappropriate in intensity of expression." },
    { id: 337, name: "lousy", description: "Very poor quality - bad, worthless, not worth anything." },
    { id: 338, name: "low", description: "Down, depressed, lacking elevation - at the bottom of the emotional scale." },
    { id: 339, name: "mad", description: "Angry - emotion ranging from annoyance to fury. Also can mean crazy." },
    { id: 340, name: "malicious", description: "Intending to harm - deliberately cruel, wanting bad things for others." },
    { id: 341, name: "maligned", description: "Spoken ill of unfairly - reputation damaged by others' negative words." },
    { id: 342, name: "manipulated", description: "Controlled through devious means - used through psychological tricks." },
    { id: 343, name: "manipulative", description: "Using devious means to control others - getting your way through psychological tricks." },
    { id: 344, name: "masochistic", description: "Finding pleasure in your own pain - drawn to suffering." },
    { id: 345, name: "materialistic", description: "Focused on possessions and money - valuing things over people or meaning." },
    { id: 346, name: "mean", description: "Unkind and hurtful - deliberately causing pain to others." },
    { id: 347, name: "mean-spirited", description: "Having a cruel disposition - nature inclined to hurt rather than help." },
    { id: 348, name: "melancholy", description: "Deep, persistent sadness - sorrow that colors everything with its mood." },
    { id: 349, name: "menaced", description: "Threatened with harm - feeling endangered by looming danger." },
    { id: 350, name: "mentally deficient", description: "Feeling intellectually inadequate - not able to think as well as needed." },
    { id: 351, name: "miffed", description: "Slightly annoyed - minor irritation or offense taken." },
    { id: 352, name: "minimized", description: "Made to seem smaller or less important - concerns or achievements dismissed." },
    { id: 353, name: "miserable", description: "Very unhappy - suffering, wretched, in a state of misery." },
    { id: 354, name: "miserly", description: "Unwilling to spend or share - hoarding resources, mean with generosity." },
    { id: 355, name: "misgiving", description: "Doubt or worry about something - uneasy feeling that something isn't right." },
    { id: 356, name: "mistreated", description: "Treated badly - handled with less care or respect than you deserve." },
    { id: 357, name: "misunderstood", description: "Not correctly understood - your meaning or intentions misinterpreted." },
    { id: 358, name: "misused", description: "Used incorrectly or exploitatively - applied wrongly or taken advantage of." },
    { id: 359, name: "mixed up", description: "Confused, things jumbled - unable to sort out what's what." },
    { id: 360, name: "moaning", description: "Expressing suffering vocally - the sound of pain or complaint." },
    { id: 361, name: "mocked", description: "Ridiculed, made fun of - laughed at in a way meant to hurt." },
    { id: 362, name: "moody", description: "Subject to unpredictable mood changes - temperament shifting without warning." },
    { id: 363, name: "morose", description: "Sullenly unhappy - gloomy and withdrawn, not responsive to cheer." },
    { id: 364, name: "mortified", description: "Extremely embarrassed - humiliated to the point of wanting to die." },
    { id: 365, name: "mournful", description: "Full of grief - expressing or feeling sorrow and loss." },
    { id: 366, name: "muddled", description: "Confused and unclear - thoughts mixed up, unable to think straight." },
    { id: 367, name: "naive", description: "Lacking worldly experience - innocent in ways that may be charming or dangerous." },
    { id: 368, name: "narrow", description: "Limited in scope or openness - not seeing or accepting the full range." },
    { id: 369, name: "nauseated", description: "Feeling sick to the stomach - either physically or emotionally disgusted." },
    { id: 370, name: "negative", description: "Focused on the bad - seeing problems rather than possibilities, pessimistic." },
    { id: 371, name: "neglected", description: "Not given needed care or attention - overlooked, forgotten, uncared for." },
    { id: 372, name: "neglectful", description: "Failing to give proper care - not attending to responsibilities or others' needs." },
    { id: 373, name: "nervous", description: "Anxiously uneasy - worried, on edge, anticipating difficulty." },
    { id: 374, name: "no energy", description: "Depleted of vitality - too tired to function, nothing left to give." },
    { id: 375, name: "obnoxious", description: "Extremely unpleasant and annoying - offensive in behavior or manner." },
    { id: 376, name: "obsessed", description: "Completely preoccupied with something - unable to stop thinking about it." },
    { id: 377, name: "obsessive", description: "Having the quality of obsession - compulsively focused, unable to let go." },
    { id: 378, name: "obstinate", description: "Stubbornly refusing to change - fixed in position regardless of reason." },
    { id: 379, name: "obstructed", description: "Blocked from progress - path forward prevented by obstacles." },
    { id: 380, name: "off", description: "Not right, not normal - something wrong that's hard to identify." },
    { id: 381, name: "off-kilter", description: "Out of balance - tilted, askew, not properly aligned." },
    { id: 382, name: "offended", description: "Feelings hurt by disrespect - dignity insulted, sensibilities violated." },
    { id: 383, name: "offensive", description: "Causing offense to others - behavior or words that insult or disgust." },
    { id: 384, name: "on edge", description: "Nervously tense - close to losing composure, ready to snap." },
    { id: 385, name: "opposed", description: "Set against something - in resistance or conflict with a position or force." },
    { id: 386, name: "oppositional", description: "Inclined to oppose - tendency to resist or contradict whatever is presented." },
    { id: 387, name: "oppressed", description: "Weighed down by unjust treatment - crushed under power or circumstances." },
    { id: 388, name: "out of sorts", description: "Not feeling right - mildly unwell or upset, off your normal state." },
    { id: 389, name: "outcast", description: "Rejected by society or group - pushed out, not belonging anywhere." },
    { id: 390, name: "outraged", description: "Extremely angry at injustice - righteous fury at wrongdoing." },
    { id: 391, name: "overbearing", description: "Dominating and overwhelming - pushing others down with forceful presence." },
    { id: 392, name: "overlooked", description: "Not noticed or considered - passed over, missed, ignored." },
    { id: 393, name: "oversensitive", description: "Too easily hurt or offended - reactive beyond what situations warrant." },
    { id: 394, name: "overwhelmed", description: "Unable to cope with the amount - flooded beyond capacity to handle." },
    { id: 395, name: "overworked", description: "Working too hard or too much - exhausted by excessive labor." },
    { id: 396, name: "overwrought", description: "Extremely agitated, nervous, or upset - emotionally stretched to the breaking point. Often from prolonged stress without relief." },
    { id: 397, name: "pained", description: "Experiencing pain - hurt, distressed, showing or feeling suffering." },
    { id: 398, name: "panicked", description: "In a state of panic - overwhelming fear that prevents clear thinking." },
    { id: 399, name: "panicky", description: "Prone to or experiencing panic - easily thrown into terror and confusion." },
    { id: 400, name: "paralyzed", description: "Unable to move or act - frozen by fear, shock, or overwhelm." },
    { id: 401, name: "paranoid", description: "Irrationally suspicious - believing others intend harm without evidence." },
    { id: 402, name: "pathetic", description: "Evoking pity, often with contempt - inadequate in a way that's sad to see." },
    { id: 403, name: "peculiar", description: "Strange or odd - different in ways that may feel uncomfortable." },
    { id: 404, name: "perfectionistic", description: "Demanding perfection - unable to accept anything less than ideal." },
    { id: 405, name: "perplexed", description: "Completely baffled - unable to understand something confusing." },
    { id: 406, name: "persecuted", description: "Subjected to prolonged cruel treatment - targeted for harm." },
    { id: 407, name: "perturbed", description: "Disturbed and bothered - inner peace unsettled by something troubling." },
    { id: 408, name: "pessimistic", description: "Expecting the worst - negative outlook anticipating bad outcomes." },
    { id: 409, name: "petrified", description: "Terrified to immobility - so frightened you can't move or think." },
    { id: 410, name: "phobic", description: "Having irrational fears - intense anxiety triggered by specific things." },
    { id: 411, name: "phony", description: "Not genuine - fake, pretending, lacking authenticity." },
    { id: 412, name: "pitiful", description: "Deserving or arousing pity - sad, inadequate, pathetically poor." },
    { id: 413, name: "poisonous", description: "Toxic in effect - harmful, corrupting, damaging to what it touches." },
    { id: 414, name: "powerless", description: "Without power to affect anything - helpless, unable to make things happen." },
    { id: 415, name: "prejudiced", description: "Pre-judging based on bias - unfair opinions formed without evidence." },
    { id: 416, name: "preoccupied", description: "Absorbed in thoughts - mind elsewhere, not present to what's happening." },
    { id: 417, name: "pressured", description: "Under stress to perform - feeling pushed by deadlines or expectations." },
    { id: 418, name: "provoked", description: "Stimulated to reaction - pushed into anger or action by another." },
    { id: 419, name: "punished", description: "Receiving punishment - suffering consequences for wrongdoing, real or perceived." },
    { id: 420, name: "punishing", description: "Inflicting punishment on others - making them suffer for wrongs." },
    { id: 421, name: "puny", description: "Small and weak - insignificant, lacking power or size." },
    { id: 422, name: "pushed", description: "Pressured or forced - made to move against your will or pace." },
    { id: 423, name: "pushy", description: "Aggressively pressing forward - demanding and intrusive." },
    { id: 424, name: "put down", description: "Criticized or belittled - made to feel inferior through words or treatment." },
    { id: 425, name: "puzzled", description: "Unable to understand - confused by something that doesn't make sense." },
    { id: 426, name: "quarrelsome", description: "Inclined to argue and fight - looking for conflict, easily provoked." },
    { id: 427, name: "ranting", description: "Speaking at length with excessive emotion - venting anger through words." },
    { id: 428, name: "rattled", description: "Shaken and unsettled - disturbed from normal composure." },
    { id: 429, name: "reactive", description: "Quick to react without thinking - responsive in ways driven by triggers rather than choice." },
    { id: 430, name: "rebellious", description: "Resisting authority or convention - defiant, refusing to comply." },
    { id: 431, name: "recoiling", description: "Drawing back in horror or disgust - shrinking away from something repellent." },
    { id: 432, name: "regretful", description: "Wishing something had been different - sorry for past actions or failures." },
    { id: 433, name: "rejected", description: "Refused or turned away - not accepted, pushed out or excluded." },
    { id: 434, name: "remorseful", description: "Deeply regretting wrongdoing - pained conscience for harm caused." },
    { id: 435, name: "remote", description: "Distant and unreachable - far away emotionally or physically." },
    { id: 436, name: "reprimanding", description: "Expressing sharp disapproval - correcting or scolding for wrongdoing." },
    { id: 437, name: "reproved", description: "Officially disapproved or criticized - corrected for misbehavior." },
    { id: 438, name: "repulsed", description: "Disgusted and pushed away - strong aversion to something offensive." },
    { id: 439, name: "repulsive", description: "Causing disgust - extremely unpleasant, making others want to turn away." },
    { id: 440, name: "resentful", description: "Bitter about perceived unfairness - holding onto anger about mistreatment." },
    { id: 441, name: "reserved", description: "Holding back, not fully expressing - keeping emotions or thoughts private." },
    { id: 442, name: "resistant", description: "Opposing or fighting against - not yielding, maintaining position against pressure." },
    { id: 443, name: "responsible", description: "Carrying weight of accountability - may feel burdened by duty or blamed for problems." },
    { id: 444, name: "restless", description: "Unable to rest or be still - driven to move, unsettled, needing change." },
    { id: 445, name: "restrained", description: "Held back, controlled - not free to act or express fully." },
    { id: 446, name: "restricted", description: "Limited in freedom or range - constrained, not allowed full scope." },
    { id: 447, name: "retaliating", description: "Striking back after being hurt - revenge, paying back harm with harm." },
    { id: 448, name: "revengeful", description: "Wanting revenge - focused on getting back at those who hurt you." },
    { id: 449, name: "ridiculed", description: "Made fun of cruelly - mocked in ways meant to humiliate." },
    { id: 450, name: "rigid", description: "Stiff and inflexible - unable or unwilling to bend or adapt." },
    { id: 451, name: "risky", description: "In danger or taking chances - exposed to potential harm or loss." },
    { id: 452, name: "robotic", description: "Moving mechanically without feeling - automatic, disconnected from emotion." },
    { id: 453, name: "rotten", description: "Morally corrupt or feeling very bad - decayed, worthless, sick." },
    { id: 454, name: "rude", description: "Lacking manners or respect - offensive in treatment of others." },
    { id: 455, name: "ruined", description: "Destroyed, damaged beyond repair - life or situation devastated." },
    { id: 456, name: "rushed", description: "Hurried without adequate time - pressured by urgency." },
    { id: 457, name: "ruthless", description: "Without mercy or compassion - willing to cause harm to achieve goals." },
    { id: 458, name: "sad", description: "The basic emotion of unhappiness - heart heavy, spirits low." },
    { id: 459, name: "sadistic", description: "Enjoying others' pain - taking pleasure in cruelty." },
    { id: 460, name: "sarcastic", description: "Using irony to mock or wound - words that mean the opposite and cut." },
    { id: 461, name: "scared", description: "Frightened - fear activated by threat, body on alert." },
    { id: 462, name: "scattered", description: "Dispersed, not together - thoughts, energy, or attention fragmented." },
    { id: 463, name: "scoffed at", description: "Dismissed with contempt - mocked as unworthy of serious consideration." },
    { id: 464, name: "scolding", description: "Criticizing angrily - reprimanding someone for their behavior." },
    { id: 465, name: "scorned", description: "Treated with contempt - looked down upon, despised." },
    { id: 466, name: "scornful", description: "Expressing contempt - looking down on others with disdain." },
    { id: 467, name: "screaming", description: "Shouting at high volume - expressing intense emotion through voice." },
    { id: 468, name: "secretive", description: "Hiding information - keeping things private that perhaps shouldn't be." },
    { id: 469, name: "seething", description: "Boiling with suppressed anger - rage building beneath the surface." },
    { id: 470, name: "self-absorbed", description: "Completely focused on yourself - unable to see or care about others." },
    { id: 471, name: "self-castigating", description: "Punishing yourself harshly - severe self-criticism and blame." },
    { id: 472, name: "self-conscious", description: "Uncomfortably aware of yourself - worried about how you appear to others." },
    { id: 473, name: "self-critical", description: "Judging yourself harshly - focusing on your faults and failures." },
    { id: 474, name: "self-denigrating", description: "Putting yourself down - dismissing your worth and value." },
    { id: 475, name: "self-deprecating", description: "Undervaluing yourself - making yourself seem less than you are." },
    { id: 476, name: "self-hating", description: "Turning hate toward yourself - deep rejection of who you are." },
    { id: 477, name: "serious", description: "Solemn and grave - lacking lightness, heavy with importance." },
    { id: 478, name: "shaky", description: "Trembling, unstable - literally or figuratively not steady." },
    { id: 479, name: "shallow", description: "Lacking depth - superficial, not engaging with deeper levels." },
    { id: 480, name: "shameful", description: "Deserving or causing shame - something to hide and be embarrassed by." },
    { id: 481, name: "sharp", description: "Cutting, harsh - pointed in ways that wound." },
    { id: 482, name: "shocked", description: "Suddenly disturbed by unexpected event - system jolted by surprise." },
    { id: 483, name: "short-tempered", description: "Quick to anger - low threshold for frustration." },
    { id: 484, name: "shot down", description: "Rejected or defeated suddenly - ideas or efforts killed quickly." },
    { id: 485, name: "shrill", description: "High-pitched and piercing - harsh voice that grates." },
    { id: 486, name: "shunned", description: "Deliberately avoided by others - socially rejected, ostracized." },
    { id: 487, name: "shut down", description: "Closed off, not functioning - emotionally or mentally offline." },
    { id: 488, name: "shy", description: "Nervously reserved around others - holding back from social engagement." },
    { id: 489, name: "sick", description: "Unwell, unhealthy - physically ill or emotionally disturbed." },
    { id: 490, name: "sinful", description: "Feeling guilty of moral wrong - marked by transgression against values." },
    { id: 491, name: "slammed", description: "Hit hard - criticized severely or physically struck." },
    { id: 492, name: "slandered", description: "Reputation damaged by false statements - lied about publicly." },
    { id: 493, name: "slighted", description: "Treated as unimportant - disrespected through neglect or dismissal." },
    { id: 494, name: "slouching", description: "Body collapsed, posture poor - physically expressing defeat or low energy." },
    { id: 495, name: "slow", description: "Moving or thinking below normal speed - behind, not keeping up." },
    { id: 496, name: "sluggish", description: "Slow and heavy - lacking energy, dragging through tasks." },
    { id: 497, name: "slumped", description: "Collapsed in posture - body showing defeat or exhaustion." },
    { id: 498, name: "small", description: "Feeling insignificant or inadequate - diminished, less than others." },
    { id: 499, name: "smothered", description: "Overwhelmed by too much attention or control - unable to breathe freely." },
    { id: 500, name: "smug", description: "Self-satisfied in an annoying way - pleased with yourself in a way that irritates others." },
    { id: 501, name: "sorrowful", description: "Full of sorrow - deep sadness, grieving heart." },
    { id: 502, name: "sour", description: "Bitter and unpleasant - disposition turned negative, not sweet." },
    { id: 503, name: "spiteful", description: "Deliberately hurtful - wanting to cause pain out of malice." },
    { id: 504, name: "squirming", description: "Wriggling with discomfort - trying to escape uncomfortable situation." },
    { id: 505, name: "stagnant", description: "Not moving or developing - stuck, without growth or change." },
    { id: 506, name: "stern", description: "Severe and uncompromising - strict, not showing warmth." },
    { id: 507, name: "stiff", description: "Rigid, not flexible - body or manner lacking natural ease." },
    { id: 508, name: "stifled", description: "Suppressed, unable to express - feeling smothered or held down." },
    { id: 509, name: "stilted", description: "Awkward and unnatural - forced, not flowing freely." },
    { id: 510, name: "stingy", description: "Unwilling to give or share - mean with resources or affection." },
    { id: 511, name: "stonewalling", description: "Emotionally shutting down and refusing to engage. A protective withdrawal that creates walls between self and others." },
    { id: 512, name: "stony", description: "Hard and unresponsive - like stone, showing no feeling." },
    { id: 513, name: "stressed", description: "Under pressure that strains - tension from demands exceeding capacity." },
    { id: 514, name: "stubborn", description: "Refusing to change or yield - obstinate adherence to position." },
    { id: 515, name: "stuck", description: "Unable to move forward - trapped in position or situation." },
    { id: 516, name: "stumped", description: "Unable to figure out - mentally blocked by a problem." },
    { id: 517, name: "stupid", description: "Feeling unintelligent - dumb, unable to think properly." },
    { id: 518, name: "suffering", description: "In a state of pain or distress - enduring something difficult." },
    { id: 519, name: "suicidal", description: "Thinking of or wanting to end your life - dangerously desperate." },
    { id: 520, name: "sulky", description: "Silently resentful - pouting, not speaking, showing displeasure." },
    { id: 521, name: "sullen", description: "Gloomily silent and resentful - darkly withdrawn." },
    { id: 522, name: "superficial", description: "Only on the surface - lacking depth or genuine substance." },
    { id: 523, name: "superior", description: "Believing yourself better than others - arrogant sense of being above." },
    { id: 524, name: "suspicious", description: "Distrustful, expecting wrongdoing - wary and watchful for betrayal." },
    { id: 525, name: "swearing", description: "Using profane language - expressing strong emotion through cursing." },
    { id: 526, name: "tactless", description: "Lacking sensitivity in speech - saying things that offend without meaning to." },
    { id: 527, name: "taut", description: "Stretched tight - tense, under strain, not relaxed." },
    { id: 528, name: "tearful", description: "Close to tears or crying - emotional pressure building toward release." },
    { id: 529, name: "temperamental", description: "Subject to mood swings - unpredictable in emotional response." },
    { id: 530, name: "tense", description: "Tight with stress or anxiety - body and mind held rigid." },
    { id: 531, name: "terrible", description: "Extremely bad - very unpleasant, causing distress." },
    { id: 532, name: "terrified", description: "Extreme fear - terror that overwhelms capacity to think or act." },
    { id: 533, name: "territorial", description: "Defending your space or domain - aggressive about boundaries." },
    { id: 534, name: "thoughtless", description: "Not considering consequences or others - careless in words or actions." },
    { id: 535, name: "threatened", description: "Feeling in danger - something is menacing your safety or well-being." },
    { id: 536, name: "thwarted", description: "Prevented from achieving your goal - blocked, frustrated in purpose." },
    { id: 537, name: "ticked off", description: "Annoyed, irritated - somewhat angry about something." },
    { id: 538, name: "tight", description: "Constricted, not loose - held together too firmly, tense." },
    { id: 539, name: "timid", description: "Easily frightened, lacking courage - shy and hesitant in action." },
    { id: 540, name: "tired", description: "Lacking energy, needing rest - weary from exertion or stress." },
    { id: 541, name: "tormented", description: "Suffering severe distress - tortured by pain or worry." },
    { id: 542, name: "tortured", description: "Subjected to extreme pain - agonized, severely suffering." },
    { id: 543, name: "touchy", description: "Easily offended - sensitive to slight, quick to take offense." },
    { id: 544, name: "trapped", description: "Caught with no way out - confined, imprisoned, stuck." },
    { id: 545, name: "trembling", description: "Shaking with fear or cold - body expressing vulnerability or distress." },
    { id: 546, name: "troubled", description: "Worried or disturbed - something wrong is weighing on you." },
    { id: 547, name: "turned off", description: "Repelled, lost interest - something has made you disconnect or disengage." },
    { id: 548, name: "twitching", description: "Involuntary small movements - body showing nervousness or stress." },
    { id: 549, name: "unable", description: "Lacking ability or capacity - can't do what needs to be done." },
    { id: 550, name: "unappreciated", description: "Not valued or thanked - efforts go unnoticed or unacknowledged." },
    { id: 551, name: "unbending", description: "Rigid, refusing to flex - unwilling to compromise or adapt." },
    { id: 552, name: "uncaring", description: "Without care for others - indifferent to their needs or feelings." },
    { id: 553, name: "uncertain", description: "Not sure, lacking confidence - unsure about what's true or right." },
    { id: 554, name: "uncomfortable", description: "Not at ease - something isn't right, causing unease." },
    { id: 555, name: "undecided", description: "Unable to make up your mind - wavering between options." },
    { id: 556, name: "undesirable", description: "Not wanted - feeling rejected or unappealing." },
    { id: 557, name: "undisciplined", description: "Lacking self-control - unable to regulate behavior or impulses." },
    { id: 558, name: "uneasy", description: "Mildly anxious or uncomfortable - something feels off or worrying." },
    { id: 559, name: "unfair", description: "Treated unjustly - not given equal or deserved treatment." },
    { id: 560, name: "unforgivable", description: "Feeling you've done something that cannot be forgiven - beyond redemption." },
    { id: 561, name: "unforgiving", description: "Unable or unwilling to forgive - holding onto grievances." },
    { id: 562, name: "unfriendly", description: "Not warm or welcoming - cold, distant, perhaps hostile." },
    { id: 563, name: "unhappy", description: "Not happy - dissatisfied, sad, discontent with life or situation." },
    { id: 564, name: "unimportant", description: "Not mattering - feeling insignificant, dismissed as irrelevant." },
    { id: 565, name: "uninterested", description: "Lacking interest - bored, not engaged, not caring." },
    { id: 566, name: "unmindful", description: "Not paying attention - careless, unaware of what matters." },
    { id: 567, name: "unorganized", description: "Lacking order or structure - chaotic, unable to arrange properly." },
    { id: 568, name: "unpleasant", description: "Not pleasant - disagreeable, uncomfortable, not enjoyable." },
    { id: 569, name: "unprotected", description: "Without protection - vulnerable, exposed to harm." },
    { id: 570, name: "unreasonable", description: "Not guided by reason - irrational, unfair in demands or expectations." },
    { id: 571, name: "unresponsive", description: "Not responding - shut down, not reacting to stimuli or communication." },
    { id: 572, name: "unsettled", description: "Not at peace - disturbed, unable to find stability." },
    { id: 573, name: "unsure", description: "Not confident - doubting, uncertain about decisions or self." },
    { id: 574, name: "unthankful", description: "Not grateful - taking things for granted, not appreciating what's given." },
    { id: 575, name: "unwanted", description: "Not desired - feeling rejected, not welcome." },
    { id: 576, name: "unwelcoming", description: "Not inviting or hospitable - creating environment that discourages approach." },
    { id: 577, name: "unwise", description: "Lacking wisdom - making foolish choices, not thinking well." },
    { id: 578, name: "unworthy", description: "Not deserving of value or respect - inferior, not good enough." },
    { id: 579, name: "upset", description: "Disturbed and unhappy - emotional equilibrium disrupted." },
    { id: 580, name: "uptight", description: "Tense and anxious - rigid, unable to relax." },
    { id: 581, name: "used", description: "Exploited by others - taken advantage of for their benefit." },
    { id: 582, name: "useless", description: "Without use or value - unable to contribute or matter." },
    { id: 583, name: "vengeful", description: "Seeking revenge - focused on paying back harm with harm." },
    { id: 584, name: "venomous", description: "Poisonous, full of spite - words or energy that intend harm." },
    { id: 585, name: "vexed", description: "Annoyed and frustrated - irritated by something troublesome." },
    { id: 586, name: "vicious", description: "Deliberately cruel - savage, wanting to cause harm." },
    { id: 587, name: "victimized", description: "Treated as a victim - harmed, exploited, or taken advantage of." },
    { id: 588, name: "vindictive", description: "Seeking revenge - wanting to hurt those who hurt you." },
    { id: 589, name: "violated", description: "Boundaries breached - sacred space invaded, integrity compromised." },
    { id: 590, name: "violent", description: "Using or prone to physical force - aggressive energy that destroys." },
    { id: 591, name: "vulnerable", description: "Open to being hurt - exposed, undefended, at risk." },
    { id: 592, name: "wanton", description: "Reckless and irresponsible - wild, without restraint or consideration." },
    { id: 593, name: "wary", description: "Cautiously watchful - alert to potential danger." },
    { id: 594, name: "washed up", description: "Finished, no longer effective - past your prime, used up." },
    { id: 595, name: "wasted", description: "Depleted, ruined - potential squandered, resources exhausted." },
    { id: 596, name: "weak", description: "Lacking strength - unable to exert power or resist pressure." },
    { id: 597, name: "weary", description: "Tired to the bone - exhausted by sustained effort or worry." },
    { id: 598, name: "weepy", description: "Prone to crying - tears close to the surface, easily triggered." },
    { id: 599, name: "withdrawn", description: "Pulled back from engagement - retreated, not participating." },
    { id: 600, name: "woozy", description: "Dizzy and unsteady - disoriented, not clear-headed." },
    { id: 601, name: "worried", description: "Anxious about possibilities - mind focused on what could go wrong." },
    { id: 602, name: "worthless", description: "Without any value - completely inferior, not worth anything." },
    { id: 603, name: "wounded", description: "Hurt, injured - carrying damage from what has happened." },
    { id: 604, name: "wrong", description: "Incorrect, mistaken - or feeling like something is fundamentally not right." },
    { id: 605, name: "wronged", description: "Treated unjustly - harmed by another's unfair action." },
    { id: 606, name: "yearning", description: "Deep longing for something absent - aching desire for what is not here." },
    { id: 607, name: "yelling", description: "Raising voice in anger or urgency - loud expression of strong emotion." },
    { id: 608, name: "able", description: "Having the capacity to do what's needed - competent, capable, empowered to act." },
    { id: 609, name: "absolved", description: "Released from guilt or blame - forgiven, cleared of wrongdoing." },
    { id: 610, name: "absorbed", description: "Completely engaged and focused - immersed in activity or interest." },
    { id: 611, name: "abundant", description: "Having plenty - rich in resources, opportunities, or blessings." },
    { id: 612, name: "acceptable", description: "Good enough, meeting standards - worthy of being accepted." },
    { id: 613, name: "accepted", description: "Received and included - welcomed as you are, belonging." },
    { id: 614, name: "accepting", description: "Embracing what is - allowing without resistance or judgment." },
    { id: 615, name: "accommodating", description: "Willing to adjust for others - flexible, helpful, making room." },
    { id: 616, name: "accomplished", description: "Having achieved something significant - skilled, successful, proven." },
    { id: 617, name: "accountable", description: "Taking responsibility - owning your actions and their consequences." },
    { id: 618, name: "achieving", description: "In the process of reaching goals - making progress, succeeding." },
    { id: 619, name: "active", description: "Engaged in action - doing, moving, participating in life." },
    { id: 620, name: "adaptable", description: "Able to adjust to new conditions - flexible, responsive to change." },
    { id: 621, name: "adequate", description: "Sufficient for the purpose - enough, meeting requirements." },
    { id: 622, name: "admirable", description: "Worthy of admiration - impressive, deserving respect." },
    { id: 623, name: "admired", description: "Receiving admiration from others - respected, looked up to." },
    { id: 624, name: "adored", description: "Deeply loved - cherished, treasured, held in highest affection." },
    { id: 625, name: "adversarial", description: "In opposition but with vigor - competitive energy that challenges." },
    { id: 626, name: "affluent", description: "Wealthy, having abundance - rich in resources and comfort." },
    { id: 627, name: "agreeable", description: "Pleasant and easy to get along with - harmonious, willing." },
    { id: 628, name: "alert", description: "Awake and attentive - mentally sharp, ready to respond." },
    { id: 629, name: "altruistic", description: "Selflessly concerned for others - giving without expectation of return." },
    { id: 630, name: "ambitious", description: "Driven to achieve - motivated by goals and desire for success." },
    { id: 631, name: "amused", description: "Finding something funny or entertaining - pleasantly diverted." },
    { id: 632, name: "analytical", description: "Thinking in systematic, logical ways - examining carefully." },
    { id: 633, name: "appreciated", description: "Valued and recognized - your worth acknowledged by others." },
    { id: 634, name: "appreciative", description: "Feeling and expressing gratitude - thankful, recognizing value." },
    { id: 635, name: "approved", description: "Accepted as good or right - validated, sanctioned." },
    { id: 636, name: "approving", description: "Giving approval to others - expressing acceptance or validation." },
    { id: 637, name: "assertive", description: "Confidently expressing yourself - standing up for your needs without aggression." },
    { id: 638, name: "assured", description: "Confident and certain - secure in yourself or situation." },
    { id: 639, name: "at ease", description: "Relaxed and comfortable - free from anxiety or tension." },
    { id: 640, name: "attractive", description: "Drawing others toward you - appealing, magnetic, pleasing." },
    { id: 641, name: "attached", description: "Connected and bonded - in healthy relationship with others or life." },
    { id: 642, name: "attentive", description: "Paying close attention - focused, mindful, present." },
    { id: 643, name: "authentic", description: "True to yourself - genuine, not pretending, real." },
    { id: 644, name: "awake", description: "Conscious and alert - aware, not asleep to life." },
    { id: 645, name: "aware", description: "Conscious of what is - perceiving, knowing, mindful." },
    { id: 646, name: "awesome", description: "Inspiring awe - amazing, wonderful, impressive." },
    { id: 647, name: "balanced", description: "In equilibrium - stable, centered, not extreme." },
    { id: 648, name: "beautiful", description: "Feeling or experiencing beauty - aesthetic appreciation, inner or outer loveliness." },
    { id: 649, name: "believing", description: "Having faith or conviction - trusting in something beyond evidence." },
    { id: 650, name: "blessed", description: "Favored with good fortune - graced, fortunate, touched by something sacred." },
    { id: 651, name: "blissful", description: "In a state of perfect happiness - serene joy, heavenly contentment." },
    { id: 652, name: "bonded", description: "Connected deeply with others - attached, united, in relationship." },
    { id: 653, name: "brave", description: "Courageous in facing difficulty - willing to act despite fear." },
    { id: 654, name: "bright", description: "Full of light and intelligence - smart, cheerful, shining." },
    { id: 655, name: "brilliant", description: "Exceptionally intelligent or talented - shining with excellence." },
    { id: 656, name: "calm", description: "Peaceful and undisturbed - tranquil, serene, not agitated." },
    { id: 657, name: "capable", description: "Having ability and competence - able to handle what comes." },
    { id: 658, name: "captivated", description: "Completely fascinated - attention held by something compelling." },
    { id: 659, name: "cared for", description: "Receiving care from others - nurtured, looked after, loved." },
    { id: 660, name: "carefree", description: "Without worry or responsibility - light, unburdened, easy." },
    { id: 661, name: "careful", description: "Taking care and attention - thoughtful, cautious, mindful." },
    { id: 662, name: "caring", description: "Feeling and showing concern for others - compassionate, nurturing." },
    { id: 663, name: "cautious", description: "Proceeding carefully - prudent, watchful, avoiding unnecessary risk." },
    { id: 664, name: "centered", description: "Grounded in your core - balanced, stable, connected to inner self." },
    { id: 665, name: "certain", description: "Sure and confident - clear about what you know or want." },
    { id: 666, name: "cheerful", description: "Happy and optimistic - bright mood, spreading lightness." },
    { id: 667, name: "cherished", description: "Held dear and valued - treasured, precious to others." },
    { id: 668, name: "clean", description: "Pure, uncontaminated - fresh, clear, without dirt or shame." },
    { id: 669, name: "clear", description: "Mentally sharp and unconfused - thinking is transparent, vision is unobstructed." },
    { id: 670, name: "collected", description: "Calm and composed - together, not scattered or overwhelmed." },
    { id: 671, name: "comfortable", description: "At ease, without discomfort - relaxed, content with conditions." },
    { id: 672, name: "comforted", description: "Soothed and consoled - receiving comfort that eases distress." },
    { id: 673, name: "committed", description: "Dedicated to a purpose or relationship - loyal, determined, invested." },
    { id: 674, name: "compassionate", description: "Feeling with others' suffering - moved to care and help." },
    { id: 675, name: "complete", description: "Whole and finished - lacking nothing, fully realized." },
    { id: 676, name: "composed", description: "Calm and self-controlled - together, not thrown off." },
    { id: 677, name: "comprehending", description: "Understanding fully - grasping meaning and significance." },
    { id: 678, name: "confident", description: "Trusting in yourself - certain of your abilities and worth." },
    { id: 679, name: "congruent", description: "When inner experience matches outer expression - alignment between what you feel, think, say, and do. Authentic wholeness." },
    { id: 680, name: "connected", description: "In relationship with others or life - linked, belonging, not isolated." },
    { id: 681, name: "conscious", description: "Aware and awake - knowing what is happening, present." },
    { id: 682, name: "constant", description: "Steady and unchanging - reliable, faithful, persistent." },
    { id: 683, name: "content", description: "Satisfied with what is - at peace, not needing more." },
    { id: 684, name: "cooperative", description: "Working well with others - collaborative, team-oriented." },
    { id: 685, name: "courageous", description: "Acting despite fear - brave, willing to face difficulty." },
    { id: 686, name: "creative", description: "Generating new ideas or expressions - innovative, imaginative." },
    { id: 687, name: "credible", description: "Believable and trustworthy - worthy of being believed." },
    { id: 688, name: "curious", description: "Eager to learn and explore - questioning, interested, open." },
    { id: 689, name: "daring", description: "Bold and willing to take risks - adventurous, courageous." },
    { id: 690, name: "decisive", description: "Able to make decisions - clear, determined, not wavering." },
    { id: 691, name: "defended", description: "Protected from harm - safe, guarded, shielded." },
    { id: 692, name: "delighted", description: "Very pleased and happy - joy sparked by something wonderful." },
    { id: 693, name: "dependable", description: "Reliable and trustworthy - can be counted on consistently." },
    { id: 694, name: "desirable", description: "Wanted and attractive - worth pursuing, appealing." },
    { id: 695, name: "dignified", description: "Having dignity and self-respect - noble, worthy, composed." },
    { id: 696, name: "discerning", description: "Having good judgment - able to distinguish quality and truth." },
    { id: 697, name: "disciplined", description: "Self-controlled and organized - able to follow through on intentions." },
    { id: 698, name: "distinguished", description: "Standing out with excellence - notable, respected, eminent." },
    { id: 699, name: "dutiful", description: "Faithfully fulfilling obligations - responsible, conscientious." },
    { id: 700, name: "dynamic", description: "Full of energy and change - vital, active, forceful." },
    { id: 701, name: "eager", description: "Enthusiastically wanting - keen, excited to do or have." },
    { id: 702, name: "easy going", description: "Relaxed and flexible - not easily upset, going with flow." },
    { id: 703, name: "eccentric", description: "Unconventional in positive way - unique, interesting, different." },
    { id: 704, name: "ecstatic", description: "Overwhelmed with joy - extreme happiness, blissful rapture." },
    { id: 705, name: "edified", description: "Uplifted through learning or moral instruction. The feeling of being built up, improved, or spiritually nourished." },
    { id: 706, name: "efficient", description: "Working well without waste - effective use of resources and time." },
    { id: 707, name: "elated", description: "Extremely happy - high on joy, lifted up emotionally." },
    { id: 708, name: "elegant", description: "Graceful and refined - beautiful in simplicity and quality." },
    { id: 709, name: "elevated", description: "Raised to higher level - uplifted, improved, enhanced." },
    { id: 710, name: "emancipated", description: "Freed from restriction - liberated, no longer bound." },
    { id: 711, name: "empathic", description: "Able to feel what others feel - sensitive to others' inner states." },
    { id: 712, name: "empowered", description: "Given power and agency - enabled to act effectively." },
    { id: 713, name: "encouraged", description: "Given courage and confidence - supported, inspired to continue." },
    { id: 714, name: "energetic", description: "Full of energy - vital, active, vigorous." },
    { id: 715, name: "energized", description: "Filled with energy - recharged, vitalized, ready to go." },
    { id: 716, name: "enthusiastic", description: "Full of enthusiasm - eager, excited, passionately engaged." },
    { id: 717, name: "euphoric", description: "Intensely happy - extreme positive feeling, elevated joy." },
    { id: 718, name: "exceptional", description: "Unusually excellent - outstanding, beyond normal quality." },
    { id: 719, name: "excited", description: "Emotionally stirred up in positive way - anticipating something good." },
    { id: 720, name: "exhilarated", description: "Thrilled and energized - feeling alive from exciting experience." },
    { id: 721, name: "experienced", description: "Having knowledge from living - wise through what you've been through." },
    { id: 722, name: "expressive", description: "Able to communicate feelings - showing emotions, articulate." },
    { id: 723, name: "extroverted", description: "Energized by social interaction - outgoing, externally focused." },
    { id: 724, name: "exuberant", description: "Overflowing with energy and joy - enthusiastically alive." },
    { id: 725, name: "fair", description: "Just and equitable - treating people with equality and honesty." },
    { id: 726, name: "faithful", description: "Loyal and constant - true to commitments, trustworthy." },
    { id: 727, name: "fantastic", description: "Extraordinarily good - wonderful, amazing, excellent." },
    { id: 728, name: "favored", description: "Preferred and supported - receiving special attention or blessing." },
    { id: 729, name: "firm", description: "Strong and resolute - not easily moved or changed." },
    { id: 730, name: "flexible", description: "Able to adapt and bend - not rigid, responsive to circumstances." },
    { id: 731, name: "flowing", description: "Moving smoothly without obstruction - ease, grace, natural movement." },
    { id: 732, name: "focused", description: "Concentrated and clear - attention gathered on what matters." },
    { id: 733, name: "forceful", description: "Strong and powerful - able to make impact, assertive." },
    { id: 734, name: "forgiven", description: "Released from guilt by another - pardoned, no longer held accountable." },
    { id: 735, name: "fortified", description: "Strengthened and protected - reinforced, more resilient." },
    { id: 736, name: "fortunate", description: "Lucky, blessed by circumstances - favored by fortune." },
    { id: 737, name: "free", description: "Unrestrained and at liberty - able to act, choose, move as you wish." },
    { id: 738, name: "friendly", description: "Warm and welcoming to others - kind, approachable, sociable." },
    { id: 739, name: "fulfilled", description: "Deeply satisfied - needs met, purpose realized, complete." },
    { id: 740, name: "gentle", description: "Soft and kind - not harsh or rough, tender in approach." },
    { id: 741, name: "genuine", description: "Authentic and real - not fake or pretending, true." },
    { id: 742, name: "gifted", description: "Having natural talent - blessed with abilities beyond the ordinary." },
    { id: 743, name: "glad", description: "Happy and pleased - positive feeling about how things are." },
    { id: 744, name: "glowing", description: "Radiating warmth and happiness - shining with positive energy." },
    { id: 745, name: "good", description: "Positive basic state - morally right, pleasant, satisfactory." },
    { id: 746, name: "graceful", description: "Moving and being with elegance - smooth, beautiful, poised." },
    { id: 747, name: "gracious", description: "Kind, courteous, and generous - treating others with grace." },
    { id: 748, name: "grateful", description: "Feeling and expressing thanks - appreciative of what's given." },
    { id: 749, name: "gratified", description: "Satisfied and pleased - desires or needs met." },
    { id: 750, name: "grounded", description: "Stable and connected to earth - centered, not floating away." },
    { id: 751, name: "growing", description: "Developing and expanding - becoming more, learning, evolving." },
    { id: 752, name: "guarded", description: "Protected appropriately - healthy boundaries in place." },
    { id: 753, name: "happy", description: "The basic positive emotion - feeling good, pleased with life." },
    { id: 754, name: "harmonious", description: "In agreement and balance - elements working together well." },
    { id: 755, name: "healed", description: "Wounds repaired - recovered from injury or illness, whole again." },
    { id: 756, name: "helpful", description: "Providing help to others - useful, of service, contributing." },
    { id: 757, name: "heroic", description: "Acting with great courage - brave in the face of difficulty." },
    { id: 758, name: "hesitant", description: "Cautiously pausing - taking time before proceeding, careful." },
    { id: 759, name: "high", description: "Elevated in mood - feeling up, positive, perhaps euphoric." },
    { id: 760, name: "honest", description: "Truthful and sincere - not deceiving, genuine in expression." },
    { id: 761, name: "honourable", description: "Having integrity and high moral standards - worthy of honor." },
    { id: 762, name: "honoured", description: "Receiving honor from others - respected, recognized for worth." },
    { id: 763, name: "hopeful", description: "Expecting good things - optimistic about the future." },
    { id: 764, name: "humble", description: "Not proud or arrogant - modest, aware of limitations." },
    { id: 765, name: "humorous", description: "Finding or creating humor - able to laugh, seeing the funny side." },
    { id: 766, name: "idealistic", description: "Guided by high ideals - striving for what's best." },
    { id: 767, name: "important", description: "Having significance and value - mattering, making a difference." },
    { id: 768, name: "in control", description: "Having power over situation or self - managing effectively." },
    { id: 769, name: "in service", description: "Dedicated to helping others - giving, contributing, serving." },
    { id: 770, name: "included", description: "Part of the group - belonging, not left out." },
    { id: 771, name: "independent", description: "Self-reliant and autonomous - able to function on your own." },
    { id: 772, name: "individualistic", description: "Expressing your unique self - not conforming, being yourself." },
    { id: 773, name: "infatuated", description: "Intensely attracted - passionate fascination, usually romantic." },
    { id: 774, name: "influential", description: "Having impact on others - able to affect opinions and actions." },
    { id: 775, name: "innocent", description: "Free from guilt or wrongdoing - pure, blameless, uncorrupted." },
    { id: 776, name: "inspired", description: "Filled with creative or spiritual energy - moved to create or act." },
    { id: 777, name: "intelligent", description: "Having and using mental ability - smart, clever, understanding." },
    { id: 778, name: "interested", description: "Engaged and curious - attention drawn, wanting to know more." },
    { id: 779, name: "introspective", description: "Looking inward - examining your own thoughts and feelings." },
    { id: 780, name: "invigorated", description: "Filled with energy and vitality - refreshed, strengthened." },
    { id: 781, name: "invincible", description: "Feeling unable to be defeated - unconquerable, powerful." },
    { id: 782, name: "invited", description: "Welcomed and asked to participate - included, wanted." },
    { id: 783, name: "invulnerable", description: "Feeling protected from harm or emotional injury. Can be genuine resilience or a defended state that blocks connection." },
    { id: 784, name: "jovial", description: "Cheerfully friendly - good-humored, jolly, spreading warmth." },
    { id: 785, name: "joyful", description: "Full of joy - deeply happy, delighted, celebrating." },
    { id: 786, name: "jubilant", description: "Triumphantly joyful - celebrating victory or success." },
    { id: 787, name: "judicious", description: "Having good judgment - wise, sensible, making sound decisions." },
    { id: 788, name: "kind", description: "Generous and caring toward others - gentle, helpful, compassionate." },
    { id: 789, name: "learning", description: "In process of gaining knowledge - growing, developing, understanding more." },
    { id: 790, name: "liberated", description: "Set free from constraints - released, emancipated, at liberty." },
    { id: 791, name: "light", description: "Not heavy - free from burden, cheerful, illuminated." },
    { id: 792, name: "light-hearted", description: "Cheerful and carefree - not weighed down by worry." },
    { id: 793, name: "likable", description: "Easy to like - pleasant, appealing, drawing positive response." },
    { id: 794, name: "lively", description: "Full of life and energy - animated, spirited, vibrant." },
    { id: 795, name: "loose", description: "Relaxed and not tense - free, not tight or constricted." },
    { id: 796, name: "loved", description: "Receiving love from others - cherished, cared for, valued." },
    { id: 797, name: "loving", description: "Giving love - caring deeply, expressing affection." },
    { id: 798, name: "loyal", description: "Faithful to commitments and people - true, devoted, steadfast." },
    { id: 799, name: "lucky", description: "Favored by fortune - things going well by chance." },
    { id: 800, name: "magnetic", description: "Drawing others toward you - charismatic, attractive, compelling." },
    { id: 801, name: "marvellous", description: "Causing wonder and delight - wonderful, amazing, extraordinary." },
    { id: 802, name: "masterful", description: "Having mastery and skill - expert, commanding, accomplished." },
    { id: 803, name: "mature", description: "Fully developed - grown up, wise, responsible." },
    { id: 804, name: "mediating", description: "Helping resolve conflict - bridging differences, finding middle ground." },
    { id: 805, name: "meek", description: "Gentle and humble - not aggressive, yielding without weakness." },
    { id: 806, name: "merciful", description: "Showing compassion - forgiving, not punishing when you could." },
    { id: 807, name: "methodical", description: "Organized and systematic - following clear process." },
    { id: 808, name: "mindful", description: "Aware and present - paying attention to now with intention." },
    { id: 809, name: "modest", description: "Not boastful or excessive - humble, unassuming, appropriate." },
    { id: 810, name: "motivated", description: "Driven to act - having reason and energy to pursue goals." },
    { id: 811, name: "neat", description: "Orderly and tidy - organized, clean, well-arranged." },
    { id: 812, name: "noble", description: "Having high moral qualities - honorable, dignified, admirable." },
    { id: 813, name: "observant", description: "Noticing things - attentive, watchful, aware of details." },
    { id: 814, name: "open", description: "Receptive and accessible - not closed, willing to receive or share." },
    { id: 815, name: "open hearted", description: "Having an unguarded heart - loving freely, vulnerable and warm." },
    { id: 816, name: "organized", description: "Arranged in orderly way - structured, efficient, systematic." },
    { id: 817, name: "pacified", description: "Brought to peace - calmed, soothed, conflict resolved." },
    { id: 818, name: "pampered", description: "Treated with special care - indulged, given luxury and attention." },
    { id: 819, name: "pardoned", description: "Forgiven for wrongdoing - released from penalty or guilt." },
    { id: 820, name: "passionate", description: "Feeling intensely - strong emotions driving engagement." },
    { id: 821, name: "patient", description: "Able to wait and endure - calm in the face of delay or difficulty." },
    { id: 822, name: "peaceful", description: "Calm and free from disturbance - serene, tranquil, harmonious." },
    { id: 823, name: "perfect", description: "Without flaw - complete, ideal, exactly right." },
    { id: 824, name: "persevering", description: "Continuing despite difficulty - persistent, not giving up." },
    { id: 825, name: "pleasant", description: "Agreeable and enjoyable - nice, pleasing, comfortable." },
    { id: 826, name: "pleased", description: "Satisfied and happy - glad about how things are." },
    { id: 827, name: "popular", description: "Liked by many - well-regarded, socially successful." },
    { id: 828, name: "positive", description: "Optimistic and constructive - focused on good, affirming." },
    { id: 829, name: "powerful", description: "Having power and strength - able to make things happen." },
    { id: 830, name: "practical", description: "Dealing with real situations - sensible, useful, grounded." },
    { id: 831, name: "praised", description: "Receiving recognition and approval - commended, valued for contribution." },
    { id: 832, name: "precious", description: "Of great value - treasured, irreplaceable, dear." },
    { id: 833, name: "prepared", description: "Ready for what's coming - equipped, organized, anticipating." },
    { id: 834, name: "present", description: "Here now, fully - not lost in past or future, aware." },
    { id: 835, name: "productive", description: "Creating results - effective, getting things done." },
    { id: 836, name: "proficient", description: "Skilled and competent - able to do things well." },
    { id: 837, name: "progressive", description: "Moving forward - advancing, developing, improving." },
    { id: 838, name: "prosperous", description: "Thriving and successful - flourishing, doing well." },
    { id: 839, name: "protected", description: "Safe from harm - guarded, defended, secure." },
    { id: 840, name: "proud", description: "Feeling satisfaction in achievement - self-respect, dignity in what you've done." },
    { id: 841, name: "prudent", description: "Wisely careful - thoughtful about consequences, not rash." },
    { id: 842, name: "punctual", description: "On time - reliable, respecting others' time." },
    { id: 843, name: "purified", description: "Made clean or pure - cleansed of impurities or negativity." },
    { id: 844, name: "purposeful", description: "Having clear purpose - directed, meaningful, intentional." },
    { id: 845, name: "qualified", description: "Having the necessary skills or credentials - capable, certified." },
    { id: 846, name: "quick", description: "Fast and responsive - mentally or physically speedy." },
    { id: 847, name: "quiet", description: "Calm and silent - peaceful, not loud or busy." },
    { id: 848, name: "radiant", description: "Glowing with light or happiness - shining, brilliant, emanating warmth." },
    { id: 849, name: "rational", description: "Guided by reason - logical, sensible, thinking clearly." },
    { id: 850, name: "reasonable", description: "Fair and sensible - not extreme, appropriate." },
    { id: 851, name: "reassured", description: "Confidence restored - concerns addressed, feeling safer." },
    { id: 852, name: "receptive", description: "Open to receiving - welcoming input, ideas, or help." },
    { id: 853, name: "recognized", description: "Acknowledged and seen - your value or contribution noted." },
    { id: 854, name: "redeemed", description: "Saved or restored from fallen state - bought back, made whole." },
    { id: 855, name: "regenerated", description: "Renewed and restored - fresh energy, new life." },
    { id: 856, name: "rejoicing", description: "Feeling and expressing great joy - celebrating, delighting." },
    { id: 857, name: "relaxed", description: "Free from tension - calm, at ease, not stressed." },
    { id: 858, name: "reliable", description: "Can be depended upon - trustworthy, consistent, stable." },
    { id: 859, name: "relieved", description: "Freed from worry or pain - burden lifted, stress released." },
    { id: 860, name: "remembered", description: "Not forgotten - held in others' minds, significant enough to recall." },
    { id: 861, name: "replenished", description: "Refilled and restored - reserves renewed, energy back." },
    { id: 862, name: "resolute", description: "Firmly determined - decided, unwavering in purpose." },
    { id: 863, name: "respected", description: "Held in esteem by others - valued, honored, looked up to." },
    { id: 864, name: "respectful", description: "Showing respect to others - honoring, treating with dignity." },
    { id: 865, name: "responsible", description: "Taking care of duties - accountable, reliable, trustworthy." },
    { id: 866, name: "responsive", description: "Reacting well to others - attentive, quick to answer needs." },
    { id: 867, name: "restored", description: "Brought back to good condition - renewed, repaired, refreshed." },
    { id: 868, name: "revitalized", description: "Given new life and energy - refreshed, renewed, energized." },
    { id: 869, name: "rewarded", description: "Receiving good for good done - compensated, recognized." },
    { id: 870, name: "rooted", description: "Firmly established - grounded, stable, connected to source." },
    { id: 871, name: "satisfied", description: "Needs or desires fulfilled - content, pleased with outcome." },
    { id: 872, name: "secure", description: "Safe and protected - stable, not threatened, confident." },
    { id: 873, name: "self accepting", description: "Embracing yourself as you are - not fighting your nature." },
    { id: 874, name: "self reliant", description: "Able to depend on yourself - independent, capable alone." },
    { id: 875, name: "selfless", description: "Putting others before self - generous, not self-centered." },
    { id: 876, name: "sensational", description: "Causing great interest or excitement - wonderful, amazing." },
    { id: 877, name: "sensible", description: "Having good sense - practical, reasonable, wise." },
    { id: 878, name: "sensitive", description: "Aware of subtle things - responsive to feelings, perceptive." },
    { id: 879, name: "serene", description: "Calm and peaceful - untroubled, tranquil, clear." },
    { id: 880, name: "serenity", description: "The state of being serene - deep peace, undisturbed calm." },
    { id: 881, name: "settled", description: "Resolved and stable - no longer in flux, at rest." },
    { id: 882, name: "sharing", description: "Giving to others - generous, distributing, opening up." },
    { id: 883, name: "simple", description: "Uncomplicated and clear - not complex, straightforward." },
    { id: 884, name: "skillful", description: "Having skill and expertise - competent, able, adept." },
    { id: 885, name: "smooth", description: "Without bumps or difficulties - easy, flowing, polished." },
    { id: 886, name: "soothed", description: "Calmed and comforted - distress eased, pain reduced." },
    { id: 887, name: "spirited", description: "Full of spirit and energy - lively, animated, courageous." },
    { id: 888, name: "splendid", description: "Magnificent and impressive - wonderful, excellent, grand." },
    { id: 889, name: "stable", description: "Steady and not changing - secure, reliable, balanced." },
    { id: 890, name: "steadfast", description: "Firmly loyal and constant - unwavering, dedicated, true." },
    { id: 891, name: "strengthened", description: "Made stronger - reinforced, more powerful or resilient." },
    { id: 892, name: "stimulated", description: "Aroused to activity or interest - engaged, excited, energized." },
    { id: 893, name: "strong", description: "Having strength - powerful, resilient, able to endure." },
    { id: 894, name: "successful", description: "Achieving desired results - accomplishing goals, doing well." },
    { id: 895, name: "supported", description: "Held up by others - helped, encouraged, not alone." },
    { id: 896, name: "sustained", description: "Maintained and kept going - supported over time, nourished." },
    { id: 897, name: "tactful", description: "Skillful in dealing with others - diplomatic, sensitive, careful." },
    { id: 898, name: "teachable", description: "Willing and able to learn - open, humble, receptive to instruction." },
    { id: 899, name: "temperate", description: "Moderate and self-controlled - not extreme, balanced." },
    { id: 900, name: "tenacious", description: "Holding firmly to purpose - persistent, not giving up easily." },
    { id: 901, name: "tender", description: "Soft and gentle - loving, sensitive, easily moved." },
    { id: 902, name: "thankful", description: "Feeling gratitude - appreciative, acknowledging good received." },
    { id: 903, name: "thoughtful", description: "Considerate of others - thinking of their needs, reflective." },
    { id: 904, name: "thrilled", description: "Extremely excited and pleased - delighted, exhilarated." },
    { id: 905, name: "tolerant", description: "Accepting difference - patient with what's different, not rejecting." },
    { id: 906, name: "tranquil", description: "Calm and peaceful - serene, undisturbed, quiet." },
    { id: 907, name: "triumphant", description: "Victorious and celebrating - having overcome, succeeded." },
    { id: 908, name: "trusting", description: "Having trust - believing in others' goodness or reliability." },
    { id: 909, name: "unconcerned", description: "Not worried - free from anxiety about something." },
    { id: 910, name: "understanding", description: "Comprehending and empathizing - getting it, being patient with others." },
    { id: 911, name: "understood", description: "Being comprehended by others - feeling seen and known." },
    { id: 912, name: "undisturbed", description: "Not troubled or interrupted - peaceful, calm, at rest." },
    { id: 913, name: "unhurried", description: "Not rushed - taking time, relaxed pace." },
    { id: 914, name: "unique", description: "One of a kind - special, unlike any other." },
    { id: 915, name: "united", description: "Joined together - connected, in harmony, working as one." },
    { id: 916, name: "unselfish", description: "Not self-centered - generous, considering others." },
    { id: 917, name: "upheld", description: "Supported and maintained - defended, kept up." },
    { id: 918, name: "valiant", description: "Brave and determined - courageous, heroic." },
    { id: 919, name: "valuable", description: "Having worth and importance - precious, significant." },
    { id: 920, name: "valued", description: "Appreciated by others - recognized as having worth." },
    { id: 921, name: "virile", description: "Having masculine strength and energy - vigorous, potent." },
    { id: 922, name: "visionary", description: "Having vision for the future - imaginative, seeing possibilities." },
    { id: 923, name: "vital", description: "Full of life and energy - essential, alive, necessary." },
    { id: 924, name: "warm", description: "Friendly and affectionate - emotionally giving heat and comfort." },
    { id: 925, name: "wealthy", description: "Having abundance of resources - rich, prosperous, well-off." },
    { id: 926, name: "well-meaning", description: "Having good intentions - wanting to do right, kind in purpose." },
    { id: 927, name: "willing", description: "Ready and wanting to do something - agreeable, cooperative." },
    { id: 928, name: "wise", description: "Having wisdom - understanding deeply, making good choices." },
    { id: 929, name: "wonderful", description: "Extremely good, inspiring wonder - amazing, marvelous." },
    { id: 930, name: "worthwhile", description: "Worth the time and effort - meaningful, valuable." },
    { id: 931, name: "worthy", description: "Deserving respect or attention - valuable, meritorious." },
    { id: 932, name: "yielding", description: "Giving way appropriately - flexible, not rigid, surrendering when wise." },
    { id: 933, name: "zealous", description: "Intensely enthusiastic - passionate, fervent, dedicated." }
];

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
    },
    daily: {
        date: null,           // Current date string (YYYY-MM-DD)
        integrateCount: 0,    // Today's integrate completions
        processCount: 0       // Today's process completions
    },
    settings: {
        integrateTarget: 15,  // Daily target (10-50)
        processTarget: 15     // Daily target (10-50)
    }
};

// Level definitions for gamification
const INTEGRATE_LEVELS = [
    { level: 1, name: "Seeker", threshold: 1, description: "You've taken the first step toward integration" },
    { level: 2, name: "Explorer", threshold: 0.10, description: "10% of polarities explored" },
    { level: 3, name: "Harmonizer", threshold: 0.25, description: "25% - Finding balance in opposites" },
    { level: 4, name: "Integrator", threshold: 0.50, description: "50% - The middle path emerges" },
    { level: 5, name: "Unifier", threshold: 0.75, description: "75% - Duality dissolves into wholeness" },
    { level: 6, name: "Complete", threshold: 1.00, description: "100% - All polarities integrated" }
];

const PROCESS_LEVELS = [
    { level: 1, name: "Awakener", threshold: 1, description: "You've begun feeling what's there" },
    { level: 2, name: "Feeler", threshold: 0.10, description: "10% of emotions witnessed" },
    { level: 3, name: "Processor", threshold: 0.25, description: "25% - Emotions flow through you" },
    { level: 4, name: "Alchemist", threshold: 0.50, description: "50% - Transforming shadow to gold" },
    { level: 5, name: "Liberator", threshold: 0.75, description: "75% - Freedom from emotional weight" },
    { level: 6, name: "Embodied", threshold: 1.00, description: "100% - Full emotional mastery" }
];

// Daily limit
const DAILY_LIMIT = 50;

// Initialize shadow feature
async function initShadow() {
    // Load settings first
    loadShadowSettings();
    
    // Load from localStorage first (for instant UI)
    loadShadowStateFromCache();
    
    // Check daily reset
    checkDailyReset();
    
    updateShadowUI();
    
    // Initialize liberation tool
    initLiberation();
    
    // Then sync from backend (non-blocking)
    loadShadowFromBackend().catch(e => console.warn('Shadow backend load error:', e));
    loadLiberationFromBackend().catch(e => console.warn('Liberation backend load error:', e));
}

// Load shadow state from localStorage cache
function loadShadowStateFromCache() {
    const saved = localStorage.getItem('shadowState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            shadowState.integrate = { ...shadowState.integrate, ...parsed.integrate };
            shadowState.process = { ...shadowState.process, ...parsed.process };
            shadowState.deepClean = { ...shadowState.deepClean, ...parsed.deepClean };
        } catch (e) {
            console.error('Error loading shadow state:', e);
        }
    }
    
    // Check and update Deep Clean progress
    updateDeepCleanProgress();
}

// Load shadow state from backend
async function loadShadowFromBackend() {
    if (!state.currentUser) return;
    
    try {
        const result = await apiCall('getShadowProgress', { userId: state.currentUser.user_id });
        
        if (result?.shadowProgress) {
            const progress = result.shadowProgress;
            
            // Merge with local state (backend takes precedence if it has data)
            if (progress.integrateCompleted && progress.integrateCompleted.length > 0) {
                shadowState.integrate.completed = progress.integrateCompleted;
            }
            if (progress.integrateSkipped && progress.integrateSkipped.length > 0) {
                shadowState.integrate.skipped = progress.integrateSkipped;
            }
            if (progress.processCompleted && progress.processCompleted.length > 0) {
                shadowState.process.completed = progress.processCompleted;
            }
            if (progress.processSkipped && progress.processSkipped.length > 0) {
                shadowState.process.skipped = progress.processSkipped;
            }
            if (progress.deepClean && progress.deepClean.status) {
                shadowState.deepClean = { ...shadowState.deepClean, ...progress.deepClean };
            }
            
            // Update cache and UI
            saveShadowState();
            updateShadowUI();
            console.log('Shadow progress loaded from backend');
        } else {
            // Backend is empty - upload local data if we have any
            const hasLocalData = 
                shadowState.integrate.completed.length > 0 ||
                shadowState.integrate.skipped.length > 0 ||
                shadowState.process.completed.length > 0 ||
                shadowState.process.skipped.length > 0 ||
                shadowState.deepClean.status !== 'not_started';
            
            if (hasLocalData) {
                console.log('Uploading local shadow progress to backend...');
                await syncShadowToBackend();
            }
        }
    } catch (e) {
        console.error('Error loading shadow from backend:', e);
    }
}

// Get current level for integrate tool
function getIntegrateLevel() {
    const completed = shadowState.integrate.completed.length;
    const total = POLARITIES_DATA.length;
    const percentage = total > 0 ? completed / total : 0;
    
    // Check from highest to lowest
    for (let i = INTEGRATE_LEVELS.length - 1; i >= 0; i--) {
        const level = INTEGRATE_LEVELS[i];
        // First level uses absolute count, others use percentage
        if (i === 0) {
            if (completed >= level.threshold) return level;
        } else {
            if (percentage >= level.threshold) return level;
        }
    }
    return null; // Not started
}

// Get current level for process tool
function getProcessLevel() {
    const completed = shadowState.process.completed.length;
    const total = EMOTIONS_DATA.length;
    const percentage = total > 0 ? completed / total : 0;
    
    // Check from highest to lowest
    for (let i = PROCESS_LEVELS.length - 1; i >= 0; i--) {
        const level = PROCESS_LEVELS[i];
        // First level uses absolute count, others use percentage
        if (i === 0) {
            if (completed >= level.threshold) return level;
        } else {
            if (percentage >= level.threshold) return level;
        }
    }
    return null; // Not started
}

// Check and reset daily counts if new day
function checkDailyReset() {
    const today = new Date().toISOString().split('T')[0];
    
    if (shadowState.daily.date !== today) {
        shadowState.daily.date = today;
        shadowState.daily.integrateCount = 0;
        shadowState.daily.processCount = 0;
        saveShadowState();
    }
}

// Check if daily limit reached for integrate
function isIntegrateLimitReached() {
    checkDailyReset();
    return shadowState.daily.integrateCount >= DAILY_LIMIT;
}

// Check if daily limit reached for process
function isProcessLimitReached() {
    checkDailyReset();
    return shadowState.daily.processCount >= DAILY_LIMIT;
}

// Increment daily integrate count
function incrementDailyIntegrate() {
    checkDailyReset();
    shadowState.daily.integrateCount++;
    saveShadowState();
}

// Increment daily process count
function incrementDailyProcess() {
    checkDailyReset();
    shadowState.daily.processCount++;
    saveShadowState();
}

// Load shadow settings from localStorage
function loadShadowSettings() {
    const saved = localStorage.getItem('shadowSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            shadowState.settings = { ...shadowState.settings, ...parsed };
        } catch (e) {
            console.error('Error loading shadow settings:', e);
        }
    }
}

// Save shadow settings to localStorage
function saveShadowSettings() {
    localStorage.setItem('shadowSettings', JSON.stringify(shadowState.settings));
}

// Render shadow settings view
function renderShadowSettings() {
    // Update target displays
    document.getElementById('integrateTargetDisplay').textContent = shadowState.settings.integrateTarget;
    document.getElementById('processTargetDisplay').textContent = shadowState.settings.processTarget;
    
    // Update level displays
    updateShadowSettingsLevels();
}

// Update level displays in settings
function updateShadowSettingsLevels() {
    const integrateLevel = getIntegrateLevel();
    const processLevel = getProcessLevel();
    
    const integrateLevelEl = document.getElementById('integrateLevelDisplay');
    const processLevelEl = document.getElementById('processLevelDisplay');
    
    const integrateCompleted = shadowState.integrate.completed.length;
    const integrateTotal = POLARITIES_DATA.length;
    const integratePercent = Math.round((integrateCompleted / integrateTotal) * 100);
    
    const processCompleted = shadowState.process.completed.length;
    const processTotal = EMOTIONS_DATA.length;
    const processPercent = Math.round((processCompleted / processTotal) * 100);
    
    if (integrateLevelEl) {
        if (integrateLevel) {
            integrateLevelEl.innerHTML = `
                <div class="level-info">
                    <span class="level-badge">Lv ${integrateLevel.level}</span>
                    <span class="level-name">${integrateLevel.name}</span>
                </div>
                <div class="level-progress">${integrateCompleted}/${integrateTotal} (${integratePercent}%)</div>
            `;
        } else {
            integrateLevelEl.innerHTML = `
                <div class="level-progress">Not started yet (${integrateCompleted}/${integrateTotal})</div>
            `;
        }
    }
    
    if (processLevelEl) {
        if (processLevel) {
            processLevelEl.innerHTML = `
                <div class="level-info">
                    <span class="level-badge">Lv ${processLevel.level}</span>
                    <span class="level-name">${processLevel.name}</span>
                </div>
                <div class="level-progress">${processCompleted}/${processTotal} (${processPercent}%)</div>
            `;
        } else {
            processLevelEl.innerHTML = `
                <div class="level-progress">Not started yet (${processCompleted}/${processTotal})</div>
            `;
        }
    }
}

// Adjust integrate daily target
function adjustIntegrateTarget(delta) {
    const newTarget = Math.max(10, Math.min(50, shadowState.settings.integrateTarget + delta));
    shadowState.settings.integrateTarget = newTarget;
    saveShadowSettings();
    document.getElementById('integrateTargetDisplay').textContent = newTarget;
}

// Adjust process daily target
function adjustProcessTarget(delta) {
    const newTarget = Math.max(10, Math.min(50, shadowState.settings.processTarget + delta));
    shadowState.settings.processTarget = newTarget;
    saveShadowSettings();
    document.getElementById('processTargetDisplay').textContent = newTarget;
}

// Save shadow state to localStorage
function saveShadowState() {
    localStorage.setItem('shadowState', JSON.stringify(shadowState));
}

// Sync shadow state to backend
async function syncShadowToBackend() {
    if (!state.currentUser) return;
    
    try {
        await apiCall('saveShadowProgress', {
            userId: state.currentUser.user_id,
            integrateCompleted: shadowState.integrate.completed,
            integrateSkipped: shadowState.integrate.skipped,
            processCompleted: shadowState.process.completed,
            processSkipped: shadowState.process.skipped,
            deepClean: shadowState.deepClean
        });
    } catch (e) {
        console.warn('Error syncing shadow to backend:', e);
    }
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
    
    // Integrate level badge
    const integrateLevelBadge = document.getElementById('integrateLevelBadge');
    const integrateLevel = getIntegrateLevel();
    if (integrateLevelBadge) {
        if (integrateLevel) {
            integrateLevelBadge.innerHTML = `<span class="tool-level-badge">Lv ${integrateLevel.level}</span> ${integrateLevel.name}`;
        } else {
            integrateLevelBadge.innerHTML = '';
        }
    }
    
    // Process progress
    const processTotal = EMOTIONS_DATA.length;
    const processCompleted = shadowState.process.completed.length;
    const processPercent = Math.round((processCompleted / processTotal) * 100);
    
    const processBar = document.getElementById('processProgressBar');
    const processText = document.getElementById('processProgressText');
    if (processBar) processBar.style.width = `${processPercent}%`;
    if (processText) processText.textContent = `${processPercent}% complete`;
    
    // Process level badge
    const processLevelBadge = document.getElementById('processLevelBadge');
    const processLevel = getProcessLevel();
    if (processLevelBadge) {
        if (processLevel) {
            processLevelBadge.innerHTML = `<span class="tool-level-badge">Lv ${processLevel.level}</span> ${processLevel.name}`;
        } else {
            processLevelBadge.innerHTML = '';
        }
    }
    
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

// Integration animation state
let integrateAnimationState = {
    timer: null,
    remaining: 10
};

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
    document.getElementById('polarityDescription').innerHTML = polarity.description || '';
    
    // Reset screens
    document.getElementById('integrateAnimationScreen').classList.add('hidden');
    document.getElementById('integrateCompleteScreen').classList.add('hidden');
    document.getElementById('integrateNav').style.display = 'flex';
    document.querySelector('.integrate-reader-content').style.display = 'flex';
    
    showView('integrateCard');
}

function startIntegrationAnimation() {
    const polarity = shadowState.integrate.currentPolarity;
    if (!polarity) return;
    
    // Hide main content and nav, show animation
    document.getElementById('integrateNav').style.display = 'none';
    document.querySelector('.integrate-reader-content').style.display = 'none';
    
    // Setup animation screen
    document.getElementById('animPolarityLeft').textContent = polarity.left;
    document.getElementById('animPolarityRight').textContent = polarity.right;
    document.getElementById('integrateAnimationScreen').classList.remove('hidden');
    
    // Start 10-second countdown
    integrateAnimationState.remaining = 10;
    document.getElementById('integrateAnimationTimer').textContent = '10';
    document.getElementById('integrateAnimationBar').style.width = '0%';
    
    integrateAnimationState.timer = setInterval(() => {
        integrateAnimationState.remaining--;
        document.getElementById('integrateAnimationTimer').textContent = integrateAnimationState.remaining;
        const progress = ((10 - integrateAnimationState.remaining) / 10) * 100;
        document.getElementById('integrateAnimationBar').style.width = `${progress}%`;
        
        if (integrateAnimationState.remaining <= 0) {
            clearInterval(integrateAnimationState.timer);
            finishIntegrationAnimation();
        }
    }, 1000);
}

function finishIntegrationAnimation() {
    const polarity = shadowState.integrate.currentPolarity;
    if (!polarity) return;
    
    // Record completion
    shadowState.integrate.completed.push(polarity.id);
    incrementDailyIntegrate();
    saveShadowState();
    syncShadowToBackend();
    
    // Hide animation, show complete screen
    document.getElementById('integrateAnimationScreen').classList.add('hidden');
    document.getElementById('integrateCompleteScreen').classList.remove('hidden');
    
    // Update complete screen
    document.getElementById('completePolarityLeft').textContent = polarity.left;
    document.getElementById('completePolarityRight').textContent = polarity.right;
    
    // Update progress stats on complete screen
    updateIntegrateCompleteStats();
    
    updateIntegrateUI();
    updateShadowToolCards();
    
    // Play sound and vibrate
    playCompletionSound();
    vibrate([100, 50, 100]);
}

function updateIntegrateCompleteStats() {
    const completed = shadowState.integrate.completed.length;
    const total = POLARITIES_DATA.length;
    const percentage = Math.round((completed / total) * 100);
    const todayCount = shadowState.daily.integrateCount;
    const todayTarget = shadowState.settings.integrateTarget;
    const level = getIntegrateLevel();
    
    // Update stats display
    const statsEl = document.getElementById('integrateCompleteStats');
    if (statsEl) {
        const atLimit = todayCount >= DAILY_LIMIT;
        const targetMet = todayCount >= todayTarget;
        
        statsEl.innerHTML = `
            <div class="complete-stat-row">
                <span class="complete-stat-label">All-time progress</span>
                <span class="complete-stat-value">${completed} / ${total} (${percentage}%)</span>
            </div>
            <div class="complete-stat-row">
                <span class="complete-stat-label">Today</span>
                <span class="complete-stat-value ${targetMet ? 'target-met' : ''}">${todayCount} / ${todayTarget} target${atLimit ? ' (daily limit reached)' : ''}</span>
            </div>
            ${level ? `
            <div class="complete-stat-row level">
                <span class="complete-stat-label">Level ${level.level}</span>
                <span class="complete-stat-value">${level.name}</span>
            </div>
            ` : ''}
        `;
    }
    
    // Update continue button text
    const continueBtn = document.getElementById('integrateContinueBtn');
    if (continueBtn) {
        if (todayCount >= DAILY_LIMIT) {
            continueBtn.disabled = true;
            continueBtn.textContent = 'Daily limit reached';
        } else {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue to next';
        }
    }
}

function continueIntegration() {
    // Check daily limit
    if (isIntegrateLimitReached()) {
        showToast('Daily limit reached (50). Come back tomorrow!', 'info');
        finishIntegration();
        return;
    }
    
    // Check if more to do
    const handled = [...shadowState.integrate.completed, ...shadowState.integrate.skipped];
    const hasMore = POLARITIES_DATA.some(p => !handled.includes(p.id));
    
    if (hasMore) {
        startNextIntegration();
    } else {
        showToast('All polarities integrated!', 'success');
        finishIntegration();
    }
}

function finishIntegration() {
    // Go back to shadow page
    showView('shadow');
}

function skipIntegration() {
    const polarity = shadowState.integrate.currentPolarity;
    if (!polarity) return;
    
    shadowState.integrate.skipped.push(polarity.id);
    saveShadowState();
    syncShadowToBackend();
    
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
    // Clear any running animation timer
    if (integrateAnimationState.timer) {
        clearInterval(integrateAnimationState.timer);
        integrateAnimationState.timer = null;
    }
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

// Process animation state
let processAnimationState = {
    timer: null,
    remaining: 10
};

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
    document.getElementById('emotionDescription').innerHTML = emotion.description || '';
    
    // Reset screens
    document.getElementById('processAnimationScreen').classList.add('hidden');
    document.getElementById('processCompleteScreen').classList.add('hidden');
    document.getElementById('processNav').style.display = 'flex';
    document.querySelector('.process-reader-content').style.display = 'flex';
    
    showView('processCard');
}

function startProcessAnimation() {
    const emotion = shadowState.process.currentEmotion;
    if (!emotion) return;
    
    // Hide main content and nav, show animation
    document.getElementById('processNav').style.display = 'none';
    document.querySelector('.process-reader-content').style.display = 'none';
    
    // Setup animation screen
    document.getElementById('animEmotionName').textContent = emotion.name;
    document.getElementById('processAnimationScreen').classList.remove('hidden');
    
    // Start 10-second countdown
    processAnimationState.remaining = 10;
    document.getElementById('processAnimationTimer').textContent = '10';
    document.getElementById('processAnimationBar').style.width = '0%';
    
    processAnimationState.timer = setInterval(() => {
        processAnimationState.remaining--;
        document.getElementById('processAnimationTimer').textContent = processAnimationState.remaining;
        const progress = ((10 - processAnimationState.remaining) / 10) * 100;
        document.getElementById('processAnimationBar').style.width = `${progress}%`;
        
        if (processAnimationState.remaining <= 0) {
            clearInterval(processAnimationState.timer);
            finishProcessAnimation();
        }
    }, 1000);
}

function finishProcessAnimation() {
    const emotion = shadowState.process.currentEmotion;
    if (!emotion) return;
    
    // Record completion
    shadowState.process.completed.push(emotion.id);
    incrementDailyProcess();
    saveShadowState();
    syncShadowToBackend();
    
    // Hide animation, show complete screen
    document.getElementById('processAnimationScreen').classList.add('hidden');
    document.getElementById('processCompleteScreen').classList.remove('hidden');
    
    // Update complete screen
    document.getElementById('completeEmotionName').textContent = emotion.name;
    
    // Update progress stats on complete screen
    updateProcessCompleteStats();
    
    updateProcessUI();
    updateShadowToolCards();
    
    // Play sound and vibrate
    playCompletionSound();
    vibrate([100, 50, 100]);
}

function updateProcessCompleteStats() {
    const completed = shadowState.process.completed.length;
    const total = EMOTIONS_DATA.length;
    const percentage = Math.round((completed / total) * 100);
    const todayCount = shadowState.daily.processCount;
    const todayTarget = shadowState.settings.processTarget;
    const level = getProcessLevel();
    
    // Update stats display
    const statsEl = document.getElementById('processCompleteStats');
    if (statsEl) {
        const atLimit = todayCount >= DAILY_LIMIT;
        const targetMet = todayCount >= todayTarget;
        
        statsEl.innerHTML = `
            <div class="complete-stat-row">
                <span class="complete-stat-label">All-time progress</span>
                <span class="complete-stat-value">${completed} / ${total} (${percentage}%)</span>
            </div>
            <div class="complete-stat-row">
                <span class="complete-stat-label">Today</span>
                <span class="complete-stat-value ${targetMet ? 'target-met' : ''}">${todayCount} / ${todayTarget} target${atLimit ? ' (daily limit reached)' : ''}</span>
            </div>
            ${level ? `
            <div class="complete-stat-row level">
                <span class="complete-stat-label">Level ${level.level}</span>
                <span class="complete-stat-value">${level.name}</span>
            </div>
            ` : ''}
        `;
    }
    
    // Update continue button text
    const continueBtn = document.getElementById('processContinueBtn');
    if (continueBtn) {
        if (todayCount >= DAILY_LIMIT) {
            continueBtn.disabled = true;
            continueBtn.textContent = 'Daily limit reached';
        } else {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue to next';
        }
    }
}

function continueProcess() {
    // Check daily limit
    if (isProcessLimitReached()) {
        showToast('Daily limit reached (50). Come back tomorrow!', 'info');
        finishProcess();
        return;
    }
    
    // Check if more to do
    const handled = [...shadowState.process.completed, ...shadowState.process.skipped];
    const hasMore = EMOTIONS_DATA.some(e => !handled.includes(e.id));
    
    if (hasMore) {
        startNextProcess();
    } else {
        showToast('All emotional states processed!', 'success');
        finishProcess();
    }
}

function finishProcess() {
    // Go back to shadow page
    showView('shadow');
}

function skipProcess() {
    const emotion = shadowState.process.currentEmotion;
    if (!emotion) return;
    
    shadowState.process.skipped.push(emotion.id);
    saveShadowState();
    syncShadowToBackend();
    
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
    // Clear any running animation timer
    if (processAnimationState.timer) {
        clearInterval(processAnimationState.timer);
        processAnimationState.timer = null;
    }
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
    syncShadowToBackend();
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
    syncShadowToBackend();
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
        syncShadowToBackend();
        updateDeepCleanUI();
        updateShadowToolCards();
        
        showToast('Deep Clean stopped', 'info');
    }
}

// ============================================
// LIBERATION & HAPPINESS PROCESS
// ============================================

// Liberation process data
const LIBERATION_STAGES = [
    {
        number: 1,
        title: "Session Intention",
        steps: [
            { text: "My intention is trauma and emotional healing, gently and safely, in a way my system can integrate.", duration: 10 },
            { text: "I'm not forcing anything. I'm allowing what's ready to unwind, at the pace my system can handle.", duration: 10 },
            { text: "If anything feels overwhelming, I'll slow down, feel my body, and return to what feels stabilizing.", duration: 10 }
        ]
    },
    {
        number: 2,
        title: "Causal Body Repair",
        steps: [
            { text: "For the liberation and happiness of all beings, may the broken parts, bits, and pieces of my causal body return to their original natural places.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may the broken parts of the causal body's nadi channels return back to their natural places.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may the fragments of my broken nadi channels return back to their natural places, supporting trauma healing and wholeness.", duration: 30 }
        ]
    },
    {
        number: 3,
        title: "Astral Meridian Repair",
        steps: [
            { text: "For the liberation and happiness of all beings, may the broken parts of my meridian channels return to their original places.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may the broken fragments of the meridian channels of my astral body return back to their natural places.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may the broken parts of my meridians return back to their original places.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may my astral body and my causal body become completely whole again.", duration: 30 }
        ]
    },
    {
        number: 4,
        title: "Vitality Return",
        steps: [
            { text: "For the liberation and happiness of all beings, may the vital energy that has left my body through holes in the subtle bodies return to nourish my mind, my heart, and my body.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may my vitality return to me.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may my vital energy return to my subtle bodies and circulate smoothly, harmoniously, and beautifully.", duration: 30 }
        ]
    },
    {
        number: 5,
        title: "Reintegration of Dissociated Parts",
        steps: [
            { text: "For the liberation and happiness of all beings, may the larger sections of the channel system in my astral body return back to where and how they should be.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may the dissociated parts of my psyche and soul body return back to their natural places and be integrated back into the whole.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may the larger dissociated sections of the soul body's meridian system return back to their natural original places.", duration: 30 }
        ]
    },
    {
        number: 6,
        title: "Emotional Unwinding and Inner Refuge",
        steps: [
            { text: "I invite and allow emotions to start releasing.", duration: 30 },
            { text: "I allow painful memories to surface gently, only as much as I can integrate.", duration: 30 },
            { text: "I take refuge in what is steady in me: simple presence and embodied safety.", duration: 30 },
            { text: "I'm here. I'm safe enough right now. I can feel this without fighting it.", duration: 30 }
        ]
    },
    {
        number: 7,
        title: "Kindness and Wellbeing Activation",
        steps: [
            { text: "For the liberation and happiness of all beings, may I feel love.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may I be kind to myself.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may I be happy.", duration: 30 },
            { text: "For the liberation and happiness of all beings, may the people around me be loved and happy. May all beings be loved and happy.", duration: 30 }
        ]
    },
    {
        number: 8,
        title: "May I Change This to Love",
        steps: [
            { text: "May I change this to love", duration: 30 },
            { text: "May I change this to love", duration: 30 },
            { text: "May I change this to love", duration: 30 }
        ]
    }
];

// Liberation state
let liberationState = {
    totalRounds: 0,
    currentStreak: 0,
    lastCompletedDate: null,
    currentStage: 0,
    currentStep: 0,
    timer: null,
    timeRemaining: 0,
    isTimerComplete: false,
    healingEnergyEnabled: false,
    sessionStartTime: null
};

// Initialize liberation
function initLiberation() {
    loadLiberationState();
    updateLiberationUI();
}

// Load liberation state from localStorage
function loadLiberationState() {
    const saved = localStorage.getItem('liberationState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            liberationState.totalRounds = parsed.totalRounds || 0;
            liberationState.currentStreak = parsed.currentStreak || 0;
            liberationState.lastCompletedDate = parsed.lastCompletedDate || null;
        } catch (e) {
            console.error('Error loading liberation state:', e);
        }
    }
    
    // Check and update streak
    updateLiberationStreak();
}

// Save liberation state
function saveLiberationState() {
    localStorage.setItem('liberationState', JSON.stringify({
        totalRounds: liberationState.totalRounds,
        currentStreak: liberationState.currentStreak,
        lastCompletedDate: liberationState.lastCompletedDate
    }));
}

// Update streak based on last completion date
function updateLiberationStreak() {
    if (!liberationState.lastCompletedDate) return;
    
    const lastDate = new Date(liberationState.lastCompletedDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset dates to start of day for comparison
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    
    // If last completion was before yesterday, reset streak
    if (lastDate < yesterday) {
        liberationState.currentStreak = 0;
        saveLiberationState();
    }
}

// Update Liberation UI
function updateLiberationUI() {
    // Main view stats
    const totalRoundsEl = document.getElementById('liberationTotalRounds');
    const currentStreakEl = document.getElementById('liberationCurrentStreak');
    
    if (totalRoundsEl) totalRoundsEl.textContent = liberationState.totalRounds;
    if (currentStreakEl) currentStreakEl.textContent = liberationState.currentStreak;
    
    // Shadow card stats
    const roundsText = document.getElementById('liberationRoundsText');
    const streakText = document.getElementById('liberationStreakText');
    
    if (roundsText) roundsText.textContent = `${liberationState.totalRounds} round${liberationState.totalRounds !== 1 ? 's' : ''}`;
    if (streakText) streakText.textContent = `🔥 ${liberationState.currentStreak} day streak`;
}

// Start the liberation process
function startLiberationProcess() {
    liberationState.currentStage = 0;
    liberationState.currentStep = 0;
    liberationState.isTimerComplete = false;
    
    // Check if healing energy is enabled
    const energyToggle = document.getElementById('liberationEnergyToggle');
    liberationState.healingEnergyEnabled = energyToggle ? energyToggle.checked : false;
    liberationState.sessionStartTime = new Date();
    
    // Show/hide energy indicator
    const energyIndicator = document.getElementById('liberationEnergyIndicator');
    if (energyIndicator) {
        energyIndicator.classList.toggle('active', liberationState.healingEnergyEnabled);
    }
    
    showView('liberationProcess');
    renderLiberationStep();
}

// Render current step
function renderLiberationStep() {
    const stage = LIBERATION_STAGES[liberationState.currentStage];
    const step = stage.steps[liberationState.currentStep];
    
    // Update stage info
    document.getElementById('liberationStageBadge').textContent = `Stage ${stage.number} of 8`;
    document.getElementById('liberationStageTitle').textContent = stage.title;
    
    // Update step text
    document.getElementById('liberationStepText').textContent = `"${step.text}"`;
    
    // Render progress dots
    renderLiberationDots();
    
    // Start timer
    startLiberationTimer(step.duration);
}

// Render progress dots for all steps across all stages
function renderLiberationDots() {
    const dotsContainer = document.getElementById('liberationStepDots');
    if (!dotsContainer) return;
    
    let totalSteps = 0;
    let currentGlobalStep = 0;
    
    // Calculate total steps and current global position
    LIBERATION_STAGES.forEach((stage, stageIndex) => {
        stage.steps.forEach((_, stepIndex) => {
            if (stageIndex < liberationState.currentStage || 
                (stageIndex === liberationState.currentStage && stepIndex < liberationState.currentStep)) {
                currentGlobalStep++;
            }
            totalSteps++;
        });
    });
    
    // Render dots
    let html = '';
    let globalIndex = 0;
    LIBERATION_STAGES.forEach((stage, stageIndex) => {
        stage.steps.forEach((_, stepIndex) => {
            let dotClass = 'liberation-step-dot';
            if (globalIndex < currentGlobalStep) {
                dotClass += ' completed';
            } else if (stageIndex === liberationState.currentStage && stepIndex === liberationState.currentStep) {
                dotClass += ' active';
            }
            html += `<div class="${dotClass}"></div>`;
            globalIndex++;
        });
    });
    
    dotsContainer.innerHTML = html;
}

// Start timer for current step
function startLiberationTimer(duration) {
    liberationState.timeRemaining = duration;
    liberationState.isTimerComplete = false;
    
    const timerText = document.getElementById('liberationTimerText');
    const timerCircle = document.getElementById('liberationTimerCircle');
    const proceedBtn = document.getElementById('liberationProceedBtn');
    const proceedText = document.getElementById('liberationProceedText');
    
    // Reset UI
    timerText.textContent = duration;
    timerCircle.style.strokeDashoffset = '0';
    proceedBtn.disabled = true;
    proceedText.textContent = 'Please wait...';
    
    const circumference = 283; // 2 * PI * 45 (radius)
    
    // Clear any existing timer
    if (liberationState.timer) {
        clearInterval(liberationState.timer);
    }
    
    liberationState.timer = setInterval(() => {
        liberationState.timeRemaining--;
        timerText.textContent = liberationState.timeRemaining;
        
        // Update circle progress
        const progress = (duration - liberationState.timeRemaining) / duration;
        timerCircle.style.strokeDashoffset = circumference * (1 - progress);
        
        if (liberationState.timeRemaining <= 0) {
            clearInterval(liberationState.timer);
            liberationState.timer = null;
            liberationState.isTimerComplete = true;
            
            // Enable proceed button
            proceedBtn.disabled = false;
            
            // Check if this is the last step
            const isLastStage = liberationState.currentStage === LIBERATION_STAGES.length - 1;
            const isLastStep = liberationState.currentStep === LIBERATION_STAGES[liberationState.currentStage].steps.length - 1;
            
            if (isLastStage && isLastStep) {
                proceedText.textContent = 'Complete';
            } else {
                proceedText.textContent = 'Proceed →';
            }
            
            // Play subtle sound
            playCompletionSound();
            vibrate([50]);
        }
    }, 1000);
}

// Proceed to next step
function proceedLiberationStep() {
    if (!liberationState.isTimerComplete) return;
    
    const currentStage = LIBERATION_STAGES[liberationState.currentStage];
    const isLastStepInStage = liberationState.currentStep === currentStage.steps.length - 1;
    const isLastStage = liberationState.currentStage === LIBERATION_STAGES.length - 1;
    
    if (isLastStepInStage) {
        if (isLastStage) {
            // Process complete
            completeLiberationProcess();
        } else {
            // Move to next stage
            liberationState.currentStage++;
            liberationState.currentStep = 0;
            renderLiberationStep();
        }
    } else {
        // Move to next step in current stage
        liberationState.currentStep++;
        renderLiberationStep();
    }
}

// Complete the liberation process
function completeLiberationProcess() {
    // Update stats
    liberationState.totalRounds++;
    
    // Update streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (liberationState.lastCompletedDate) {
        const lastDate = new Date(liberationState.lastCompletedDate);
        lastDate.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastDate.getTime() === yesterday.getTime()) {
            // Consecutive day
            liberationState.currentStreak++;
        } else if (lastDate.getTime() < yesterday.getTime()) {
            // Streak broken, start new
            liberationState.currentStreak = 1;
        }
        // If same day, keep streak as is
    } else {
        // First time
        liberationState.currentStreak = 1;
    }
    
    liberationState.lastCompletedDate = today.toISOString();
    
    saveLiberationState();
    syncLiberationToBackend();
    updateLiberationUI();
    
    // Save healing energy session if enabled
    if (liberationState.healingEnergyEnabled && state.currentUser && liberationState.sessionStartTime) {
        const endTime = new Date();
        const durationMinutes = Math.round((endTime - liberationState.sessionStartTime) / 60000);
        
        apiCall('saveSession', {
            userId: state.currentUser.user_id,
            markerId: '',
            startTime: liberationState.sessionStartTime.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: durationMinutes,
            energyType: 'Onelove',
            intensity: 'medium',
            notes: 'Liberation & Happiness Process'
        }).catch(e => console.warn('Error saving liberation energy session:', e));
        
        // Add to local sessions for immediate UI update
        if (state.sessions) {
            state.sessions.unshift({
                start_time: liberationState.sessionStartTime.toISOString(),
                end_time: endTime.toISOString(),
                duration_minutes: durationMinutes,
                energy_type: 'Onelove',
                intensity: 'medium',
                notes: 'Liberation & Happiness Process'
            });
        }
    }
    
    // Reset energy state
    liberationState.healingEnergyEnabled = false;
    liberationState.sessionStartTime = null;
    
    // Update complete screen stats
    document.getElementById('liberationCompleteRounds').textContent = liberationState.totalRounds;
    document.getElementById('liberationCompleteStreak').textContent = liberationState.currentStreak;
    
    // Show complete view
    showView('liberationComplete');
    
    // Play completion sound
    playCompletionSound();
    vibrate([100, 50, 100, 50, 100]);
}

// Confirm exit from liberation process
function confirmExitLiberation() {
    if (confirm('Are you sure you want to exit? Your progress in this session will be lost.')) {
        exitLiberationProcess();
    }
}

// Exit liberation process
function exitLiberationProcess() {
    // Clear timer
    if (liberationState.timer) {
        clearInterval(liberationState.timer);
        liberationState.timer = null;
    }
    
    // Clear energy state (no session saved since incomplete)
    liberationState.healingEnergyEnabled = false;
    liberationState.sessionStartTime = null;
    
    showView('liberation');
}

// Close liberation complete screen
function closeLiberationComplete() {
    showView('shadow');
}

// Sync liberation state to backend
async function syncLiberationToBackend() {
    if (!state.currentUser) return;
    
    try {
        await apiCall('saveLiberationProgress', {
            userId: state.currentUser.user_id,
            totalRounds: liberationState.totalRounds,
            currentStreak: liberationState.currentStreak,
            lastCompletedDate: liberationState.lastCompletedDate
        });
    } catch (e) {
        console.warn('Error syncing liberation to backend:', e);
    }
}

// Load liberation state from backend
async function loadLiberationFromBackend() {
    if (!state.currentUser) return;
    
    try {
        const result = await apiCall('getLiberationProgress', { userId: state.currentUser.user_id });
        
        if (result?.liberationProgress) {
            const progress = result.liberationProgress;
            
            if (progress.totalRounds > liberationState.totalRounds) {
                liberationState.totalRounds = progress.totalRounds;
            }
            if (progress.currentStreak > liberationState.currentStreak) {
                liberationState.currentStreak = progress.currentStreak;
            }
            if (progress.lastCompletedDate) {
                liberationState.lastCompletedDate = progress.lastCompletedDate;
            }
            
            saveLiberationState();
            updateLiberationUI();
        }
    } catch (e) {
        console.error('Error loading liberation from backend:', e);
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
        
        if (attResult?.attunements && attResult.attunements.length > 0) {
            // Backend has data - use it
            attunementState.attunements = attResult.attunements;
        } else if (attunementState.attunements.length > 0) {
            // Backend is empty but we have local data - upload it to backend
            console.log('Uploading local attunements to backend...');
            for (const att of attunementState.attunements) {
                await apiCall('saveAttunement', att).catch(e => console.warn('Error uploading attunement:', e));
            }
        }
        
        // Load user's received attunements
        if (state.currentUser) {
            const userId = state.currentUser.user_id;
            const userResult = await apiCall('getUserAttunements', { userId: userId });
            if (userResult?.userAttunements && userResult.userAttunements.length > 0) {
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
// PUSH NOTIFICATIONS (OneSignal)
// ============================================

const ONESIGNAL_APP_ID = '4a340707-5574-45b1-b514-e7469737cef5';

// Push notification state
let pushState = {
    initialized: false,
    subscribed: false,
    playerId: null,
    settings: {
        habits: false,
        habitsTime: '08:00',
        signal: false,
        signalTime: '07:00',
        shadow: false,
        shadowTime: '20:00',
        session: true
    },
    mindfulAlerts: [] // { id, name, message, frequency, startTime, endTime, enabled }
};

// Initialize OneSignal
async function initOneSignal() {
    // OneSignal uses deferred loading - set up callback that runs when SDK is ready
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    OneSignalDeferred.push(async function(OneSignal) {
        try {
            await OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                allowLocalhostAsSecureOrigin: true,
                notifyButton: {
                    enable: false  // We use our own UI
                }
            });
            
            pushState.initialized = true;
            
            // Check subscription status
            const permission = await OneSignal.Notifications.permission;
            pushState.subscribed = permission;
            
            // Get player ID if subscribed
            if (permission) {
                try {
                    const subscription = OneSignal.User.PushSubscription;
                    pushState.playerId = subscription?.id || null;
                } catch (e) {
                    console.log('Could not get player ID:', e);
                }
            }
            
            // Listen for subscription changes
            OneSignal.Notifications.addEventListener('permissionChange', (permission) => {
                pushState.subscribed = permission;
                updatePushUI();
                if (permission) {
                    syncPushTagsToOneSignal();
                }
            });
            
            updatePushUI();
            console.log('OneSignal initialized successfully, subscribed:', pushState.subscribed);
            
        } catch (error) {
            console.error('OneSignal init error:', error);
            pushState.initialized = false;
        }
    });
}

// Toggle push notifications on/off
async function togglePushNotifications() {
    if (!pushState.initialized) {
        showToast('Notifications not ready yet. Please wait a moment and try again.', 'error');
        return;
    }
    
    // Access OneSignal through window since it's loaded via deferred
    const OneSignal = window.OneSignal;
    if (!OneSignal) {
        showToast('OneSignal not available', 'error');
        return;
    }
    
    try {
        if (pushState.subscribed) {
            // Unsubscribe
            await OneSignal.User.PushSubscription.optOut();
            pushState.subscribed = false;
            showToast('Notifications disabled', 'info');
        } else {
            // Subscribe
            await OneSignal.Notifications.requestPermission();
            const permission = await OneSignal.Notifications.permission;
            pushState.subscribed = permission;
            
            if (permission) {
                showToast('Notifications enabled!', 'success');
                syncPushTagsToOneSignal();
            } else {
                showToast('Please allow notifications in your browser', 'info');
            }
        }
        updatePushUI();
    } catch (error) {
        console.error('Toggle push error:', error);
        showToast('Error toggling notifications', 'error');
    }
}

// Update push settings UI
function updatePushUI() {
    const statusText = document.getElementById('pushStatusText');
    const enableBtn = document.getElementById('pushEnableBtn');
    const noteText = document.getElementById('pushNote');
    const standardSection = document.getElementById('pushStandardSection');
    const alertsSection = document.getElementById('pushAlertsSection');
    
    if (statusText) {
        if (!pushState.initialized) {
            statusText.textContent = 'Loading...';
            statusText.className = 'push-toggle-status';
        } else if (pushState.subscribed) {
            statusText.textContent = 'Enabled';
            statusText.className = 'push-toggle-status enabled';
        } else {
            statusText.textContent = 'Disabled';
            statusText.className = 'push-toggle-status disabled';
        }
    }
    
    if (enableBtn) {
        if (!pushState.initialized) {
            enableBtn.textContent = 'Loading...';
            enableBtn.className = 'btn secondary';
            enableBtn.disabled = true;
        } else {
            enableBtn.textContent = pushState.subscribed ? 'Disable' : 'Enable';
            enableBtn.className = pushState.subscribed ? 'btn secondary' : 'btn primary';
            enableBtn.disabled = false;
        }
    }
    
    if (noteText) {
        if (!pushState.initialized) {
            noteText.textContent = 'Connecting to notification service...';
        } else if (pushState.subscribed) {
            noteText.textContent = 'You will receive notifications based on your settings below.';
        } else {
            noteText.textContent = 'Enable to receive reminders for habits, session completions, and mindful moments.';
        }
    }
    
    // Show/hide settings sections based on subscription
    if (standardSection) {
        standardSection.style.opacity = pushState.subscribed ? '1' : '0.5';
        standardSection.style.pointerEvents = pushState.subscribed ? 'auto' : 'none';
    }
    if (alertsSection) {
        alertsSection.style.opacity = pushState.subscribed ? '1' : '0.5';
        alertsSection.style.pointerEvents = pushState.subscribed ? 'auto' : 'none';
    }
    
    // Load settings into UI
    loadPushSettingsToUI();
    renderMindfulAlerts();
}

// Load push settings from localStorage
function loadPushSettings() {
    const saved = localStorage.getItem('pushSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            pushState.settings = { ...pushState.settings, ...parsed.settings };
            pushState.mindfulAlerts = parsed.mindfulAlerts || [];
        } catch (e) {
            console.error('Error loading push settings:', e);
        }
    }
}

// Save push settings to localStorage
function savePushSettings() {
    // Read from UI
    pushState.settings.habits = document.getElementById('pushHabits')?.checked || false;
    pushState.settings.habitsTime = document.getElementById('pushHabitsTime')?.value || '08:00';
    pushState.settings.signal = document.getElementById('pushSignal')?.checked || false;
    pushState.settings.signalTime = document.getElementById('pushSignalTime')?.value || '07:00';
    pushState.settings.shadow = document.getElementById('pushShadow')?.checked || false;
    pushState.settings.shadowTime = document.getElementById('pushShadowTime')?.value || '20:00';
    pushState.settings.session = document.getElementById('pushSession')?.checked || true;
    
    localStorage.setItem('pushSettings', JSON.stringify({
        settings: pushState.settings,
        mindfulAlerts: pushState.mindfulAlerts
    }));
    
    // Sync to OneSignal tags
    if (pushState.subscribed) {
        syncPushTagsToOneSignal();
    }
    
    // Sync to backend for server-side scheduling
    syncPushSettingsToBackend();
}

// Load settings into UI elements
function loadPushSettingsToUI() {
    const habitsEl = document.getElementById('pushHabits');
    const habitsTimeEl = document.getElementById('pushHabitsTime');
    const signalEl = document.getElementById('pushSignal');
    const signalTimeEl = document.getElementById('pushSignalTime');
    const shadowEl = document.getElementById('pushShadow');
    const shadowTimeEl = document.getElementById('pushShadowTime');
    const sessionEl = document.getElementById('pushSession');
    
    if (habitsEl) habitsEl.checked = pushState.settings.habits;
    if (habitsTimeEl) habitsTimeEl.value = pushState.settings.habitsTime;
    if (signalEl) signalEl.checked = pushState.settings.signal;
    if (signalTimeEl) signalTimeEl.value = pushState.settings.signalTime;
    if (shadowEl) shadowEl.checked = pushState.settings.shadow;
    if (shadowTimeEl) shadowTimeEl.value = pushState.settings.shadowTime;
    if (sessionEl) sessionEl.checked = pushState.settings.session;
}

// Sync tags to OneSignal for segmentation
async function syncPushTagsToOneSignal() {
    if (!pushState.initialized || !pushState.subscribed) return;
    
    const OneSignal = window.OneSignal;
    if (!OneSignal) return;
    
    try {
        // Set user tags for targeting
        await OneSignal.User.addTags({
            habits_enabled: pushState.settings.habits ? 'true' : 'false',
            habits_time: pushState.settings.habitsTime,
            signal_enabled: pushState.settings.signal ? 'true' : 'false',
            signal_time: pushState.settings.signalTime,
            shadow_enabled: pushState.settings.shadow ? 'true' : 'false',
            shadow_time: pushState.settings.shadowTime,
            session_enabled: pushState.settings.session ? 'true' : 'false',
            user_id: state.currentUser?.user_id || 'anonymous',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        // Get and store player ID for server-side notifications
        const playerId = await getOneSignalPlayerId();
        if (playerId) {
            pushState.playerId = playerId;
        }
        
        console.log('OneSignal tags synced, player ID:', playerId);
    } catch (e) {
        console.error('Error syncing OneSignal tags:', e);
    }
}

// Get OneSignal player ID
async function getOneSignalPlayerId() {
    try {
        const OneSignal = window.OneSignal;
        if (!OneSignal) return null;
        const subscription = OneSignal.User.PushSubscription;
        return subscription?.id || null;
    } catch (e) {
        console.error('Error getting player ID:', e);
        return null;
    }
}

// Sync settings to backend for server-side scheduling
async function syncPushSettingsToBackend() {
    if (!state.currentUser) return;
    
    try {
        // Get player ID if we don't have it
        if (!pushState.playerId && pushState.subscribed) {
            pushState.playerId = await getOneSignalPlayerId();
        }
        
        console.log('Syncing push settings to backend:', {
            userId: state.currentUser.user_id,
            playerId: pushState.playerId,
            alertCount: pushState.mindfulAlerts.length
        });
        
        // Must stringify objects/arrays for URL params
        await apiCall('savePushSettings', {
            userId: state.currentUser.user_id,
            settings: JSON.stringify(pushState.settings),
            mindfulAlerts: JSON.stringify(pushState.mindfulAlerts),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            onesignalPlayerId: pushState.playerId || ''
        });
        
        console.log('Push settings synced to backend successfully');
    } catch (e) {
        console.warn('Error syncing push settings to backend:', e);
    }
}

// ============================================
// MINDFUL ALERTS
// ============================================

let editingAlertId = null;

// Render mindful alerts list
function renderMindfulAlerts() {
    const listEl = document.getElementById('mindfulAlertsList');
    const emptyEl = document.getElementById('emptyAlertsMessage');
    
    if (!listEl) return;
    
    if (pushState.mindfulAlerts.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        listEl.innerHTML = emptyEl ? emptyEl.outerHTML : '<div class="empty-alerts-message">No mindful alerts yet.</div>';
        return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    
    let html = '';
    pushState.mindfulAlerts.forEach(alert => {
        html += `
            <div class="mindful-alert-card" data-alert-id="${alert.id}">
                <div class="mindful-alert-header">
                    <span class="mindful-alert-name">${escapeHtml(alert.name)}</span>
                    <label class="toggle mindful-alert-toggle">
                        <input type="checkbox" ${alert.enabled ? 'checked' : ''} onchange="toggleAlert('${alert.id}')">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="mindful-alert-message">"${escapeHtml(alert.message)}"</div>
                <div class="mindful-alert-meta">
                    <span>${alert.frequency}x/day • ${alert.startTime} - ${alert.endTime}</span>
                    <div class="mindful-alert-actions">
                        <button onclick="editAlert('${alert.id}')" title="Edit">✎</button>
                        <button class="delete" onclick="deleteAlert('${alert.id}')" title="Delete">✕</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
}

// Show add alert modal
function showAddAlertModal() {
    editingAlertId = null;
    document.getElementById('alertModalTitle').textContent = 'Add Mindful Alert';
    document.getElementById('alertName').value = '';
    document.getElementById('alertMessage').value = '';
    document.getElementById('alertFrequency').value = '3';
    document.getElementById('alertStartTime').value = '08:00';
    document.getElementById('alertEndTime').value = '21:00';
    document.getElementById('alertModal').classList.remove('hidden');
}

// Edit existing alert
function editAlert(alertId) {
    const alert = pushState.mindfulAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    editingAlertId = alertId;
    document.getElementById('alertModalTitle').textContent = 'Edit Mindful Alert';
    document.getElementById('alertName').value = alert.name;
    document.getElementById('alertMessage').value = alert.message;
    document.getElementById('alertFrequency').value = alert.frequency;
    document.getElementById('alertStartTime').value = alert.startTime;
    document.getElementById('alertEndTime').value = alert.endTime;
    document.getElementById('alertModal').classList.remove('hidden');
}

// Close alert modal
function closeAlertModal() {
    document.getElementById('alertModal').classList.add('hidden');
    editingAlertId = null;
}

// Save alert (add or edit)
function saveAlert() {
    const name = document.getElementById('alertName').value.trim();
    const message = document.getElementById('alertMessage').value.trim();
    const frequency = parseInt(document.getElementById('alertFrequency').value);
    const startTime = document.getElementById('alertStartTime').value;
    const endTime = document.getElementById('alertEndTime').value;
    
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }
    
    if (editingAlertId) {
        // Update existing
        const alert = pushState.mindfulAlerts.find(a => a.id === editingAlertId);
        if (alert) {
            alert.name = name;
            alert.message = message;
            alert.frequency = frequency;
            alert.startTime = startTime;
            alert.endTime = endTime;
        }
        showToast('Alert updated', 'success');
    } else {
        // Add new
        const newAlert = {
            id: 'alert_' + Date.now(),
            name,
            message,
            frequency,
            startTime,
            endTime,
            enabled: true
        };
        pushState.mindfulAlerts.push(newAlert);
        showToast('Alert added', 'success');
    }
    
    savePushSettings();
    renderMindfulAlerts();
    closeAlertModal();
}

// Toggle alert enabled/disabled
function toggleAlert(alertId) {
    const alert = pushState.mindfulAlerts.find(a => a.id === alertId);
    if (alert) {
        alert.enabled = !alert.enabled;
        savePushSettings();
    }
}

// Delete alert
function deleteAlert(alertId) {
    if (!confirm('Delete this mindful alert?')) return;
    
    pushState.mindfulAlerts = pushState.mindfulAlerts.filter(a => a.id !== alertId);
    savePushSettings();
    renderMindfulAlerts();
    showToast('Alert deleted', 'info');
}

// Helper to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Send local notification (for session complete when app is open)
function sendLocalNotification(title, message) {
    console.log('Sending local notification:', title, message);
    
    // Try standard Notification API first
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: message,
                    icon: 'icons/icon.svg',
                    tag: 'session-complete',
                    requireInteraction: true
                });
                console.log('Notification sent via Notification API');
            } catch (e) {
                console.error('Notification error:', e);
            }
        } else if (Notification.permission !== 'denied') {
            // Request permission
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body: message, icon: 'icons/icon.svg' });
                }
            });
        }
    }
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
    categories: ['foundations', 'presence', 'collective-wisdom', 'creation', 'thought-leaders', 'nondual-understanding', 'tantric-yoga'],
    categoryLabels: {
        'foundations': 'Foundations',
        'presence': 'Presence',
        'collective-wisdom': 'Collective Wisdom',
        'creation': 'Creation',
        'thought-leaders': 'Life, Business & Beyond',
        'nondual-understanding': 'Nondual Understanding',
        'tantric-yoga': 'Tantric Yoga'
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
    'thought-leaders': [],
    'nondual-understanding': [],
    'tantric-yoga': []
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
    renderSignalHistory('favorites');
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
