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
}

// Crop 
const CROPS = {
    corn: {
        name: "Corn",
        category: "crop",
        time: 7000,
        value: 15,
        icon: '🌽',
        rarity: "common",
        unlockLevel: 1
    },
    carrot: {
        name: "Carrot", 
        category: "crop",
        time: 3000,
        value: 5,
        icon: '🥕',
        rarity: "common",
        unlockLevel: 1
    },
    rice: {
        name: "Rice",
        category: "crop", 
        time: 4500,
        value: 7,
        icon: '🌾',
        rarity: "common",
        unlockLevel: 1
    },
    barley: {
        name: "Barley",
        category: "crop",
        time: 4500, 
        value: 7,
        icon: '🌾',
        rarity: "common",
        unlockLevel: 1
    },
    cabbage: {
        name: "Cabbage",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🥬',
        rarity: "common", 
        unlockLevel: 1
    },
    peppers: {
        name: "Peppers",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🫑',
        rarity: "common",
        unlockLevel: 1
    },
    coffee: {
        name: "Coffee",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '☕',
        rarity: "common",
        unlockLevel: 1
    },
    cotton: {
        name: "Cotton",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🌿',
        rarity: "common",
        unlockLevel: 1
    },
    cucumber: {
        name: "Cucumber",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🥒',
        rarity: "common",
        unlockLevel: 1
    },
    eggplant: {
        name: "Eggplant",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🍆',
        rarity: "common",
        unlockLevel: 1
    },
    garlic: {
        name: "Garlic",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🧄',
        rarity: "common",
        unlockLevel: 1
    },
    lettuce: {
        name: "Lettuce",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🥬',
        rarity: "common",
        unlockLevel: 1
    },
    potatoe: {
        name: "Potato",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🥔',
        rarity: "common",
        unlockLevel: 1
    },
    peas: {
        name: "Peas",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🟢',
        rarity: "common",
        unlockLevel: 1
    },
    spinach: {
        name: "Spinach",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🥬',
        rarity: "common",
        unlockLevel: 1
    },
    strawberry: {
        name: "Strawberry",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🍓',
        rarity: "common",
        unlockLevel: 1
    },
    sweat_potato: {
        name: "Sweet Potato",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🍠',
        rarity: "common",
        unlockLevel: 1
    },
    tomato: {
        name: "Tomato",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🍅',
        rarity: "common",
        unlockLevel: 1
    },
    watermelon: {
        name: "Watermelon",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🍉',
        rarity: "common",
        unlockLevel: 1
    },
    wheat: {
        name: "Wheat",
        category: "crop",
        time: 4500,
        value: 7,
        icon: '🌾',
        rarity: "common",
        unlockLevel: 1
    }
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
    selectedCrop: 'corn'
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
            el.textContent = "🌱";
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

// Initialize
initCropSelector();
render();

// Game Loop
setInterval(render, 1000);