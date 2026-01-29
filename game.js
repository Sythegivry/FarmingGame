// ======== Tile State System ========
const TILE_STATE = {
    EMPTY: "empty",
    GROWING: "growing",
    READY: "ready",
    WITHERED: "withered", // Future expansion
    FERTILIZED: "fertilized", // Future expansion
    WATERED: "watered", // Future expansion
};

// GAME STATE (data only)
const GameState = {
    coins: 0,
    selectedCrop: 'corn',
    selectedTree: 'oak',
    mode: 'normal', // 'normal' | 'remove'
    ui: {
        activePage: 'farm'
    },
    farm: {
        unlockedTiles: 1,
        maxTiles: 25,
        tiles: []
    },
    trees: {
        unlocked: false,
        unlockedTiles: 1,
        maxTiles: 9,
        tiles: [],
        saplingsUnlocked: {
            oak: false,
            birch: false,
            maple: false,
            pine: false,
            cedar: false,
            ebony: false,
            worldTree: false
        }
    },
    player: {
        level: 1,
        xp: 0,
        xpToNext: 100
    }
};

// Grid size constant
const FARM_SIZE = 5;
const TREE_SIZE = 3;

// ======== SIMPLE LOGGER SYSTEM ========

const Logger = {
    enabled: false,

    log(level, message, context = '') {
        if (!this.enabled) return;

        const prefix = `[FarmGame ${level.toUpperCase()}]`;
        const location = context ? ` (${context})` : '';
        const output = `${prefix}${location}: ${message}`;

        switch (level) {
            case 'error':
                console.error(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    },

    error(msg, ctx) { this.log('error', msg, ctx); },
    warn(msg, ctx) { this.log('warn', msg, ctx); },
    info(msg, ctx) { this.log('info', msg, ctx); }
};

// Safe event emission with simple error handling
function safeEmit(event, payload) {
    try {
        EventSystem.emit(event, payload);
    } catch (error) {
        Logger.error(`Event emission failed: ${error.message}`, 'safeEmit');
    }
}



function plantCrop(tile, cropId) {
    try {

        if (!tile) {
            Logger.error('Tile is null or undefined', 'plantCrop');
            return false;
        }
        
        if (!cropId || typeof cropId !== 'string') {
            Logger.error('Invalid crop ID', 'plantCrop');
            return false;
        }
        
        if (!GameData.isValidCrop(cropId)) {
            Logger.error(`Crop ID not found: ${cropId}`, 'plantCrop');
            return false;
        }
        
        if (tile.isReady() || tile.isGrowing()) {
            Logger.error('Cannot plant on occupied tile', 'plantCrop');
            return false;
        }
        
        tile.cropId = cropId;
        tile.plantedAt = Date.now();
        tile.state = TILE_STATE.GROWING;
        
        if (DEV_MODE) {
            if (!tile.cropId || tile.cropId !== cropId) {
                throw new Error(`Assertion failed: cropId not set correctly. Expected: ${cropId}, Got: ${tile.cropId}`);
            }
            if (!tile.plantedAt || tile.plantedAt <= 0) {
                throw new Error(`Assertion failed: plantedAt not set correctly. Got: ${tile.plantedAt}`);
            }
            if (tile.state !== TILE_STATE.GROWING) {
                throw new Error(`Assertion failed: state not set to GROWING. Got: ${tile.state}`);
            }
        }
        
        return true;
    } catch (error) {
        Logger.error(error.message, 'plantCrop');
        return false;
    }
}

function harvestTile(tile) {
    try {
        if (!tile) {
            Logger.error('Tile is null or undefined', 'harvestTile');
            return false;
        }
        
        if (!tile.cropId) {
            Logger.error('Tile has no crop planted', 'harvestTile');
            return false;
        }
        
        const crop = GameData.getCropData(tile.cropId);
        if (!crop) {
            Logger.error(`Crop data not found for: ${tile.cropId}`, 'harvestTile');
            return false;
        }

        if (!tile.isReady()) {
            Logger.error('Cannot harvest unready crop', 'harvestTile');
            return false;
        }
        
        GameState.coins += crop.value;
        const cropXP = getCropXP(crop);
        gainXP(cropXP);

        tile.harvest();
        clearTileCache(tile);

        try {
            renderPlayerStats();
            renderCoins(GameState.coins);
        } catch (renderError) {
            Logger.error(`UI update failed: ${renderError.message}`, 'harvestTile');
            if (coinsEl) {
                coinsEl.textContent = `Coins: ${GameState.coins}`;
            }
        }

        safeEmit('cropHarvested', { cropId: tile.cropId });

        return true;
    } catch (error) {
        Logger.error(error.message, 'harvestTile');
        return false;
    }
}

function plantTree(tile, treeId) {
    try {
        if (!tile) {
            Logger.error('Tile is null or undefined', 'plantTree');
            return false;
        }
        
        if (!treeId || typeof treeId !== 'string') {
            Logger.error('Invalid tree ID', 'plantTree');
            return false;
        }
        
        if (!GameData.isValidTree(treeId)) {
            Logger.error(`Tree ID not found: ${treeId}`, 'plantTree');
            return false;
        }

        if (tile.isReady() || tile.isGrowing()) {
            Logger.error('Cannot plant on occupied tile', 'plantTree');
            return false;
        }
        
        tile.plant(treeId);
        return true;

    } catch (error) {
        Logger.error(error.message, 'plantTree');
        return false;
    }
}

function unlockTile(tileType) {
    try {
        if (!tileType || (tileType !== 'farm' && tileType !== 'tree')) {
            Logger.error('Invalid tile type', 'unlockTile');
            return false;
        }
        
        const gameState = tileType === 'farm' ? GameState.farm : GameState.trees;
        
        if (gameState.unlockedTiles >= gameState.maxTiles) {
            Logger.error(`All ${tileType} tiles are already unlocked`, 'unlockTile');
            return false;
        }
        
        // Cost based on tile type
        const cost = tileType === 'farm' ? tileUnlockCost(gameState.unlockedTiles) : treeTileUnlockCost(gameState.unlockedTiles);
        
        if (GameState.coins < cost) {
            Logger.error(`Insufficient coins to unlock ${tileType} tile`, 'unlockTile');
            return false;
        }
        
        GameState.coins -= cost;
        gameState.unlockedTiles++;
        
        renderCoins(GameState.coins);
        renderGame();
        
        if (tileType === 'farm') {
            updateUnlockButton();
        } else {
            updateUnlockTreeButton();
        }
        
        return true;
    } catch (error) {
        Logger.error(error.message, 'unlockTile');
        return false;
    }
}

function harvestTreeTile(tile) {
    try {
        if (!tile) {
            Logger.error('Tile is null or undefined', 'harvestTreeTile');
            return false;
        }
        
        if (!tile.cropId) {
            Logger.error('Tile has no tree planted', 'harvestTreeTile');
            return false;
        }
        
        const tree = GameData.getTreeData(tile.cropId);
        if (!tree) {
            Logger.error(`Tree data not found for: ${tile.cropId}`, 'harvestTreeTile');
            return false;
        }

        if (!tile.isReady()) {
            Logger.error('Cannot harvest unready tree', 'harvestTreeTile');
            return false;
        }
        
        GameState.coins += tree.value;
        const treeXP = getTreeXP(tree);
        gainXP(treeXP);

        tile.harvestTree();
        clearTileCache(tile);

        try {
            renderPlayerStats();
            renderCoins(GameState.coins);
        } catch (renderError) {
            Logger.error(`UI update failed: ${renderError.message}`, 'harvestTreeTile');
            if (coinsEl) {
                coinsEl.textContent = `Coins: ${GameState.coins}`;
            }
        }

        safeEmit('treeHarvested', { treeId: tile.cropId });

        return true;
    } catch (error) {
        Logger.error(error.message, 'harvestTreeTile');
        return false;
    }
}

function debugCropTree(cropId, treeId) {
    console.log('=== CROP DEBUG INFO ===');
    if (cropId && GameData.isValidCrop(cropId)) {
        const crop = GameData.getCropData(cropId);
        console.log(`Crop: ${crop.name}`);
        console.log(`Time: ${crop.time}ms (${formatTimeRemaining(crop.time)})`);
        console.log(`Value: ${crop.value} coins`);
        console.log(`XP: ${getCropXP(crop)} XP`);
        console.log(`Rarity: ${crop.rarity}`);
        console.log(`Unlock Level: ${crop.unlockLevel}`);
    }
    
    console.log('\n=== TREE DEBUG INFO ===');
    if (treeId && GameData.isValidTree(treeId)) {
        const tree = GameData.getTreeData(treeId);
        console.log(`Tree: ${tree.name}`);
        console.log(`Grow Time: ${tree.time}ms (${formatTimeRemaining(tree.time)})`);
        console.log(`Cooldown Time: ${tree.cooldown}ms (${formatTimeRemaining(tree.cooldown)})`);
        console.log(`Value: ${tree.value} coins`);
        console.log(`XP: ${getTreeXP(tree)} XP`);
        console.log(`Rarity: ${tree.rarity}`);
        console.log(`Unlock Cost: ${tree.unlockCost} coins`);
    }
    
    console.log('\n=== EVENT TESTING ===');
    safeEmit('cropHarvested', {cropId: cropId || 'corn'});
    safeEmit('treeHarvested', {treeId: treeId || 'oak'});
}

// Nerd mode
const DEV_MODE = false;

function testLevelUpSystem() {
    if (!DEV_MODE) {
    console.warn('You are not a nerd.');
    return false;
    }

    console.log('=== TESTING LEVEL UP SYSTEM ===');
    
    // Save current state
    const originalLevel = GameState.player.level;
    const originalXP = GameState.player.xp;
    const originalXPToNext = GameState.player.xpToNext;
    
    console.log(`Current state: Level ${originalLevel}, XP: ${originalXP}/${originalXPToNext}`);
    
    // Test 1:
    console.log('\n--- Test 1: Single Level Up ---');
    const xpNeeded = GameState.player.xpToNext - GameState.player.xp + 1;
    console.log(`Gaining ${xpNeeded} XP to trigger level up...`);
    gainXP(xpNeeded);
    
    console.log(`After gainXP(${xpNeeded}): Level ${GameState.player.level}, XP: ${GameState.player.xp}/${GameState.player.xpToNext}`);
    
    // Test 2:
    console.log('\n--- Test 2: Multiple Level Ups ---');
    const currentLevel = GameState.player.level;
    const xpForNextLevel = xpForLevel(currentLevel + 1);
    const xpForLevelAfter = xpForLevel(currentLevel + 2);
    
    console.log(`Gaining ${xpForNextLevel + xpForLevelAfter} XP to trigger multiple level ups...`);
    gainXP(xpForNextLevel + xpForLevelAfter);
    
    console.log(`After multiple level ups: Level ${GameState.player.level}, XP: ${GameState.player.xp}/${GameState.player.xpToNext}`);
    
    // Test 3:
    console.log('\n--- Test 3: Verify No Infinite XP Accumulation ---');
    const beforeXP = GameState.player.xp;
    const beforeLevel = GameState.player.level;
    
    // Add small amount of XP
    gainXP(10);
    
    console.log(`Before: Level ${beforeLevel}, XP: ${beforeXP}/${GameState.player.xpToNext}`);
    console.log(`After: Level ${GameState.player.level}, XP: ${GameState.player.xp}/${GameState.player.xpToNext}`);
    
    if (GameState.player.xp >= GameState.player.xpToNext) {
        console.error('❌ ERROR: XP still accumulating beyond level requirement!');
    } else {
        console.log('✅ SUCCESS: XP properly capped at level requirement');
    }
    
    // Restore original state
    GameState.player.level = originalLevel;
    GameState.player.xp = originalXP;
    GameState.player.xpToNext = originalXPToNext;
    
    console.log('\n=== LEVEL UP SYSTEM TEST COMPLETE ===');
}

function instantGrow(tileType, tileIndex) {
    try {
        if (!DEV_MODE) {
            console.warn('Instant growth is only available if you are a nerd.');
            return false;
        }
        
        if (!tileType || (tileType !== 'farm' && tileType !== 'tree')) {
            console.error('Invalid tile type. Use "farm" or "tree".');
            return false;
        }
        
        const maxTiles = tileType === 'farm' ? FARM_SIZE * FARM_SIZE : TREE_SIZE * TREE_SIZE;
        if (typeof tileIndex !== 'number' || tileIndex < 0 || tileIndex >= maxTiles) {
            console.error(`Invalid tile index. For ${tileType} tiles, use index 0-${maxTiles - 1}.`);
            return false;
        }
        
        const gameState = tileType === 'farm' ? GameState.farm : GameState.trees;
        const tiles = gameState.tiles;
        
        if (tileIndex >= gameState.unlockedTiles) {
            console.warn(`Tile ${tileIndex} is locked. Cannot grow crops/trees on locked tiles.`);
            return false;
        }
        
        const tile = tiles[tileIndex];
        
        if (!tile.isGrowing()) {
            if (tile.isEmpty()) {
                console.warn(`Tile ${tileIndex} (${tileType}) is empty. Plant something first.`);
            } else if (tile.isReady()) {
                console.warn(`Tile ${tileIndex} (${tileType}) is already ready for harvest.`);
            } else {
                console.warn(`Tile ${tileIndex} (${tileType}) is in an unknown state.`);
            }
            return false;
        }
        
        const cropData = GameData.getCropData(tile.cropId) || GameData.getTreeData(tile.cropId);
        const isTree = !!GameData.getTreeData(tile.cropId);
        
        if (!cropData) {
            console.error(`Unknown crop/tree data for ID: ${tile.cropId}`);
            return false;
        }
        
        tile.markReady();
        clearTileCache(tile);
        renderGame();
        
        const tileTypeDisplay = tileType === 'farm' ? 'Crop' : 'Tree';
        console.log(`✅ Instantly grew ${tileTypeDisplay} "${cropData.name}" in ${tileType} tile ${tileIndex}!`);
        
        if (isTree) {
            safeEmit('treeHarvested', { treeId: tile.cropId });
        } else {
            safeEmit('cropHarvested', { cropId: tile.cropId });
        }
        
        return true;
        
    } catch (error) {
        Logger.error(error.message, 'instantGrow');
        console.error('Failed to instantly grow tile:', error.message);
        return false;
    }
}

function instantGrowAll(tileType) {
    try {
        if (!DEV_MODE) {
            console.warn('Instant growth is only available if you are a nerd');
            return false;
        }
        
        if (!tileType || (tileType !== 'farm' && tileType !== 'tree')) {
            console.error('Invalid tile type. Use "farm" or "tree".');
            return false;
        }
        
        const gameState = tileType === 'farm' ? GameState.farm : GameState.trees;
        const tiles = gameState.tiles;
        let grownCount = 0;
        
        tiles.forEach((tile, index) => {
            if (index < gameState.unlockedTiles && tile.isGrowing()) {
                tile.markReady();
                clearTileCache(tile);
                grownCount++;
            }
        });
        
        renderGame();
        
        const tileTypeDisplay = tileType === 'farm' ? 'crops' : 'trees';
        console.log(`✅ Instantly grew ${grownCount} ${tileTypeDisplay} in ${tileType} tiles!`);
        
        return true;
        
    } catch (error) {
        Logger.error(error.message, 'instantGrowAll');
        console.error('Failed to instantly grow all tiles:', error.message);
        return false;
    }
}

function updateGame() {
    GameState.farm.tiles.forEach(tile => {
        tile.checkGrowthProgress();
    });
    GameState.trees.tiles.forEach(tile => {
        tile.checkGrowthProgress();
    });
}

function renderCoins(coins) {
    if (coinsEl) {
        coinsEl.textContent = `Coins: ${coins}`;
    }
}

// ======== RENDER SYSTEM ========

// Initial render and event delegation
function renderTilesOnce(tiles, unlockedTiles, containerEl, pageType) {
    if (!containerEl) return;
    
    containerEl.innerHTML = "";
    
    // Tile grid
    tiles.forEach((tile, index) => {
        const tileEl = document.createElement("div");
        tileEl.className = "tile";
        tileEl.dataset.index = index;
        
        if (index >= unlockedTiles) {
            tileEl.classList.add("locked");
            tileEl.textContent = "🔒";
        } else {
            updateTileElement(tile, tileEl, pageType);
        }
        
        containerEl.appendChild(tileEl);
    });
    
    setupTileEventDelegation(containerEl, pageType);
}

function updateTileElement(tile, tileEl, pageType, index) {
    if (!tileEl) return;
    
    // Remove all tile state
    tileEl.classList.remove('empty', 'growing', 'ready', 'locked');
    
    const isLocked = (pageType === 'farm' && index >= GameState.farm.unlockedTiles) || 
                     (pageType === 'trees' && index >= GameState.trees.unlockedTiles);
    
    if (isLocked) {
        tileEl.classList.add('locked');
        tileEl.textContent = "🔒";
        tileEl.dataset.tooltip = "This tile is locked. Unlock it to plant something here.";
        return;
    }
    
    if (tile.isEmpty()) {
        tileEl.classList.add('empty');
        tileEl.textContent = "Empty";
    } else if (tile.isGrowing()) {
        tileEl.classList.add('growing');
        
        const progress = getGrowthProgress(tile);
        const timeRemaining = tile.getTimeRemaining();
        
        // Crop content
        let cropContent = tileEl.querySelector('.crop-content');
        if (!cropContent) {
            cropContent = document.createElement('div');
            cropContent.className = 'crop-content';
            tileEl.innerHTML = '';
            tileEl.appendChild(cropContent);
        }
        
        // Update crop emoji
        let cropEmoji = cropContent.querySelector('.crop-emoji');
        if (!cropEmoji) {
            cropEmoji = document.createElement('div');
            cropEmoji.className = 'crop-emoji';
            cropContent.appendChild(cropEmoji);
        }
        cropEmoji.textContent = '🌱';
        
        // Update progress bar
        let progressBar = cropContent.querySelector('.progress-bar');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            cropContent.appendChild(progressBar);
        }
        
        let progressFill = progressBar.querySelector('.progress-fill');
        if (!progressFill) {
            progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressBar.appendChild(progressFill);
        }
        progressFill.style.width = `${progress * 100}%`;
        
        // Update time remaining
        let timeRemainingEl = cropContent.querySelector('.time-remaining');
        if (!timeRemainingEl) {
            timeRemainingEl = document.createElement('div');
            timeRemainingEl.className = 'time-remaining';
            cropContent.appendChild(timeRemainingEl);
        }
        timeRemainingEl.textContent = formatTimeRemaining(timeRemaining);
        
    } else if (tile.isReady()) {
        tileEl.classList.add('ready');
        const icon = pageType === 'farm' ? GameData.getCropIcon(tile.cropId) : GameData.getTreeIcon(tile.cropId);
        tileEl.textContent = icon;
    }
    
    // Update tooltip content
    const tooltipContent = getTileTooltipContent(tile);
    tileEl.dataset.tooltip = tooltipContent;
}

// Event delegation for tile clicks
function setupTileEventDelegation(containerEl, pageType) {
    
    // Remove existing listener, if any
    containerEl.removeEventListener('click', containerEl._tileClickHandler);
    
    // New handler
    const handler = (e) => {
        const tileEl = e.target.closest('.tile');
        if (!tileEl) return;
        
        const index = parseInt(tileEl.dataset.index);
        if (isNaN(index)) return;
        
        if (pageType === 'farm') {
            handleFarmTileClick(index);
        } else if (pageType === 'trees') {
            handleTreeTileClick(index);
        }
    };
    
    // Add new listener
    containerEl.addEventListener('click', handler);
    containerEl._tileClickHandler = handler;
}

// Individual tile UI + rendering
function updateTileUI(tile, index, containerEl, getIconFunc, unlockedTiles) {
    const tileEl = containerEl.children[index];
    if (!tileEl) return;
    
    updateTileElement(tile, tileEl, containerEl === farmEl ? 'farm' : 'trees', index);
}

// Farm - Visual update
function updateFarmVisuals() {
    // Update changed state
    GameState.farm.tiles.forEach((tile, index) => {
        const tileEl = farmEl.children[index];
        if (!tileEl) return;
        
        // Check if update is needed
        const currentClasses = tileEl.className;
        const shouldHaveEmpty = tile.isEmpty();
        const shouldHaveGrowing = tile.isGrowing();
        const shouldHaveReady = tile.isReady();
        const shouldHaveLocked = index >= GameState.farm.unlockedTiles;
        
        const needsUpdate = 
            (shouldHaveEmpty && !currentClasses.includes('empty')) ||
            (shouldHaveGrowing && !currentClasses.includes('growing')) ||
            (shouldHaveReady && !currentClasses.includes('ready')) ||
            (shouldHaveLocked && !currentClasses.includes('locked')) ||
            (!shouldHaveEmpty && !shouldHaveGrowing && !shouldHaveReady && !shouldHaveLocked);
        
        if (needsUpdate) {
            updateTileElement(tile, tileEl, 'farm', index);
        }
    });
}

// Tree - Visual update
function updateTreeVisuals() {
    // Update changed state
    GameState.trees.tiles.forEach((tile, index) => {
        const tileEl = treesEl.children[index];
        if (!tileEl) return;
        
        // Check if update is needed
        const currentClasses = tileEl.className;
        const shouldHaveEmpty = tile.isEmpty();
        const shouldHaveGrowing = tile.isGrowing();
        const shouldHaveReady = tile.isReady();
        const shouldHaveLocked = index >= GameState.trees.unlockedTiles;
        
        const needsUpdate = 
            (shouldHaveEmpty && !currentClasses.includes('empty')) ||
            (shouldHaveGrowing && !currentClasses.includes('growing')) ||
            (shouldHaveReady && !currentClasses.includes('ready')) ||
            (shouldHaveLocked && !currentClasses.includes('locked')) ||
            (!shouldHaveEmpty && !shouldHaveGrowing && !shouldHaveReady && !shouldHaveLocked);
        
        if (needsUpdate) {
            updateTileElement(tile, tileEl, 'trees', index);
        }
    });
}

function renderGame() {
    renderCoins(GameState.coins);
    renderPlayerStats();
    
    // Render current page
    if (GameState.ui.activePage === 'farm') {
        if (!farmEl._initialized) {
            renderTilesOnce(GameState.farm.tiles, GameState.farm.unlockedTiles, farmEl, 'farm');
            farmEl._initialized = true;
        } else {
            updateFarmVisuals();
        }
    } else if (GameState.ui.activePage === 'trees') {
        if (!treesEl._initialized) {
            renderTilesOnce(GameState.trees.tiles, GameState.trees.unlockedTiles, treesEl, 'trees');
            treesEl._initialized = true;
        } else {
            updateTreeVisuals();
        }
    }
}

// MAIN LOOP
setInterval(updateGame, 1000);

let lastFarmRender = Date.now();
let lastTreeRender = Date.now();

setInterval(() => {
    const now = Date.now();
    
    // Visual update only when farm is active and time passed
    if (GameState.ui.activePage === 'farm' && (now - lastFarmRender) >= 500) {
        updateFarmVisuals();
        lastFarmRender = now;
    }
    
    // Visual update only when tree is active and time passed
    if (GameState.ui.activePage === 'trees' && (now - lastTreeRender) >= 500) {
        updateTreeVisuals();
        lastTreeRender = now;
    }
}, 100);

// Smooth progress update
setInterval(() => {
    // Update progress for all growing tiles
    GameState.farm.tiles.forEach((tile, index) => {
        if (tile.isGrowing()) {
            const tileEl = farmEl.children[index];
            if (tileEl) {
                updateTileProgress(tile, tileEl);
            }
        }
    });
    
    GameState.trees.tiles.forEach((tile, index) => {
        if (tile.isGrowing()) {
            const tileEl = treesEl.children[index];
            if (tileEl) {
                updateTileProgress(tile, tileEl);
            }
        }
    });
}, 100);

// ========== Page Switch ==========
const pageButtons = document.querySelectorAll('.page-buttons button');
const pages = document.querySelectorAll('.page');

function switchPage(pageName) {
    // Check tree unlock
    if (pageName === 'trees' && !GameState.trees.unlocked) {
        if (GameState.coins >= 10000) {
            GameState.coins -= 10000;
            GameState.trees.unlocked = true;
            GameState.trees.saplingsUnlocked.oak = true;
            renderCoins(GameState.coins);
        } else {
            alert("You need 10,000 coins to unlock the Trees tab!");
            return;
        }
    }
    
    // Active page status
    GameState.ui.activePage = pageName;
    
    // Hide all
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Disable buttons
    pageButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activate selected page
    const page = document.querySelector(`.page[data-page="${pageName}"]`);
    const button = document.querySelector(`.page-switcher button[data-page="${pageName}"]`);
    
    if (page) page.classList.add('active');
    if (button) button.classList.add('active');
    
    if (pageName === 'farm') {
        document.getElementById('farm-utilities').style.display = 'block';
        document.getElementById('crop-selector').style.display = 'block';
        document.getElementById('tree-utilities').style.display = 'none';
        document.getElementById('tree-selector').style.display = 'none';
    } else if (pageName === 'trees') {
        document.getElementById('farm-utilities').style.display = 'none';
        document.getElementById('crop-selector').style.display = 'none';
        document.getElementById('tree-utilities').style.display = 'block';
        document.getElementById('tree-selector').style.display = 'block';
    }
    
    renderGame();
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
        version: 2,
        savedAt: Date.now(),
        coins: GameState.coins,
        selectedCrop: GameState.selectedCrop,
        selectedTree: GameState.selectedTree,
        farm: {
            unlockedTiles: GameState.farm.unlockedTiles,
            tiles: GameState.farm.tiles.map(tile => ({
                state: tile.state,
                cropId: tile.cropId,
                plantedAt: tile.plantedAt,
                isCooldown: tile.isCooldown
            }))
        },
        trees: {
            unlocked: GameState.trees.unlocked,
            unlockedTiles: GameState.trees.unlockedTiles,
            saplingsUnlocked: GameState.trees.saplingsUnlocked,
            tiles: GameState.trees.tiles.map(tile => ({
                state: tile.state,
                cropId: tile.cropId,
                plantedAt: tile.plantedAt,
                isCooldown: tile.isCooldown
            }))
        },
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
        if (!encoded || typeof encoded !== 'string') {
            throw new Error("Invalid save data - expected string");
        }

        const json = atob(encoded.trim());
        let data = JSON.parse(json);

        if (!data || !data.version) {
            throw new Error("Invalid save format!");
        }

        // Validate version
        if (data.version > 2) {
            throw new Error(`Save version ${data.version} is too new. Current version: ${version}`);
        }

        // Validate data structure
        if (!data.coins || !data.farm || !data.player) {
            throw new Error("Corrupted save data - missing required fields");
        }

        // Confirm import
        if (!confirm("This will overwrite your current save. Continue?")) {
            return;
        }

        // Create backup before importing
        const backupData = getSaveData();
        localStorage.setItem("farmGameBackup", JSON.stringify(backupData));

        data = migrateSave(data);

        // Validate migrated data
        if (!data.coins || !data.farm || !data.player) {
            throw new Error("Migration failed - invalid data structure");
        }

        GameState.coins = data.coins || 0;
        GameState.selectedCrop = data.selectedCrop || 'corn';
        GameState.selectedTree = data.selectedTree || 'oak';

        // Load player progression + validate
        if (data.player) {
            GameState.player.level = Math.max(1, data.player.level || 1);
            GameState.player.xp = Math.max(0, data.player.xp || 0);
            GameState.player.xpToNext = Math.max(100, data.player.xpToNext || 100);
        }

        // Load farm + validate
        if (data.farm) {
            GameState.farm.unlockedTiles = Math.min(Math.max(1, data.farm.unlockedTiles || 1), GameState.farm.maxTiles);
            GameState.farm.tiles = data.farm.tiles.map(tileData => {
                const tile = new Tile();
                tile.state = tileData.state || TILE_STATE.EMPTY;
                tile.cropId = tileData.cropId;
                tile.plantedAt = tileData.plantedAt;
                tile.isCooldown = tileData.isCooldown || false;

                // Check offline growth
                if (tile.isGrowing() && tile.plantedAt && tile.cropId) {
                    tile.checkGrowthProgress();
                }

                return tile;
            });
        } else {
            // Backward compatibility
            GameState.farm.unlockedTiles = Math.min(Math.max(1, data.unlockedTiles || 1), GameState.farm.maxTiles);
            GameState.farm.tiles = data.farmGrid.map(tileData => {
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
        }

        // Load trees + validate
        if (data.trees) {
            GameState.trees.unlocked = data.trees.unlocked || false;
            GameState.trees.unlockedTiles = Math.min(Math.max(1, data.trees.unlockedTiles || 1), GameState.trees.maxTiles);
            GameState.trees.saplingsUnlocked = data.trees.saplingsUnlocked || {oak: false, apple: false, cherry: false};
            GameState.trees.tiles = data.trees.tiles.map(tileData => {
                const tile = new Tile();
                tile.state = tileData.state || TILE_STATE.EMPTY;
                tile.cropId = tileData.cropId;
                tile.plantedAt = tileData.plantedAt;
                tile.isCooldown = tileData.isCooldown || false;

                // Check offline growth
                if (tile.isGrowing() && tile.plantedAt && tile.cropId) {
                    tile.checkGrowthProgress();
                }

                return tile;
            });
            // Ensure enough tiles
            while (GameState.trees.tiles.length < TREE_SIZE * TREE_SIZE) {
                GameState.trees.tiles.push(new Tile());
            }
            // Limit
            GameState.trees.tiles = GameState.trees.tiles.slice(0, TREE_SIZE * TREE_SIZE);
        } else {
            // Initialize empty
            GameState.trees.unlocked = false;
            GameState.trees.unlockedTiles = 1;
            GameState.trees.saplingsUnlocked = {oak: false, apple: false, cherry: false};
            for (let i = 0; i < TREE_SIZE * TREE_SIZE; i++) {
                GameState.trees.tiles.push(new Tile());
            }
        }

        saveGame();
        renderGame();

        showSaveStatus("Save imported!");
    } catch (err) {
        Logger.error(err.message, "importSaveFromText");
        showSaveStatus("Import failed: " + err.message);

        // Backup - Placeholder
        const backupData = localStorage.getItem("farmGameBackup");
        if (backupData) {
            if (confirm("Restore from backup before the failed import?")) {
                try {
                    const backup = JSON.parse(backupData);

                    GameState.coins = backup.coins || 0;
                    GameState.player = backup.player || GameState.player;
                    showSaveStatus("Restored from backup!");
                    renderGame();
                } catch (backupErr) {
                    Logger.error(backupErr.message, "restoreFromBackup");
                    showSaveStatus("Backup restore also failed!");
                }
            }
        }
    }
}

function treeValueFromTime(ms) {
    return Math.pow(ms / 60000, 0.9);
}

// Time utils
const TIME_FORMATS = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000 
}

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
    
    const isTree = GameData.getTreeData(tile.cropId);
    const totalTime = tile.isCooldown ? (isTree ? GameData.getTreeCooldownTime(tile.cropId) : 0) : (isTree ? GameData.getTreeGrowTime(tile.cropId) : GameData.getCropGrowTime(tile.cropId));
    if (!totalTime || totalTime <= 0) {
        return 0;
    }
    
    const elapsed = Math.max(0, Date.now() - tile.plantedAt);
    return Math.min(elapsed / totalTime, 1);
}

// Growth progress calculation
function getGrowthProgressCached(tile) {
    if (!tile._cachedProgress || !tile._cachedProgressTime || Date.now() - tile._cachedProgressTime > 1000) {
        tile._cachedProgress = getGrowthProgress(tile);
        tile._cachedProgressTime = Date.now();
    }
    return tile._cachedProgress;
}

function clearTileCache(tile) {
    if (tile) {
        delete tile._cachedProgress;
        delete tile._cachedProgressTime;
    }
}

// Update progress for a specific tile
function updateTileProgress(tile, tileEl) {
    if (!tile.isGrowing() || !tileEl) return;
    
    const progress = getGrowthProgress(tile);
    const timeRemaining = tile.getTimeRemaining();
    
    // Update progress bar
    const progressFill = tileEl.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress * 100}%`;
    }
    
    // Update time remaining
    const timeRemainingEl = tileEl.querySelector('.time-remaining');
    if (timeRemainingEl) {
        timeRemainingEl.textContent = formatTimeRemaining(timeRemaining);
    }
    
    // Update tooltip
    const tooltipContent = getTileTooltipContent(tile);
    tileEl.dataset.tooltip = tooltipContent;
}

// Tooltip content
function getTileTooltipContent(tile) {
    try {
        if (!tile) {
            return `
            <div class="tile-tooltip">
                <div class="tile-header">
                    <span class="tile-icon">❓</span>
                    <span class="tile-name">Invalid Tile</span>
                </div>
                <div class="tile-status">Tile data not found</div>
            </div>
            `;
        }
        
        if (tile.isEmpty()) {
            return `
            <div class="tile-tooltip">
                <div class="tile-header">
                    <span class="tile-icon">🌱</span>
                    <span class="tile-name">Empty Tile</span>
                </div>
                <div class="tile-status">Ready for planting</div>
            </div>
            `;
        }
        
        if (!tile.cropId) {
            return `
            <div class="tile-tooltip">
                <div class="tile-header">
                    <span class="tile-icon">❓</span>
                    <span class="tile-name">No Crop</span>
                </div>
                <div class="tile-status">Tile has no crop planted</div>
            </div>
            `;
        }
        
        const cropData = GameData.getCropData(tile.cropId) || GameData.getTreeData(tile.cropId);
        const isTree = !!GameData.getTreeData(tile.cropId);
        
        if (!cropData) {
            return `
            <div class="tile-tooltip">
                <div class="tile-header">
                    <span class="tile-icon">❓</span>
                    <span class="tile-name">Unknown Plant</span>
                </div>
                <div class="tile-status">Data not found for: ${tile.cropId}</div>
            </div>
            `;
        }
        
        const progress = getGrowthProgress(tile);
        const timeRemaining = tile.getTimeRemaining();
        const xp = isTree ? getTreeXP(cropData) : getCropXP(cropData);
        const coins = cropData.value;
        const rarityColor = OptimizedTooltip.rarityColors[cropData.rarity] || '#808080';
        
        let content = `
            <div class="tile-tooltip" style="border-left: 4px solid ${rarityColor}">
                <div class="tile-header">
                    <span class="tile-icon">${cropData.icon}</span>
                    <div class="tile-info">
                        <span class="tile-name">${cropData.name}</span>
                        <span class="tile-category">${isTree ? 'Tree' : 'Crop'} • ${cropData.rarity.toUpperCase()}</span>
                    </div>
                </div>
        `;
        
        if (tile.isGrowing()) {
            const isCooldown = tile.isCooldown;
            const timeLabel = isCooldown ? 'Cooldown' : 'Growth';
            const timeIcon = isCooldown ? '⏳' : '⏱';
            
            content += `
                <div class="tile-progress">
                    <div class="progress-label">${timeLabel}: ${formatTimeRemaining(timeRemaining)}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.round(progress * 100)}%"></div>
                    </div>
                    <div class="progress-text">${Math.round(progress * 100)}% complete</div>
                </div>
            `;
        } else if (tile.isReady()) {
            content += `
                <div class="tile-status ready-status">Ready to Harvest!</div>
            `;
        }
        
        content += `
                <div class="tile-rewards">
                    <div class="reward-item">
                        <span class="reward-icon">💰</span>
                        <span class="reward-label">Coins:</span>
                        <span class="reward-value">${coins}</span>
                    </div>
                    <div class="reward-item">
                        <span class="reward-icon">⚡</span>
                        <span class="reward-label">XP:</span>
                        <span class="reward-value">${xp}</span>
                    </div>
                </div>
            </div>
        `;
        
        return content;
    } catch (error) {
        Logger.error(error.message, 'getTileTooltipContent');
        return `
        <div class="tile-tooltip">
            <div class="tile-header">
                <span class="tile-icon">❌</span>
                <span class="tile-name">Error</span>
            </div>
            <div class="tile-status">Tooltip generation failed</div>
        </div>
        `;
    }
}

// Tooltip content - Crop selector
function getCropSelectorTooltipContent(cropId) {
    try {
        const cropData = GameData.getCropData(cropId);
        
        if (!cropData) {
            return `
            <div class="tile-tooltip">
                <div class="tile-header">
                    <span class="tile-icon">❓</span>
                    <span class="tile-name">Unknown Crop</span>
                </div>
                <div class="tile-status">Data not found for: ${cropId}</div>
            </div>
            `;
        }
        
        const xp = getCropXP(cropData);
        const coins = cropData.value;
        const rarityColor = OptimizedTooltip.rarityColors[cropData.rarity] || '#808080';
        
        let content = `
            <div class="tile-tooltip" style="border-left: 4px solid ${rarityColor}">
                <div class="tile-header">
                    <span class="tile-icon">${cropData.icon}</span>
                    <div class="tile-info">
                        <span class="tile-name">${cropData.name}</span>
                        <span class="tile-category">Crop • ${cropData.rarity.toUpperCase()}</span>
                    </div>
                </div>
                <div class="tile-progress">
                    <div class="progress-label">Growth Time: ${formatTimeRemaining(cropData.time)}</div>
                </div>
                <div class="tile-rewards">
                    <div class="reward-item">
                        <span class="reward-icon">💰</span>
                        <span class="reward-label">Coins:</span>
                        <span class="reward-value">${coins}</span>
                    </div>
                    <div class="reward-item">
                        <span class="reward-icon">⚡</span>
                        <span class="reward-label">XP:</span>
                        <span class="reward-value">${xp}</span>
                    </div>
                </div>
            </div>
        `;
        
        return content;
    } catch (error) {
        Logger.error(error.message, 'getCropSelectorTooltipContent');
        return `
        <div class="tile-tooltip">
            <div class="tile-header">
                <span class="tile-icon">❌</span>
                <span class="tile-name">Error</span>
            </div>
            <div class="tile-status">Tooltip generation failed</div>
        </div>
        `;
    }
}

// Tooltip content - Tree selector
function getTreeSelectorTooltipContent(treeId) {
    try {
        const treeData = GameData.getTreeData(treeId);
        
        if (!treeData) {
            return `
            <div class="tile-tooltip">
                <div class="tile-header">
                    <span class="tile-icon">❓</span>
                    <span class="tile-name">Unknown Tree</span>
                </div>
                <div class="tile-status">Data not found for: ${treeId}</div>
            </div>
            `;
        }
        
        const xp = getTreeXP(treeData);
        const coins = treeData.value;
        const rarityColor = OptimizedTooltip.rarityColors[treeData.rarity] || '#808080';
        
        let content = `
            <div class="tile-tooltip" style="border-left: 4px solid ${rarityColor}">
                <div class="tile-header">
                    <span class="tile-icon">${treeData.icon}</span>
                    <div class="tile-info">
                        <span class="tile-name">${treeData.name}</span>
                        <span class="tile-category">Tree • ${treeData.rarity.toUpperCase()}</span>
                    </div>
                </div>
                <div class="tile-progress">
                    <div class="progress-label">Growth Time: ${formatTimeRemaining(treeData.time)}</div>
                    <div class="progress-label">Cooldown Time: ${formatTimeRemaining(treeData.cooldown)}</div>
                </div>
                <div class="tile-rewards">
                    <div class="reward-item">
                        <span class="reward-icon">💰</span>
                        <span class="reward-label">Coins:</span>
                        <span class="reward-value">${coins}</span>
                    </div>
                    <div class="reward-item">
                        <span class="reward-icon">⚡</span>
                        <span class="reward-label">XP:</span>
                        <span class="reward-value">${xp}</span>
                    </div>
                </div>
            </div>
        `;
        
        return content;
    } catch (error) {
        Logger.error(error.message, 'getTreeSelectorTooltipContent');
        return `
        <div class="tile-tooltip">
            <div class="tile-header">
                <span class="tile-icon">❌</span>
                <span class="tile-name">Error</span>
            </div>
            <div class="tile-status">Tooltip generation failed</div>
        </div>
        `;
    }
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
}

// Crop XP math
function getCropXP(crop) {
    const minutes = crop.time / 60000;
    
    const baseXP = Math.log2(minutes + 1) * 5;
    return Math.floor(baseXP * RARITY_XP[crop.rarity]);
}

const TREE_VALUE_MULTIPLIER = 1.35;
const TREE_XP_MULTIPLIER = 1.25;

// Tree XP math
function getTreeXP(tree) {
    return Math.floor(getCropXP(tree) * TREE_XP_MULTIPLIER);
}

// ======== EVENTS ========
const EventSystem = {
    listeners: new Map(),
    
    // Subscribe to an event
    on(event, callback) {
        // Validation
        if (!event || typeof event !== 'string' || !event.trim()) {
            Logger.error('Invalid event name provided to EventSystem.on', 'EventSystem.on');
            return;
        }
        
        if (!callback || typeof callback !== 'function') {
            Logger.error('Invalid callback function provided to EventSystem.on', 'EventSystem.on');
            return;
        }
        
        try {
            // Initialize event listeners set, if not exists
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            
            const listeners = this.listeners.get(event);
            
            // Check for duped listeners
            if (listeners.has(callback)) {
                Logger.warn(`Duplicate listener for event '${event}'`, "EventSystem.on");
                return;
            }
            
            listeners.add(callback);
        } catch (error) {
            Logger.error(error.message, 'EventSystem.on');
        }
    },

    // Emit an event
    emit(event, data) {
        // Validation
        if (!event || typeof event !== 'string' || !event.trim()) {
            Logger.warn('Invalid event name provided to EventSystem.emit', 'EventSystem.emit');
            return;
        }
        
        if (!this.listeners.has(event)) {
            return; // No listeners, not an error
        }
        
        try {
            const listeners = this.listeners.get(event);
            
            // Emit to all listeners with error isolation
            listeners.forEach(callback => {
                try {
                    if (typeof callback === 'function') {
                        callback(data);
                    }
                } catch (error) {
                    Logger.error(`Event listener failed: ${error.message}`, 'EventSystem.emit');
                }
            });
        } catch (error) {
            Logger.error(error.message, 'EventSystem.emit');
        }
    },

    // Unsubscribe from an event
    off(event, callback) {
        // Validation
        if (!event || typeof event !== 'string' || !event.trim()) {
            Logger.warn('Invalid event name provided to EventSystem.off', 'EventSystem.off');
            return;
        }
        
        if (!callback || typeof callback !== 'function') {
            Logger.warn('Invalid callback function provided to EventSystem.off', 'EventSystem.off');
            return;
        }
        
        if (!this.listeners.has(event)) {
            return;
        }
        
        try {
            const listeners = this.listeners.get(event);
            listeners.delete(callback);
        } catch (error) {
            Logger.error(error.message, 'EventSystem.off');
        }
    },

    // Remove all listeners for an event
    removeAllListeners(event) {
        // Validation
        if (!event || typeof event !== 'string' || !event.trim()) {
            Logger.warn('Invalid event name provided to EventSystem.removeAllListeners', 'EventSystem.removeAllListeners');
            return;
        }
        
        if (!this.listeners.has(event)) {
            return;
        }
        
        try {
            this.listeners.set(event, new Set());
        } catch (error) {
            Logger.error(error.message, 'EventSystem.removeAllListeners');
        }
    },
    
    getListenerCount(event) {
        // Validation
        if (!event || typeof event !== 'string' || !event.trim()) {
            Logger.warn('Invalid event name provided to EventSystem.getListenerCount', 'EventSystem.getListenerCount');
            return 0;
        }
        
        try {
            return this.listeners.has(event) ? this.listeners.get(event).size : 0;
        } catch (error) {
            Logger.error(error.message, 'EventSystem.getListenerCount');
            return 0;
        }
    },
    
    getRegisteredEvents() {
        try {
            return Array.from(this.listeners.keys());
        } catch (error) {
            Logger.error(error.message, 'EventSystem.getRegisteredEvents');
            return [];
        }
    },
    
    // Clear all listeners
    clearAll() {
        try {
            this.listeners.clear();
        } catch (error) {
            Logger.error(error.message, 'EventSystem.clearAll');
        }
    }
}

// Level up event and refresh new crops
EventSystem.on('playerLevelUp', (data) => {
    initCropSelector();
});

// Gain XP and handle level progression
function gainXP(amount) {
    GameState.player.xp += amount;

    while (GameState.player.xp >= GameState.player.xpToNext) {
        // Store the excess XP after this level up
        const excessXP = GameState.player.xp - GameState.player.xpToNext;
        
        // Level up
        levelUp();
        
        // Handle multiple level-ups correctly (hopefully)
        GameState.player.xp = excessXP;
    }
    renderPlayerStats();
}

// Calculate XP needed for next level (progressive scaling)
function xpForLevel(level) {
    return Math.floor(100 * Math.pow(1.2, level - 1));
}

// Handle level up
function levelUp() {
    console.log(`Leveling up from ${GameState.player.level} to ${GameState.player.level + 1}`);
    console.log(`Current XP before level up: ${GameState.player.xp}`);
    
    GameState.player.level++;
    GameState.player.xpToNext = xpForLevel(GameState.player.level);
    
    console.log(`New level: ${GameState.player.level}`);
    console.log(`New XP requirement: ${GameState.player.xpToNext}`);

    // Emit level up event
    safeEmit('playerLevelUp', { newLevel: GameState.player.level });
}

// Check if crop is unlocked based on player level
function isCropUnlocked(crop) {
    return GameState.player.level >= crop.unlockLevel;
}

// Migration function for backward compatibility -- Hopefully works
function migrateSave(data) {
    if (!data.version) data.version = 1;

    // v1 to v2 migration
    if (data.version < 2) {
        if (!data.trees) {
            data.trees = { unlocked: false, saplingsUnlocked: {} };
        }

        if (!data.trees.saplingsUnlocked) {
            data.trees.saplingsUnlocked = {};
        }

        // Convert old unlockedTrees array to saplingsUnlocked
        if (data.trees.unlockedTrees) {
            data.trees.unlockedTrees.forEach(treeId => {
                data.trees.saplingsUnlocked[treeId] = true;
            });
            delete data.trees.unlockedTrees;
        }

        // Ensure defaults
        ['oak', 'apple', 'cherry'].forEach(treeId => {
            if (!(treeId in data.trees.saplingsUnlocked)) {
                data.trees.saplingsUnlocked[treeId] = false;
            }
        });

        data.version = 2;
    }

    return data;
}

function saveGame() {
    // Validation
    if (!GameState.coins || !GameState.farm || !GameState.player) {
        Logger.error('Invalid game state for saving', 'saveGame');
        showSaveStatus("Save failed: Invalid game state!");
        return false;
    }
    
    // Validate player
    if (typeof GameState.player.level !== 'number' || GameState.player.level < 1) {
        Logger.error('Invalid player level for saving', 'saveGame');
        showSaveStatus("Save failed: Invalid player data!");
        return false;
    }
    
    // Validate farm
    if (!Array.isArray(GameState.farm.tiles) || GameState.farm.tiles.length === 0) {
        Logger.error('Invalid farm tiles for saving', 'saveGame');
        showSaveStatus("Save failed: Invalid farm data!");
        return false;
    }
    
    // Validate trees
    if (!Array.isArray(GameState.trees.tiles) || GameState.trees.tiles.length === 0) {
        Logger.error('Invalid trees tiles for saving', 'saveGame');
        showSaveStatus("Save failed: Invalid trees data!");
        return false;
    }

    try {
        const saveData = {
            version: 2,
            coins: GameState.coins,
            selectedCrop: GameState.selectedCrop,
            selectedTree: GameState.selectedTree,
            farm: {
                unlockedTiles: GameState.farm.unlockedTiles,
                tiles: GameState.farm.tiles.map(tile => ({
                    state: tile.state,
                    cropId: tile.cropId,
                    plantedAt: tile.plantedAt,
                    isCooldown: tile.isCooldown
                }))
            },
            trees: {
                unlocked: GameState.trees.unlocked,
                unlockedTiles: GameState.trees.unlockedTiles,
                saplingsUnlocked: GameState.trees.saplingsUnlocked,
                tiles: GameState.trees.tiles.map(tile => ({
                    state: tile.state,
                    cropId: tile.cropId,
                    plantedAt: tile.plantedAt,
                    isCooldown: tile.isCooldown
                }))
            },
            player: GameState.player,
            lastSavedAt: Date.now()
        };

        localStorage.setItem("farmGame", JSON.stringify(saveData));
        showSaveStatus("Game saved!");
        return true;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            Logger.error('Storage quota exceeded - cannot save game', 'saveGame');
            showSaveStatus("Save failed: Storage full!");
        } else {
            Logger.error(`Save failed: ${error.message}`, 'saveGame');
            showSaveStatus("Save failed!");
        }
        return false;
    }
}

function loadGame() {
    const data = localStorage.getItem("farmGame");
    if (!data) return false;

    try {
        let save = JSON.parse(data);
        save = migrateSave(save); // Apply migration
        
        // Validate and sanitize loaded data
        const validatedSave = validateAndSanitizeSave(save);
        
        GameState.coins = validatedSave.coins || 0;
        GameState.selectedCrop = validatedSave.selectedCrop || 'corn';
        GameState.selectedTree = validatedSave.selectedTree || 'oak';

        // Load farm
        if (validatedSave.farm) {
            GameState.farm.unlockedTiles = Math.min(Math.max(1, validatedSave.farm.unlockedTiles || 1), GameState.farm.maxTiles);
            GameState.farm.tiles = validatedSave.farm.tiles.map(tileData => {
                const tile = new Tile();
                tile.state = tileData.state || TILE_STATE.EMPTY;
                tile.cropId = tileData.cropId;
                tile.plantedAt = tileData.plantedAt;
                tile.isCooldown = tileData.isCooldown || false;

                // Check offline growth
                if (tile.isGrowing() && tile.plantedAt && tile.cropId) {
                    tile.checkGrowthProgress();
                }

                return tile;
            });
        } else {
            // Backward compatibility
            GameState.farm.unlockedTiles = Math.min(Math.max(1, validatedSave.unlockedTiles || 1), GameState.farm.maxTiles);
            GameState.farm.tiles = validatedSave.farmGrid.map(tileData => {
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
        }

        // Load trees
        if (validatedSave.trees) {
            GameState.trees.unlocked = validatedSave.trees.unlocked || false;
            GameState.trees.unlockedTiles = Math.min(Math.max(1, validatedSave.trees.unlockedTiles || 1), GameState.trees.maxTiles);
            GameState.trees.saplingsUnlocked = validatedSave.trees.saplingsUnlocked || {oak: false, apple: false, cherry: false};
            GameState.trees.tiles = validatedSave.trees.tiles.map(tileData => {
                const tile = new Tile();
                tile.state = tileData.state || TILE_STATE.EMPTY;
                tile.cropId = tileData.cropId;
                tile.plantedAt = tileData.plantedAt;
                tile.isCooldown = tileData.isCooldown || false;

                // Check offline growth
                if (tile.isGrowing() && tile.plantedAt && tile.cropId) {
                    tile.checkGrowthProgress();
                }

                return tile;
            });
            // Ensure enough tiles
            while (GameState.trees.tiles.length < TREE_SIZE * TREE_SIZE) {
                GameState.trees.tiles.push(new Tile());
            }
            // Limit
            GameState.trees.tiles = GameState.trees.tiles.slice(0, TREE_SIZE * TREE_SIZE);
        } else {
            // Initialize empty
            GameState.trees.unlocked = false;
            GameState.trees.unlockedTiles = 1;
            GameState.trees.saplingsUnlocked = {oak: false, apple: false, cherry: false};
            for (let i = 0; i < TREE_SIZE * TREE_SIZE; i++) {
                GameState.trees.tiles.push(new Tile());
            }
        }

        // Load player progression
        if (validatedSave.player) {
            GameState.player.level = Math.max(1, validatedSave.player.level || 1);
            GameState.player.xp = Math.max(0, validatedSave.player.xp || 0);
            GameState.player.xpToNext = Math.max(100, validatedSave.player.xpToNext || 100);
        }
        
        // Load notification
        const readyCrops = GameState.farm.tiles.filter(tile => tile.isReady()).length;
        const readyTrees = GameState.trees.tiles.filter(tile => tile.isReady()).length;
        const totalReady = readyCrops + readyTrees;
        if (totalReady > 0) {
            setTimeout(() => {
                alert(`Welcome back! ${readyCrops} crop${readyCrops !== 1 ? 's' : ''} and ${readyTrees} tree${readyTrees !== 1 ? 's' : ''} are ready to harvest!`);
            }, 500);
        }

        showSaveStatus("Game loaded!");
        return true;
    } catch (error) {
        Logger.error(error.message, 'loadGame');
        showSaveStatus("Load failed!");
        
        // Offer recovery options
        const recoveryOptions = [
            "Restore from backup",
            "Reset to defaults",
            "Clear corrupted save"
        ];
        
        const choice = prompt(
            "Save data is corrupted. Choose recovery option:\n1. Restore from backup\n2. Reset to defaults\n3. Clear corrupted save",
            "1"
        );
        
        if (choice === "1") {
            return restoreFromBackup();
        } else if (choice === "2") {
            return resetToDefaults();
        } else if (choice === "3") {
            return clearCorruptedSave();
        }
        
        return false;
    }
}

function validateAndSanitizeSave(save) {
    try {
        // Basic structure
        if (!save || typeof save !== 'object') {
            throw new ValidationError('Invalid save data structure', 'save', save);
        }
        
        // Coins
        if (typeof save.coins !== 'number' || save.coins < 0) {
            Logger.warn('Invalid coins value, resetting to 0', 'validateAndSanitizeSave');
            save.coins = 0;
        }
        
        // Selected crop
        if (!GameData.isValidCrop(save.selectedCrop)) {
            Logger.warn(`Invalid selected crop: ${save.selectedCrop}, resetting to corn`, 'validateAndSanitizeSave');
            save.selectedCrop = 'corn';
        }
        
        // Selected tree
        if (!GameData.isValidTree(save.selectedTree)) {
            Logger.warn(`Invalid selected tree: ${save.selectedTree}, resetting to oak`, 'validateAndSanitizeSave');
            save.selectedTree = 'oak';
        }
        
        // Player data
        if (save.player) {
            if (typeof save.player.level !== 'number' || save.player.level < 1) {
                save.player.level = 1;
            }
            if (typeof save.player.xp !== 'number' || save.player.xp < 0) {
                save.player.xp = 0;
            }
            if (typeof save.player.xpToNext !== 'number' || save.player.xpToNext < 100) {
                save.player.xpToNext = 100;
            }
        }
        
        // Farm data
        if (save.farm) {
            if (typeof save.farm.unlockedTiles !== 'number' || save.farm.unlockedTiles < 1) {
                save.farm.unlockedTiles = 1;
            }
            if (!Array.isArray(save.farm.tiles)) {
                save.farm.tiles = [];
            }
        }
        
        // Tree data
        if (save.trees) {
            if (typeof save.trees.unlocked !== 'boolean') {
                save.trees.unlocked = false;
            }
            if (typeof save.trees.unlockedTiles !== 'number' || save.trees.unlockedTiles < 1) {
                save.trees.unlockedTiles = 1;
            }
            if (!save.trees.saplingsUnlocked || typeof save.trees.saplingsUnlocked !== 'object') {
                save.trees.saplingsUnlocked = {oak: false, apple: false, cherry: false};
            }
            if (!Array.isArray(save.trees.tiles)) {
                save.trees.tiles = [];
            }
        }
        
        return save;
    } catch (error) {
        Logger.error(error.message, 'validateAndSanitizeSave');
        return {
            coins: 0,
            selectedCrop: 'corn',
            selectedTree: 'oak',
            player: { level: 1, xp: 0, xpToNext: 100 },
            farm: { unlockedTiles: 1, tiles: [] },
            trees: { unlocked: false, unlockedTiles: 1, saplingsUnlocked: {}, tiles: [] }
        };
    }
}

function restoreFromBackup() {
    try {
        const backupData = localStorage.getItem("farmGameBackup");
        if (!backupData) {
            alert("No backup found!");
            return false;
        }
        
        const backup = JSON.parse(backupData);
        // Restore from backup
        GameState.coins = backup.coins || 0;
        GameState.selectedCrop = backup.selectedCrop || 'corn';
        GameState.selectedTree = backup.selectedTree || 'oak';
        GameState.player = backup.player || { level: 1, xp: 0, xpToNext: 100 };
        
        showSaveStatus("Restored from backup!");
        renderGame();
        return true;
    } catch (error) {
        Logger.error(error.message, 'restoreFromBackup');
        alert("Failed to restore from backup!");
        return false;
    }
}

function resetToDefaults() {
    try {
        // Reset to default state
        GameState.coins = 0;
        GameState.selectedCrop = 'corn';
        GameState.selectedTree = 'oak';
        GameState.player = { level: 1, xp: 0, xpToNext: 100 };
        GameState.farm.unlockedTiles = 1;
        GameState.trees.unlocked = false;
        GameState.trees.unlockedTiles = 1;
        GameState.trees.saplingsUnlocked = {};
        
        // Reset tiles
        GameState.farm.tiles = [];
        for (let i = 0; i < FARM_SIZE * FARM_SIZE; i++) {
            GameState.farm.tiles.push(new Tile());
        }
        GameState.trees.tiles = [];
        for (let i = 0; i < TREE_SIZE * TREE_SIZE; i++) {
            GameState.trees.tiles.push(new Tile());
        }
        
        showSaveStatus("Reset to defaults!");
        renderGame();
        return true;
    } catch (error) {
        Logger.error(error.message, 'resetToDefaults');
        alert("Failed to reset to defaults!");
        return false;
    }
}

function clearCorruptedSave() {
    try {
        localStorage.removeItem("farmGame");
        localStorage.removeItem("farmGameBackup");
        alert("Corrupted save cleared. Starting fresh!");
        return true;
    } catch (error) {
        Logger.error(error.message, 'clearCorruptedSave');
        alert("Failed to clear corrupted save!");
        return false;
    }
}

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
        time: 7 * TIME_FORMATS.DAY,
        value: 12000,
        icon: '🍓',
        rarity: "rare",
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
        time: 56 * TIME_FORMATS.HOUR,
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
        unlockLevel: 30
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
}

const TREES = {
    oak: {
        name: "Oak Tree",
        category: "tree",
        time: 12 * TIME_FORMATS.HOUR,
        cooldown: 8 * TIME_FORMATS.HOUR,
        baseValue: treeValueFromTime(12 * TIME_FORMATS.HOUR),
        value: Math.floor(
            treeValueFromTime(12 * TIME_FORMATS.HOUR) *
            TREE_VALUE_MULTIPLIER *
            RARITY_XP.common
        ),
        icon: "🌳",
        rarity: "common",
        unlockCost: 10000
    },

    birch: {
        name: "Birch Tree",
        category: "tree",
        time: 1 * TIME_FORMATS.DAY,
        cooldown: 18 * TIME_FORMATS.HOUR,
        baseValue: treeValueFromTime(1 * TIME_FORMATS.DAY),
        value: Math.floor(
            treeValueFromTime(1 * TIME_FORMATS.DAY) *
            TREE_VALUE_MULTIPLIER *
            RARITY_XP.common
        ),
        icon: "🌳",
        rarity: "common",
        unlockCost: 25000
    },

    maple: {
        name: "Maple Tree",
        category: "tree",
        time: 2 * TIME_FORMATS.DAY,
        cooldown: 1 * TIME_FORMATS.DAY,
        baseValue: treeValueFromTime(2 * TIME_FORMATS.DAY),
        value: Math.floor(
            treeValueFromTime(2 * TIME_FORMATS.DAY) *
            TREE_VALUE_MULTIPLIER *
            RARITY_XP.uncommon
        ),
        icon: "🍁",
        rarity: "uncommon",
        unlockCost: 75000
    },

    pine: {
        name: "Pine Tree",
        category: "tree",
        time: 3 * TIME_FORMATS.DAY,
        cooldown: 2 * TIME_FORMATS.DAY,
        baseValue: treeValueFromTime(3 * TIME_FORMATS.DAY),
        value: Math.floor(
            treeValueFromTime(3 * TIME_FORMATS.DAY) *
            TREE_VALUE_MULTIPLIER *
            RARITY_XP.rare
        ),
        icon: "🌲",
        rarity: "rare",
        unlockCost: 180000
    },

    cedar: {
        name: "Cedar Tree",
        category: "tree",
        time: 4 * TIME_FORMATS.DAY,
        cooldown: 3 * TIME_FORMATS.DAY,
        baseValue: treeValueFromTime(4 * TIME_FORMATS.DAY),
        value: Math.floor(
            treeValueFromTime(4 * TIME_FORMATS.DAY) *
            TREE_VALUE_MULTIPLIER *
            RARITY_XP.epic
        ),
        icon: "🌴",
        rarity: "epic",
        unlockCost: 400000
    },

    ebony: {
        name: "Ebony Tree",
        category: "tree",
        time: 5 * TIME_FORMATS.DAY,
        cooldown: 4 * TIME_FORMATS.DAY,
        baseValue: treeValueFromTime(5 * TIME_FORMATS.DAY),
        value: Math.floor(
            treeValueFromTime(5 * TIME_FORMATS.DAY) *
            TREE_VALUE_MULTIPLIER *
            RARITY_XP.legendary
        ),
        icon: "🪵",
        rarity: "legendary",
        unlockCost: 900000
    },

    worldTree: {
        name: "World Tree",
        category: "tree",
        time: 7 * TIME_FORMATS.DAY,
        cooldown: 5 * TIME_FORMATS.DAY,
        baseValue: treeValueFromTime(7 * TIME_FORMATS.DAY),
        value: Math.floor(
            treeValueFromTime(7 * TIME_FORMATS.DAY) *
            TREE_VALUE_MULTIPLIER *
            RARITY_XP.mythic
        ),
        icon: "🌎",
        rarity: "mythic",
        unlockCost: 2500000
    },
}

const GameData = {
    crops: CROPS,
    trees: TREES,

    getCropData: (cropId) => {
        return GameData.crops[cropId];
    },

    getTreeData: (treeId) => {
        return GameData.trees[treeId];
    },

    getCropGrowTime: (cropId) => {
        const crop = GameData.getCropData(cropId);
        return crop ? crop.time : 5000;
    },

    getTreeGrowTime: (treeId) => {
        const tree = GameData.getTreeData(treeId);
        return tree ? tree.time : 5000;
    },

    getTreeCooldownTime: (treeId) => {
        const tree = GameData.getTreeData(treeId);
        return tree ? tree.cooldown : 5000;
    },

    getCropValue: (cropId) => {
        const crop = GameData.getCropData(cropId);
        return crop ? crop.value : 10;
    },

    getTreeValue: (treeId) => {
        const tree = GameData.getTreeData(treeId);
        return tree ? tree.value : 10;
    },

    getCropIcon: (cropId) => {
        const crop = GameData.getCropData(cropId);
        return crop ? crop.icon : '🌱';
    },

    getTreeIcon: (treeId) => {
        const tree = GameData.getTreeData(treeId);
        return tree ? tree.icon : '🌱';
    },

    isValidCrop: (cropId) => {
        return !!GameData.crops[cropId];
    },

    isValidTree: (treeId) => {
        return !!GameData.trees[treeId];
    },
    
    getAllCrops: () => {
        return Object.keys(GameData.crops);
    },

    getAllTrees: () => {
        return Object.keys(GameData.trees);
    }
}

class Tile {
    constructor() {
        this.state = TILE_STATE.EMPTY;
        this.cropId = null;
        this.plantedAt = null;
        this.isCooldown = false;
    }
    
    // State transition helper
    plant(cropId) {
        this.state = TILE_STATE.GROWING;
        this.cropId = cropId;
        this.plantedAt = Date.now();
        this.isCooldown = false;
    }
    
    markReady() {
        this.state = TILE_STATE.READY;
        if (this.isCooldown) {
            this.isCooldown = false;
        }
    }
    
    harvest() {
        this.state = TILE_STATE.EMPTY;
        this.cropId = null;
        this.plantedAt = null;
        this.isCooldown = false;
    }
    
    harvestTree() {
        // Start cooldown growth
        this.state = TILE_STATE.GROWING;
        this.plantedAt = Date.now();
        this.isCooldown = true;
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
    
    // Time based check on crops/trees
    checkGrowthProgress() {
        if (this.isGrowing() && this.plantedAt && this.cropId) {
            const elapsed = Date.now() - this.plantedAt;
            const isTree = GameData.getTreeData(this.cropId);
            const totalTime = this.isCooldown ? (isTree ? GameData.getTreeCooldownTime(this.cropId) : 0) : (isTree ? GameData.getTreeGrowTime(this.cropId) : GameData.getCropGrowTime(this.cropId));

            if (elapsed >= totalTime) {
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
        const isTree = GameData.getTreeData(this.cropId);
        const totalTime = this.isCooldown ? (isTree ? GameData.getTreeCooldownTime(this.cropId) : 0) : (isTree ? GameData.getTreeGrowTime(this.cropId) : GameData.getCropGrowTime(this.cropId));
        return Math.max(totalTime - elapsed, 0);
    }
}

// Initialize tiles
for (let i = 0; i < FARM_SIZE * FARM_SIZE; i++) {
    GameState.farm.tiles.push(new Tile());
}
for (let i = 0; i < TREE_SIZE * TREE_SIZE; i++) {
    GameState.trees.tiles.push(new Tile());
}

const farmEl = getElementSafely("farm");
const treesEl = getElementSafely("trees");
const coinsEl = getElementSafely("coins");
const cropSelectorEl = getElementSafely("crop-selector");
const treeSelectorEl = getElementSafely("tree-selector");
const tooltip = getElementSafely("tooltip");

// Tooltip
const OptimizedTooltip = {
    el: null,
    currentTarget: null,
    currentTooltipContent: null,
    
    tooltipElements: new Set(),
    
    showTimer: null,
    hideTimer: null,
    showDelay: 30,
    hideDelay: 50,
    
    // Rarity color
    rarityColors: {
        common: '#808080',
        uncommon: '#00ff00',
        rare: '#0000ff',
        epic: '#800080',
        legendary: '#ffa500',
        mythic: '#ff0000'
    },
    
        init() {
        this.el = document.getElementById("tooltip");
        if (!this.el) {
            console.warn("Tooltip element not found!");
            return;
        }
        
        // Search elements that use tooltip
        this.scanForTooltips();
        
        // Set event listeners
        this.setupEventListeners();
    },
    
        scanForTooltips() {
        try {
            const elementsWithTooltip = document.querySelectorAll('[data-tooltip]');
            elementsWithTooltip.forEach(el => {
                this.tooltipElements.add(el);
            });
        } catch (error) {
            Logger.error(error.message, "OptimizedTooltip.scanForTooltips");
        }
    },
    
        setupEventListeners() {
        // Events + Filtering
        document.addEventListener("mousemove", (e) => this.handleMouseMove(e), { passive: true });
        document.addEventListener("mouseout", (e) => this.handleMouseOut(e), { passive: true });
        
        // DOM observer > update tooltip cache
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(() => {
                this.scanForTooltips();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    },
    
        sanitizeText(text) {
        if (!text || typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#39;');
    },
    
        handleMouseMove(e) {
        try {
            if (this.tooltipElements.size === 0) return;
            
            // Find element with tooltip data
            const tileEl = e.target.closest('.tile');
            const selectorEl = e.target.closest('.crop-btn, .tree-btn');
            const elementWithTooltip = tileEl || selectorEl;
            
            if (!elementWithTooltip) {
                if (this.currentTarget && !this.tooltipElements.has(e.target)) {
                    this.scheduleHide();
                }
                return;
            }
            
            // Check for tooltip data
            if (!elementWithTooltip.dataset || !elementWithTooltip.dataset.tooltip) {
                // Hide if no hover
                if (this.currentTarget && !this.tooltipElements.has(e.target)) {
                    this.scheduleHide();
                }
                return;
            }
            
            // Avoid redundant processing
            if (elementWithTooltip === this.currentTarget && elementWithTooltip.dataset.tooltip === this.currentTooltipContent) {
                this.updatePosition(e.clientX, e.clientY);
                return;
            }
            
            // Show tooltip for new element
            this.scheduleShow(elementWithTooltip, e.clientX, e.clientY);
            
        } catch (error) {
            Logger.error(error.message, "OptimizedTooltip.handleMouseMove");
        }
    },
    
        handleMouseOut(e) {
        try {
            // Hide if moving away from tooltip-enabled element
            if (e.target && e.target.dataset && e.target.dataset.tooltip) {
                this.scheduleHide();
            }
        } catch (error) {
            Logger.error(error.message, "OptimizedTooltip.handleMouseOut");
        }
    },
    
        scheduleShow(element, x, y) {
        if (this.showTimer) {
            clearTimeout(this.showTimer);
        }
        
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        
        this.showTimer = setTimeout(() => {
            this.show(element, x, y);
        }, this.showDelay);
    },
    
        scheduleHide() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }
        
        this.hideTimer = setTimeout(() => {
            this.hide();
        }, this.hideDelay);
    },
    
        show(element, x, y) {
        try {
            if (!this.el) return;
            
            const tooltipContent = element.dataset.tooltip;
            
            // Early exit if same content
            if (element === this.currentTarget && tooltipContent === this.currentTooltipContent) {
                this.updatePosition(x, y);
                return;
            }
            
            // Cache current state
            this.currentTarget = element;
            this.currentTooltipContent = tooltipContent;
            
            // Sanitize tooltip content
            const sanitizedContent = this.sanitizeText(tooltipContent);
            
            // Batch DOM operations 
            requestAnimationFrame(() => {
                // Update content and position in single operation
                this.el.innerHTML = sanitizedContent;
                this.updatePosition(x, y);
                this.el.classList.remove("hidden");
            });
            
        } catch (error) {
            Logger.error(error.message, "OptimizedTooltip.show");
        }
    },
    
        hide() {
        try {
            if (!this.el) return;
            
            // Clear timers
            if (this.showTimer) {
                clearTimeout(this.showTimer);
                this.showTimer = null;
            }
            
            // Hide requestAnimationFrame
            requestAnimationFrame(() => {
                this.el.classList.add("hidden");
            });
            
            // Reset state
            this.currentTarget = null;
            this.currentTooltipContent = null;
            
        } catch (error) {
            Logger.error(error.message, "OptimizedTooltip.hide");
        }
    },
    
        updatePosition(x, y) {
        try {
            if (!this.el) return;
            
            // Tooltip offset
            const offsetX = x + 14;
            const offsetY = y + 14;
            
            // Prevent off-screen
            const tooltipWidth = this.el.offsetWidth || 200;
            const tooltipHeight = this.el.offsetHeight || 100;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Adjust position if tooltip would go off screen
            let finalX = offsetX;
            let finalY = offsetY;
            
            if (finalX + tooltipWidth > viewportWidth - 10) {
                finalX = viewportWidth - tooltipWidth - 10;
            }
            
            if (finalY + tooltipHeight > viewportHeight - 10) {
                finalY = viewportHeight - tooltipHeight - 10;
            }
            
            // Use transform, positions relative to the element's natural position
            this.el.style.transform = `translate(${finalX}px, ${finalY}px)`;
            
            this.el.style.position = 'absolute';
            
            // Fallback for older browsers
            this.el.style.left = '0px';
            this.el.style.top = '0px';
            
        } catch (error) {
            Logger.error(error.message, "OptimizedTooltip.updatePosition");
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    OptimizedTooltip.init();
});

function renderPlayerStats() {    
    const levelEl = document.getElementById("level-display");
    const xpEl = document.getElementById("xp-display");
    const progressFillEl = document.getElementById("xp-progress-fill");

    if (levelEl) {
        levelEl.textContent = `Level: ${GameState.player.level}`;
    } else {
        console.warn("level-display element not found!");
    }

    if (xpEl) {
        xpEl.textContent = `XP: ${GameState.player.xp} / ${GameState.player.xpToNext}`;
    } else {
        console.warn("xp-display element not found!");
    }

    if (progressFillEl) {
        const progress = (GameState.player.xp / GameState.player.xpToNext) * 100;
        progressFillEl.style.width = `${progress}%`;
    } else {
        console.warn("xp-progress-fill element not found!");
    }
}

function getElementSafely(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID "${id}" not found`);
    }
    return element;
}

function removeTileContent(tile) {
    if (!tile.cropId) return;
    
    tile.cropId = null;
    tile.plantedAt = null;
    tile.isCooldown = false;
    tile.state = TILE_STATE.EMPTY;
    clearTileCache(tile);
}

function handleFarmTileClick(index) {
    if (index >= GameState.farm.unlockedTiles) {
        return;
    }
    const tile = GameState.farm.tiles[index];

    if (GameState.mode === 'remove') {
        removeTileContent(tile);
        updateTileUI(tile, index, farmEl, GameData.getCropIcon, GameState.farm.unlockedTiles);
        return;
    }

    // Empty > Plant
    if (tile.isEmpty()) {
        plantCrop(tile, GameState.selectedCrop);
        updateTileUI(tile, index, farmEl, GameData.getCropIcon, GameState.farm.unlockedTiles);
        return;
    }

    // Planted > Check if ready
    if (tile.isReady()) {
        harvestTile(tile);
        updateTileUI(tile, index, farmEl, GameData.getCropIcon, GameState.farm.unlockedTiles);
    }
}

function handleTreeTileClick(index) {
    if (index >= GameState.trees.unlockedTiles) {
        return;
    }
    const tile = GameState.trees.tiles[index];

    if (GameState.mode === 'remove') {
        removeTileContent(tile);
        updateTileUI(tile, index, treesEl, GameData.getTreeIcon, GameState.trees.unlockedTiles);
        return;
    }

    // Empty > Plant
    if (tile.isEmpty()) {
        plantTree(tile, GameState.selectedTree);
        updateTileUI(tile, index, treesEl, GameData.getTreeIcon, GameState.trees.unlockedTiles);
        return;
    }

    // Planted > Check if ready
    if (tile.isReady()) {
        harvestTreeTile(tile);
        updateTileUI(tile, index, treesEl, GameData.getTreeIcon, GameState.trees.unlockedTiles);
    }
}

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
    
    // Create crop selection section
    const cropsSection = document.createElement('div');
    cropsSection.className = 'crop-section';
    cropsSection.innerHTML = '<h3>Crops</h3>';
    
    GameData.getAllCrops().forEach(cropId => {
        const cropData = GameData.getCropData(cropId);
        const btn = document.createElement('button');
        btn.className = 'crop-btn';
        btn.dataset.crop = cropId;

        if (isCropUnlocked(cropData)) {
            btn.innerHTML = `${cropData.icon} ${cropData.name}`;
            // Use tooltip with XP and proper formatting
            btn.dataset.tooltip = getCropSelectorTooltipContent(cropId);
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
    
    // Re-scan for tooltips after DOM update
    if (OptimizedTooltip && typeof OptimizedTooltip.scanForTooltips === 'function') {
        OptimizedTooltip.scanForTooltips();
    }
}

function selectTree(treeName) {
    if (GameData.isValidTree(treeName)) {
        GameState.selectedTree = treeName;
        updateTreeSelectorUI();
    }
}

function unlockTree(treeId) {
    const treeData = GameData.getTreeData(treeId);
    if (GameState.coins >= treeData.unlockCost) {
        GameState.coins -= treeData.unlockCost;
        GameState.trees.saplingsUnlocked[treeId] = true;
        initTreeSelector();
        renderCoins(GameState.coins);
    }
}

function updateTreeSelectorUI() {
    if (!treeSelectorEl) return;
    const buttons = treeSelectorEl.querySelectorAll('.tree-btn');
    buttons.forEach(btn => {
        if (btn.dataset.tree === GameState.selectedTree) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function initTreeSelector() {
    if (!treeSelectorEl) {
        console.warn("tree-selector element not found!")
        return;
    }
    treeSelectorEl.innerHTML = '';
    
    const treesSection = document.createElement('div');
    treesSection.className = 'tree-section';
    treesSection.innerHTML = '<h3>Trees</h3>';
    
    GameData.getAllTrees().forEach(treeId => {
        const treeData = GameData.getTreeData(treeId);
        const btn = document.createElement('button');
        btn.className = 'tree-btn';
        btn.dataset.tree = treeId;
        
        if (GameState.trees.saplingsUnlocked[treeId]) {
            btn.innerHTML = `${treeData.icon} ${treeData.name}`;
            // Use tooltip with XP and proper formatting
            btn.dataset.tooltip = getTreeSelectorTooltipContent(treeId);
            btn.onclick = () => selectTree(treeId);
        } else {
            const cost = treeData.unlockCost;
            if (GameState.coins >= cost) {
                btn.innerHTML = `${treeData.icon} ${treeData.name} (${cost} coins)`;
                btn.onclick = () => unlockTree(treeId);
            } else {
                btn.innerHTML = `🔒 ${treeData.icon} ${treeData.name} (${cost} coins)`;
                btn.disabled = true;
                btn.classList.add('locked');
            }
        }
        treesSection.appendChild(btn);
    });
    
    treeSelectorEl.appendChild(treesSection);
    
    updateTreeSelectorUI();
    
    // Re-scan for tooltips after DOM update
    if (OptimizedTooltip && typeof OptimizedTooltip.scanForTooltips === 'function') {
        OptimizedTooltip.scanForTooltips();
    }
}

function tileUnlockCost(tileCount) {
    return Math.floor(75 * Math.pow(tileCount, 1.9));
}

function treeTileUnlockCost(tileCount) {
    return Math.floor(500 * Math.pow(tileCount, 2.2));
}

const unlockBtn = document.getElementById("unlockTileBtn");

function updateUnlockButton() {
    if (!unlockBtn) return;
    if (GameState.farm.unlockedTiles >= GameState.farm.maxTiles) {
        unlockBtn.disabled = true;
        unlockBtn.textContent = "All tiles unlocked";
        return;
    }

    const cost = tileUnlockCost(GameState.farm.unlockedTiles);
    
    if (GameState.coins >= cost) {
        unlockBtn.disabled = false;
        unlockBtn.textContent = `Unlock Farm Tile (${cost} coins)`;
    } else {
        unlockBtn.disabled = true;
        unlockBtn.textContent = `Unlock Farm Tile (${cost} coins)`;
    }
}

unlockBtn.onclick = () => {
    unlockTile('farm');
}

const unlockTreeBtn = document.getElementById("unlockTreeTileBtn");

function updateUnlockTreeButton() {
    if (!unlockTreeBtn) return;
    if (GameState.trees.unlockedTiles >= GameState.trees.maxTiles) {
        unlockTreeBtn.disabled = true;
        unlockTreeBtn.textContent = "All tree tiles unlocked";
        return;
    }
    
    const cost = treeTileUnlockCost(GameState.trees.unlockedTiles);
    
    if (GameState.coins >= cost) {
        unlockTreeBtn.disabled = false;
        unlockTreeBtn.textContent = `Unlock Tree Tile (${cost} coins)`;
    } else {
        unlockTreeBtn.disabled = true;
        unlockTreeBtn.textContent = `Unlock Tree Tile (${cost} coins)`;
    }
}

unlockTreeBtn.onclick = () => {
    unlockTile('tree');
}

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
                updateUnlockTreeButton();
                initTreeSelector();
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

function initShovelMode() {
    const shovelBtns = document.querySelectorAll("#shovelBtn");

    shovelBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            toggleRemoveMode();
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && GameState.mode === "remove") {
            toggleRemoveMode();
        }
    });
}

function toggleRemoveMode() {
    GameState.mode = GameState.mode === "remove" ? "normal" : "remove";
    updateBodyClass();
    updateShovelButtons();
}

function updateBodyClass() {
    if (GameState.mode === "remove") {
        document.body.classList.add("remove-mode");
    } else {
        document.body.classList.remove("remove-mode");
    }
}

function updateShovelButtons() {
    const shovelBtns = document.querySelectorAll("#shovelBtn");
    shovelBtns.forEach(btn => {
        if (GameState.mode === "remove") {
            btn.textContent = "Exit Remove";
            btn.classList.add("active");
        } else {
            btn.textContent = "🪓 Remove";
            btn.classList.remove("active");
        }
    });
}


loadGame();
initCropSelector();
initTreeSelector();
initSaveLoadButtons();
initHamburgerMenu();
initShovelMode();
updateUnlockButton();
updateUnlockTreeButton();

const treeUtilitiesEl = getElementSafely('tree-utilities');
if (treeUtilitiesEl) treeUtilitiesEl.style.display = 'none';
if (treeSelectorEl) treeSelectorEl.style.display = 'none';

renderGame();
startAutoSave();