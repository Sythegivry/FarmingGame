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
    if (!tile.isGrowing() || !tile.plantedAt || !tile.cropId)
    return 0;

    const elapsed = Date.now() - tile.plantedAt;
    const totalTime = GameData.getCropGrowTime(tile.cropId);
    return Math.min(elapsed / totalTime, 1); // Claimp UI bars if timers desync
}

// ======== Save & Load System ========
function saveGame() {
    const saveData = {
        version: "0.1",
        coins: farm.coins,
        selectedCrop: farm.selectedCrop,
        farmGrid: farm.grid.map(tile => ({
            state: tile.state,
            cropId: tile.cropId,
            plantedAt: tile.plantedAt
        })),
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
        farm.coins = save.coins || 0;
        farm.selectedCrop = save.selectedCrop || 'carrot';
        
        // Restore grid
        farm.grid = save.farmGrid.map(tileData => {
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
        const readyCrops = farm.grid.filter(tile => tile.isReady()).length;
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
    autoSaveInterval = setInterval (() => {
        console.log("Auto-saving game...");
        saveGame();
    }, 60000);
}
        
function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
}

// Tile State System
const TILE_STATE = {
    EMPTY: "empty",
    GROWING: "growing",
    READY: "ready",
    WITHERED: "withered", // Future expansion
    FERTILIZED: "fertilized" // Future expansion
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

// Crop 
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
    sweat_potato: {
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

// Farm
const SIZE = 5;
const GROW_TIME = 5000; // 5 seconds

const farm = {
    coins: 0,
    grid: [],
    selectedCrop: 'corn' // Default selected crop
};

// Init tile structure
for (let i = 0; i < SIZE * SIZE; i++) {
    farm.grid.push(new Tile());
}

// Render Grid
const farmEl = document.getElementById("farm");
const coinsEl = document.getElementById("coins");
const cropSelectorEl = document.getElementById("crop-selector");

function render() {
    farmEl.innerHTML = "";
    
    farm.grid.forEach((tile, index) => {
        const el = document.createElement("div");
        el.className = "tile";
        
        // Check transition on growth
        tile.checkGrowthProgress();
        
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

        el.onclick = () => handleTileClick(index);
        farmEl.appendChild(el);
    });
    
    coinsEl.textContent = `Coins: ${farm.coins}`;
}

// Plant / Harvest Logic
function handleTileClick(index) {
    const tile = farm.grid[index];
    
    // Empty > Plant
    if (tile.isEmpty()) {
        tile.plant(farm.selectedCrop);
        return;
    }
    
    // Planted > Check if ready
    if (tile.isReady()) {
        const cropValue = GameData.getCropValue(tile.cropId);
        tile.harvest();
        farm.coins += cropValue;
    }
}

// Crop selection
function selectCrop(cropName) {
  if (GameData.isValidCrop(cropName)) {
      farm.selectedCrop = cropName;
      updateCropSelectorUI();
    }
}

function updateCropSelectorUI() {
    const buttons = cropSelectorEl.querySelectorAll('.crop-btn');
    buttons.forEach(btn => {
        if (btn.dataset.crop === farm.selectedCrop) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function initCropSelector() {
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
        btn.innerHTML = `${cropData.icon} ${cropData.name}`;
        btn.onclick = () => selectCrop(cropId);
        cropsSection.appendChild(btn);
    });
    
    // Add crops to main section on selector element
    cropSelectorEl.appendChild(cropsSection);
    
    updateCropSelectorUI();
}

function initSaveLoadButtons() {
    const saveBtn = document.getElementById("manual-save-button");
    const loadBtn = document.getElementById("manual-load-button");
    
    if (saveBtn) {
        saveBtn.onclick = () => {
            saveGame();
        };
    }
    
    if (loadBtn) {
        loadBtn.onclick = () => {
            loadGame();
            render(); // Refresh display after loading
        };
    }
}
    

// Initialize
initCropSelector();
initSaveLoadButtons();
render();
startAutoSave();

// Game Loop
setInterval(render, 1000);