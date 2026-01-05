// Farm
const SIZE = 5;
const GROW_TIME = 5000; // 5 seconds

const farm = {
  coins: 0,
  grid: []
};

for (let i = 0; i < SIZE * SIZE; i++) {
  farm.grid.push({
    crop: null,
    plantedAt: null,
    growTime: GROW_TIME
  });
}

// Crop
const CROPS = {
    carrot: {time: 3000, value: 5},
    corn: {time: 7000, value: 15},
    rice: {time: 4500, value: 7}
};

// Render
const farmEl = document.getElementById("farm");
const coinsEl = document.getElementById("coins");

function render() {
  farmEl.innerHTML = "";

  farm.grid.forEach((tile, index) => {
    const el = document.createElement("div");
    el.className = "tile";

    if (!tile.crop) {
      el.textContent = "Empty";
    } else {
      const elapsed = Date.now() - tile.plantedAt;

      if (elapsed >= tile.growTime) {
        el.textContent = "🌽";
      } else {
        el.textContent = "🌱";
      }
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
  if (!tile.crop) {
    tile.crop = "corn";
    tile.plantedAt = Date.now();
    return;
  }

  // Planted > Check if ready
  const elapsed = Date.now() - tile.plantedAt;

  if (elapsed >= tile.growTime) {
    tile.crop = null;
    tile.plantedAt = null;
    farm.coins += 10;
  }
}




// Game Loop
setInterval(render, 1000);
render();
