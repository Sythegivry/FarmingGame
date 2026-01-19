// GAME STATE (data only)
const GameState = {
    coins: 0,
    selectedCrop: 'corn',
    unlockedTiles: 1,
    maxTiles: 25,
    tiles: [],
    player: {
        level: 1,
        xp: 0,
        xpToNext: 100
    }
};

// Grid size constant
const SIZE = 5;

// GAME LOGIC (no DOM access)
function plantCrop(tile, cropId) {
    tile.cropId = cropId;
    tile.plantedAt = Date.now();
    tile.state = TILE_STATE.GROWING;
}

function harvestTile(tile) {
    const crop = GameData.getCropData(tile.cropId);
    GameState.coins += crop.value;
    GameState.player.xp += getCropXP(crop);
    tile.cropId = null;
    tile.plantedAt = null;
    tile.state = TILE_STATE.EMPTY;
    // Emit harvest event
    EventSystem.emit('cropHarvested', {cropId: tile.cropId});
}

// GAME UPDATE LOOP (logic only)
function updateGame() {
    GameState.tiles.forEach(tile => {
        tile.checkGrowthProgress();
    });
}

// RENDERING (DOM only)
function renderCoins(coins) {
    if (coinsEl) {
        coinsEl.textContent = `Coins: ${coins}`;
    }
}

function renderTiles(tiles) {
    if (!farmEl) return;
    farmEl.innerHTML = "";
    tiles.forEach((tile, index) => {
        const el = document.createElement("div");
        el.className = "tile";
        
        if (index >= GameState.unlockedTiles) {
            el.classList.add("locked");
            el.textContent = "🔒";
        } else {
            // Render current state
            if (tile.isEmpty()) {
                el.classList.add('empty');
                el.textContent = "Empty";
            } else if (tile.isGrowing()) {
                el.classList.add('growing');
                
                // Show time remaining
                const progress = getGrowthProgress(tile);
                const timeRemaining = tile.getTimeRemaining();
                
                el.innerHTML = `
                <div class="crop-content">
                <div class="crop-emoji">🌱</div>
                <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress * 100}%"></div>
                </div>
                <div class="time-remaining">${formatTimeRemaining(timeRemaining)}</div>
                </div>`;
            } else if (tile.isReady()) {
                el.classList.add('ready');
                const cropIcon = GameData.getCropIcon(tile.cropId);
                el.textContent = cropIcon;
            }
        }
        el.onclick = () => handleTileClick(index);
        farmEl.appendChild(el);
    });
}

function renderGame() {
    renderCoins(GameState.coins);
    renderTiles(GameState.tiles);
    renderPlayerStats();
}

// MAIN LOOP
setInterval(() => {
    updateGame();
    renderGame();
}, 1000);

// ========== Page Switch ==========
const pageButtons = document.querySelectorAll('.page-switcher button');
const pages = document.querySelectorAll('.page');

function switchPage(pageName) {
  // Hide all pages
  pages.forEach(page => {
    page.classList.remove('active');
  });

  // Deactivate all buttons
  pageButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  // Activate selected page
  const page = document.querySelector(`.page[data-page="${pageName}"]`);
  const button = document.querySelector(`.page-switcher button[data-page="${pageName}"]`);

  if (page) page.classList.add('active');
  if (button) button.classList.add('active');
}

// Attach events
pageButtons.forEach(button => {
  button.addEventListener('click', () => {
    const pageName = button.dataset.page;
    switchPage(pageName);
  });
});

// ========== Export/Import Save ==========
function getSaveData() {
  return {
    version: 1,
    savedAt: Date.now(),
    coins: GameState.coins,
    selectedCrop: GameState.selectedCrop,
    unlockedTiles: GameState.unlockedTiles,
    farmGrid: GameState.tiles.map(tile => ({
        state: tile.state,
        cropId: tile.cropId,
        plantedAt: tile.plantedAt
    })),
    player: GameState.player
  };
}

// Base64 Encode to safe text string
function exportSaveAsText() {
  const saveData = getSaveData();
  const json = JSON.stringify(saveData);
  return btoa(json);
}

// Import from text
function importSaveFromText(encoded) {
    try {
        const json = atob(encoded.trim());
        const data = JSON.parse(json);

        if (!data || !data.version) {
            throw new Error("Invalid save format!");
        }

        // Validate version
        if (data.version !== 1) {
            throw new Error(`Incompatible save version: ${data.version}. Current version: 0.1`);
        }

        // Confirm import
        if (!confirm("This will overwrite your current save. Continue?")) {
            return;
        }

        GameState.coins = data.coins || 0;
        GameState.selectedCrop = data.selectedCrop || 'corn';
        GameState.unlockedTiles = data.unlockedTiles || 1;

        // Load player progression
        if (data.player) {
            GameState.player.level = data.player.level || 1;
            GameState.player.xp = data.player.xp || 0;
            GameState.player.xpToNext = data.player.xpToNext || 100;
        }

        // Restore grid
        GameState.tiles = data.farmGrid.map(tileData => {
            const tile = new Tile();
            tile.state = tileData.state || TILE_STATE.EMPTY;
            tile.cropId = tileData.cropId;
            tile.plantedAt = tileData.plantedAt;

            // Check offline growth
            if (tile.isGrowing() && tile.plantedAt && tile.cropId) {
                tile.checkGrowthProgress();
            }

            return tile;
        });

        saveGame();
        renderGame();

        showSaveStatus("Save imported!");
    } catch (err) {
        console.error("Failed to import save:", err.message);
        showSaveStatus("Import failed: " + err.message);
    }
}

// Time utils
const TIME_FORMATS = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000 
};

// Formats a remaining time (ms) into a short string ("2h 5m")
function formatTimeRemaining(ms) {
    if (ms <= 0) return "Ready!";

    const totalSeconds = Math.ceil(ms / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

// Return crop growth progress
function getGrowthProgress(tile) {
    if (!tile.isGrowing() || !tile.plantedAt || !tile.cropId) {
        return 0;
    }
    
    const totalTime = GameData.getCropGrowTime(tile.cropId);
    if (!totalTime || totalTime <= 0) {
        return 0;
    }
    
    const elapsed = Math.max(0, Date.now() - tile.plantedAt);
    return Math.min(elapsed / totalTime, 1);

}

// ========== EXPERIENCE & LEVELING SYSTEM ==========

// Rarity XP multipliers
const RARITY_XP = {
  common: 1.2,
  uncommon: 1.5,
  rare: 2.5,
  epic: 5,
  legendary: 7,
  mythic: 12
};

// Calculate XP for a crop based on its time and rarity
function getCropXP(crop) {
    const minutes = crop.time / 60000;
    
    const baseXP = Math.log2(minutes + 1) * 5;
    return Math.floor(baseXP * RARITY_XP[crop.rarity]);
}

// Event System for decoupling gameplay mechanics
const EventSystem = {
  listeners: {},
  
  // Subscribe to an event
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },
  
  // Emit an event
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  },
  
  // Unsubscribe from an event
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
};

// Level up event listener to refresh crop selector
EventSystem.on('playerLevelUp', (data) => {
  // Refresh crop selector to show newly unlocked crops
  initCropSelector();
});

// Gain XP and handle level progression
function gainXP(amount) {
  GameState.player.xp += amount;

  while (GameState.player.xp >= GameState.player.xpToNext) {
    GameState.player.xp -= GameState.player.xpToNext;
    levelUp();
  }
}

// Calculate XP needed for next level (progressive scaling)
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

// Handle level up
function levelUp() {
  GameState.player.level++;
  GameState.player.xpToNext = xpForLevel(GameState.player.level);

  // Emit level up event for future features
  EventSystem.emit('playerLevelUp', { newLevel: GameState.player.level });
}

// Check if crop is unlocked based on player level
function isCropUnlocked(crop) {
  return GameState.player.level >= crop.unlockLevel;
}

// ======== Save & Load System ========
function saveGame() {
    const saveData = {
        version: "0.1",
        coins: GameState.coins,
        selectedCrop: GameState.selectedCrop,
        unlockedTiles: GameState.unlockedTiles,
        farmGrid: GameState.tiles.map(tile => ({
            state: tile.state,
            cropId: tile.cropId,
            plantedAt: tile.plantedAt
        })),
        player: GameState.player,
        lastSavedAt: Date.now()
    };

    try {
        localStorage.setItem("farmGame", JSON.stringify(saveData));
        showSaveStatus("Game saved!");
        return true;
    } catch (error) {
        console.error("Failed to save game:", error);
        showSaveStatus("Save failed!");
        return false;
    }
}

function loadGame() {
    const data = localStorage.getItem("farmGame");
    if (!data) return false;

    try {
        const save = JSON.parse(data);
        GameState.coins = save.coins || 0;
        GameState.selectedCrop = save.selectedCrop || 'corn';
        GameState.unlockedTiles = save.unlockedTiles || 1;

        // Load player progression
        if (save.player) {
            GameState.player.level = save.player.level || 1;
            GameState.player.xp = save.player.xp || 0;
            GameState.player.xpToNext = save.player.xpToNext || 100;
        }

        // Restore grid
        GameState.tiles = save.farmGrid.map(tileData => {
            const tile = new Tile();
            tile.state = tileData.state || TILE_STATE.EMPTY;
            tile.cropId = tileData.cropId;
            tile.plantedAt = tileData.plantedAt;

            // Check offline growth
            if (tile.isGrowing() && tile.plantedAt && tile.cropId) {
                tile.checkGrowthProgress();
            }

            return tile;
        });

        // Load notification
        const readyCrops = GameState.tiles.filter(tile => tile.isReady()).length;
        if (readyCrops > 0) {
            setTimeout(() => {
                alert(`Welcome back! ${readyCrops} crop${readyCrops > 1 ? 's are' : ' is'} ready to harvest!`);
            }, 500);
        }

        showSaveStatus("Game loaded!");
        return true;
    } catch (error) {
        console.error("Failed to load game:", error);
        showSaveStatus("Load failed!");
        return false;
    }
}

// Temporary 3s save status message with visual feedback and console fallback
function showSaveStatus(message) {
    const statusEl = document.getElementById("save-status");
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.display = "block";
        statusEl.style.background = message.includes("failed") ? "#ffebee" : "#e8f5e8";
        statusEl.style.color = message.includes("failed") ? "#c62828" : "#2e7d32";
        setTimeout(() => {
            statusEl.style.display = "none";
        }, 3000);
    } else {
        // Fallback console
        console.log(message);
    }
}

function clearSave() {
    if (confirm("Do you REALLY want to clear your save data? This cannot be undone!")) {
        localStorage.removeItem("farmGame");
        showSaveStatus("Welp, there it goes, bye save data.");
    }
}

// Auto-save on 60s
let autoSaveInterval;
function startAutoSave() {
    autoSaveInterval = setInterval(() => {
        saveGame();
    }, 60000);
}
        
function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
}

// ======== Tile State System ========
const TILE_STATE = {
    EMPTY: "empty",
    GROWING: "growing",
    READY: "ready",
    WITHERED: "withered", // Future expansion
    FERTILIZED: "fertilized" // Future expansion
};

// Crops
const CROPS = {
    corn: {
        name: "Corn",
        category: "crop",
        time: 20000,
        value: 10,
        icon: '🌽',
        rarity: "common",
        unlockLevel: 0
    },
    carrot: {
        name: "Carrot", 
        category: "crop",
        time: 30000,
        value: 17,
        icon: '🥕',
        rarity: "common",
        unlockLevel: 2
    },
    rice: {
        name: "Rice",
        category: "crop", 
        time: 1 * TIME_FORMATS.DAY,
        value: 760,
        icon: '🌾',
        rarity: "rare",
        unlockLevel: 3
    },
    barley: {
        name: "Barley",
        category: "crop",
        time: 8 * TIME_FORMATS.HOUR,
        value: 360,
        icon: '🌾',
        rarity: "rare",
        unlockLevel: 3
    },
    cabbage: {
        name: "Cabbage",
        category: "crop",
        time: 4 * TIME_FORMATS.MINUTE,
        value: 33,
        icon: '🥬',
        rarity: "common", 
        unlockLevel: 4
    },
    peppers: {
        name: "Peppers",
        category: "crop",
        time: 18 * TIME_FORMATS.MINUTE,
        value: 90,
        icon: '🫑',
        rarity: "common",
        unlockLevel: 4
    },
    coffee: {
        name: "Coffee",
        category: "crop",
        time: 30 * TIME_FORMATS.MINUTE,
        value: 155,
        icon: '☕',
        rarity: "uncommon",
        unlockLevel: 5
    },
    cotton: {
        name: "Cotton",
        category: "crop",
        time: 2 * TIME_FORMATS.DAY,
        value: 1850,
        icon: '🌿',
        rarity: "uncommon",
        unlockLevel: 6
    },
    cucumber: {
        name: "Cucumber",
        category: "crop",
        time: 4 * TIME_FORMATS.HOUR,
        value: 210,
        icon: '🥒',
        rarity: "common",
        unlockLevel: 7
    },
    eggplant: {
        name: "Eggplant",
        category: "crop",
        time: 12 * TIME_FORMATS.HOUR,
        value: 1100,
        icon: '🍆',
        rarity: "uncommon",
        unlockLevel: 8
    },
    garlic: {
        name: "Garlic",
        category: "crop",
        time: 12 * TIME_FORMATS.MINUTE,
        value: 68,
        icon: '🧄',
        rarity: "common",
        unlockLevel: 10
    },
    lettuce: {
        name: "Lettuce",
        category: "crop",
        time: 1 * TIME_FORMATS.HOUR,
        value: 225,
        icon: '🥬',
        rarity: "common",
        unlockLevel: 12
    },
    potato: {
        name: "Potato",
        category: "crop",
        time: 10 * TIME_FORMATS.MINUTE,
        value: 66,
        icon: '🥔',
        rarity: "common",
        unlockLevel: 14
    },
    peas: {
        name: "Peas",
        category: "crop",
        time: 5 * TIME_FORMATS.DAY,
        value: 4100,
        icon: '🟢',
        rarity: "uncommon",
        unlockLevel: 15
    },
    spinach: {
        name: "Spinach",
        category: "crop",
        time: 2 * TIME_FORMATS.HOUR,
        value: 215,
        icon: '🥬',
        rarity: "common",
        unlockLevel: 15
    },
    strawberry: {
        name: "Strawberry",
        category: "crop",
        time: 8 * TIME_FORMATS.DAY,
        value: 9400,
        icon: '🍓',
        rarity: "uncommon",
        unlockLevel: 17
    },
    sweet_potato: {
        name: "Sweet Potato",
        category: "crop",
        time: 28 * TIME_FORMATS.HOUR,
        value: 2400,
        icon: '🍠',
        rarity: "common",
        unlockLevel: 18
    },
    tomato: {
        name: "Tomato",
        category: "crop",
        time: 25 * TIME_FORMATS.MINUTE,
        value: 820,
        icon: '🍅',
        rarity: "common",
        unlockLevel: 18
    },
    watermelon: {
        name: "Watermelon",
        category: "crop",
        time: 7 * TIME_FORMATS.MINUTE,
        value: 290,
        icon: '🍉',
        rarity: "common",
        unlockLevel: 19
    },
    wheat: {
        name: "Wheat",
        category: "crop",
        time: 36 * TIME_FORMATS.HOUR,
        value: 9800,
        icon: '🌾',
        rarity: "common",
        unlockLevel: 20
    },
    // High-value crops
    golden_wheat: {
        name: "Golden Wheat",
        category: "crop",
        time: 1 * TIME_FORMATS.HOUR,
        value: 420,
        icon: '🌾',
        rarity: "legendary",
        unlockLevel: 15
    },
    mystic_berry: {
        name: "Mystic Berry",
        category: "crop", 
        time: 1 * TIME_FORMATS.DAY,
        value: 5400,
        icon: '🫐',
        rarity: "mythic",
        unlockLevel: 35
    },
};

// Game Data Manager
const GameData = {
    crops: CROPS,
    
    getCropData: (cropId) => {
        return GameData.crops[cropId];
    },
    
    getCropGrowTime: (cropId) => {
        const crop = GameData.getCropData(cropId);
        return crop ? crop.time : 5000;
    },
    
    getCropValue: (cropId) => {
        const crop = GameData.getCropData(cropId);
        return crop ? crop.value : 10;
    },
    
    getCropIcon: (cropId) => {
        const crop = GameData.getCropData(cropId);
        return crop ? crop.icon : '🌱';
    },
    
    isValidCrop: (cropId) => {
        return !!GameData.crops[cropId];
    },
    
    getAllCrops: () => {
        return Object.keys(GameData.crops);
    }
};

// Tile constructor
class Tile {
    constructor() {
        this.state = TILE_STATE.EMPTY;
        this.cropId = null;
        this.plantedAt = null;
    }
    
    // State transition helper
    plant(cropId) {
        this.state = TILE_STATE.GROWING;
        this.cropId = cropId;
        this.plantedAt = Date.now();
    }
    
    markReady() {
        this.state = TILE_STATE.READY;
    }
    
    harvest() {
        this.state = TILE_STATE.EMPTY;
        this.cropId = null;
        this.plantedAt = null;
    }
        
    isReady() {
        return this.state === TILE_STATE.READY;
    }
    
    isEmpty() {
        return this.state === TILE_STATE.EMPTY;
    }
    
    isGrowing() {
        return this.state === TILE_STATE.GROWING;
    }
    
    // Time based check on crops
    checkGrowthProgress() {
        if (this.isGrowing() && this.plantedAt && this.cropId) {
            const elapsed = Date.now() - this.plantedAt;
            const cropGrowTime = GameData.getCropGrowTime(this.cropId);
            
            if (elapsed >= cropGrowTime) {
                this.markReady();
                return true; // State changed
            }
        }
        return false; // No state change
    }
    getTimeRemaining(){
        if (!this.isGrowing() || !this.plantedAt || !this.cropId)
            return 0;

        const elapsed = Date.now() - this.plantedAt;
        const totalTime = GameData.getCropGrowTime(this.cropId);
        return Math.max(totalTime - elapsed, 0);
    }
}

// Initialize tiles
for (let i = 0; i < SIZE * SIZE; i++) {
    GameState.tiles.push(new Tile());
}

// HTML Elements
const farmEl = document.getElementById("farm");
const coinsEl = document.getElementById("coins");
const cropSelectorEl = document.getElementById("crop-selector");
const tooltip = document.getElementById("tooltip");

// ======== FLOATING TOOLTIP ========
const Tooltip = {
    el: document.getElementById("tooltip"),

    show(html, x, y) {
        this.el.innerHTML = html;
        this.el.style.left = x + "px";
        this.el.style.top = y + "px";
        this.el.classList.remove("hidden");
    },

    hide() {
        this.el.classList.add("hidden");
    }
}

document.addEventListener("mousemove", e => {
    if (!e.target.dataset.tooltip) return;

    Tooltip.show(e.target.dataset.tooltip, e.clientX + 14, e.clientY + 14);
});

document.addEventListener("mouseout", e => {
    if (e.target.dataset.tooltip) Tooltip.hide();
});



// Render player Stats (level, xp, progress bar)
function renderPlayerStats() {
    const levelEl = document.getElementById("level-display");
    const xpEl = document.getElementById("xp-display");
    const progressFillEl = document.getElementById("xp-progress-fill");

    if (levelEl) {
        levelEl.textContent = `Level: ${GameState.player.level}`;
    }

    if (xpEl) {
        xpEl.textContent = `XP: ${GameState.player.xp} / ${GameState.player.xpToNext}`;
    }

    if (progressFillEl) {
        const progress = (GameState.player.xp / GameState.player.xpToNext) * 100;
        progressFillEl.style.width = `${progress}%`;
    }
}

// Plant / Harvest Logic
function handleTileClick(index) {
    if (index >= GameState.unlockedTiles) {
        return;
    }
    const tile = GameState.tiles[index];

    // Empty > Plant
    if (tile.isEmpty()) {
        plantCrop(tile, GameState.selectedCrop);
        return;
    }

    // Planted > Check if ready
    if (tile.isReady()) {
        harvestTile(tile);
    }
}

// Crop selection
function selectCrop(cropName) {
  if (GameData.isValidCrop(cropName)) {
      GameState.selectedCrop = cropName;
      updateCropSelectorUI();
    }
}

function updateCropSelectorUI() {
    if (!cropSelectorEl) return;
    const buttons = cropSelectorEl.querySelectorAll('.crop-btn');
    buttons.forEach(btn => {
        if (btn.dataset.crop === GameState.selectedCrop) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function initCropSelector() {
    if (!cropSelectorEl) {
        console.warn("crop-selector element not found!")
        return;
    }
    cropSelectorEl.innerHTML = '';
    
    // Wrapper div and header for crop selection
    const cropsSection = document.createElement('div');
    cropsSection.className = 'crop-section';
    cropsSection.innerHTML = '<h3>Crops</h3>';
    
    /*
    Loop through all crop IDs from game data
    Retrieve the data for current crop
    Create a button for crop
    Store the ID reference (data attribute)
    Display crop icon and name on button
    Select when click
    Add button to crop section
    */
    GameData.getAllCrops().forEach(cropId => {
        const cropData = GameData.getCropData(cropId);
        const btn = document.createElement('button');
        btn.className = 'crop-btn';
        btn.dataset.crop = cropId;

        if (isCropUnlocked(cropData)) {
            btn.innerHTML = `${cropData.icon} ${cropData.name}`;
            btn.dataset.tooltip = `<b>${cropData.name}</b><br>⏱ ${formatTimeRemaining(cropData.time)}<br>💰 ${cropData.value} coins`;
            btn.onclick = () => selectCrop(cropId);
        } else {
            btn.innerHTML = `🔒 ${cropData.icon} ${cropData.name} (Lv.${cropData.unlockLevel})`;
            btn.disabled = true;
            btn.classList.add('locked');
        }
        cropsSection.appendChild(btn);
    });
    
    // Add crops to main section on selector element
    cropSelectorEl.appendChild(cropsSection);
    
    updateCropSelectorUI();
}

function tileUnlockCost(tileCount) {
    return Math.floor(75 * Math.pow(tileCount, 1.9));
}

const unlockBtn = document.getElementById("unlockTileBtn");

function updateUnlockButton() {
    if (!unlockBtn) return;
    if (GameState.unlockedTiles >= GameState.maxTiles) {
        unlockBtn.disabled = true;
        unlockBtn.textContent = "All tiles unlocked";
        return;
    }

    const cost = tileUnlockCost(GameState.unlockedTiles);

    if (GameState.coins >= cost) {
        unlockBtn.disabled = false;
        unlockBtn.textContent = `Unlock Tile (${cost} coins)`;
    } else {
        unlockBtn.disabled = true;
        unlockBtn.textContent = `Unlock Tile (${cost} coins)`;
    }
}

unlockBtn.onclick = () => {
    const cost = tileUnlockCost(GameState.unlockedTiles);

    if (GameState.coins < cost) return;

    GameState.coins -= cost;
    GameState.unlockedTiles++;

    updateUnlockButton();
    renderGame();
};
  
function initSaveLoadButtons() {
    const saveBtn = document.getElementById("manual-save-button");
    const loadBtn = document.getElementById("manual-load-button");
    const exportBtn = document.getElementById("export-save-button");
    const importBtn = document.getElementById("import-save-button");

    if (saveBtn) {
        saveBtn.onclick = () => {
            saveGame();
        };
    }

    if (loadBtn) {
        loadBtn.onclick = () => {
            loadGame();
            updateUnlockButton();
            renderGame(); // Refresh display after loading
        };
    }

    if (exportBtn) {
        exportBtn.onclick = () => {
            const saveString = exportSaveAsText();
            prompt("Save this text somewhere safe:", saveString);
        };
    }

    if (importBtn) {
        importBtn.onclick = () => {
            const saveString = prompt("Paste your save text:");
            if (saveString) {
                importSaveFromText(saveString);
                updateUnlockButton();
                renderGame(); // Refresh display after importing
            }
        };
    }
}

function initHamburgerMenu() {
    const hamburgerBtn = document.getElementById("hamburger-menu");
    const dropdownMenu = document.getElementById("dropdown-menu");

    if (hamburgerBtn && dropdownMenu) {
        hamburgerBtn.addEventListener("click", () => {
            const isVisible = dropdownMenu.style.display === "flex";
            dropdownMenu.style.display = isVisible ? "none" : "flex";
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (event) => {
            if (!hamburgerBtn.contains(event.target) && !dropdownMenu.contains(event.target)) {
                dropdownMenu.style.display = "none";
            }
        });
    }
}
    

// Initialize
loadGame();
initCropSelector();
initSaveLoadButtons();
initHamburgerMenu();
updateUnlockButton();
renderGame();
startAutoSave();
