// Game State
let planes = [];
let todayPlane = null;
let currentRound = 1;
let score = 0;
let gameState = {
    guesses: [],
    completed: false
};

// Zoom levels for each round (scale and position randomness)
const ZOOM_LEVELS = [
    { scale: 300, blur: 2 },    // Round 1: Very zoomed in
    { scale: 225, blur: 1 },    // Round 2: Still zoomed
    { scale: 160, blur: 0 },    // Round 3: Moderate zoom
    { scale: 120, blur: 0 },    // Round 4: Slight zoom
    { scale: 100, blur: 0 }     // Round 5: Full image
];

const MULTIPLIERS = [5, 4, 3, 2, 1];

// Seeded random number generator
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// Get today's date as seed
function getTodaySeed() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return year * 10000 + month * 100 + day;
}

// Initialize game
async function initGame() {
    try {
        const response = await fetch('planes.json');
        planes = await response.json();
        
        // Select today's plane based on date
        const seed = getTodaySeed();
        const rng = new SeededRandom(seed);
        const planeIndex = Math.floor(rng.next() * planes.length);
        todayPlane = planes[planeIndex];
        
        // Store random offset for image positioning
        todayPlane.offsetX = rng.next() * 100;
        todayPlane.offsetY = rng.next() * 100;
        
        // Check for saved game state
        loadGameState();
        
        if (gameState.completed) {
            showGameOver();
        } else {
            setupGame();
        }
        
        updateCountdown();
        setInterval(updateCountdown, 1000);
        
    } catch (error) {
        console.error('Failed to load planes:', error);
        alert('Failed to load game data. Please refresh the page.');
    }
}

// Setup game UI
function setupGame() {
    populateManufacturers();
    updateImage();
    updateGameInfo();
    
    // Event listeners
    document.getElementById('manufacturer').addEventListener('change', onManufacturerChange);
    document.getElementById('model').addEventListener('change', onModelChange);
    document.getElementById('version').addEventListener('change', onVersionChange);
    document.getElementById('submit-guess').addEventListener('click', submitGuess);
    document.getElementById('next-round').addEventListener('click', nextRound);
    document.getElementById('share-results').addEventListener('click', shareResults);
}

// Populate manufacturer dropdown
function populateManufacturers() {
    const manufacturers = [...new Set(planes.map(p => p.manufacturer))].sort();
    const select = document.getElementById('manufacturer');
    
    select.innerHTML = '<option value="">Select manufacturer...</option>';
    manufacturers.forEach(mfr => {
        const option = document.createElement('option');
        option.value = mfr;
        option.textContent = mfr;
        select.appendChild(option);
    });
}

// Handle manufacturer selection
function onManufacturerChange(e) {
    const manufacturer = e.target.value;
    const modelSelect = document.getElementById('model');
    const versionSelect = document.getElementById('version');
    
    if (!manufacturer) {
        modelSelect.disabled = true;
        versionSelect.disabled = true;
        modelSelect.innerHTML = '<option value="">Select model...</option>';
        versionSelect.innerHTML = '<option value="">Select version...</option>';
        updateSubmitButton();
        return;
    }
    
    // Get unique models for this manufacturer
    const models = [...new Set(
        planes
            .filter(p => p.manufacturer === manufacturer)
            .map(p => p.model)
    )].sort();
    
    modelSelect.innerHTML = '<option value="">Select model...</option>';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
    });
    
    modelSelect.disabled = false;
    versionSelect.disabled = true;
    versionSelect.innerHTML = '<option value="">Select version...</option>';
    updateSubmitButton();
}

// Handle model selection
function onModelChange(e) {
    const manufacturer = document.getElementById('manufacturer').value;
    const model = e.target.value;
    const versionSelect = document.getElementById('version');
    
    if (!model) {
        versionSelect.disabled = true;
        versionSelect.innerHTML = '<option value="">Select version...</option>';
        updateSubmitButton();
        return;
    }
    
    // Get unique versions for this manufacturer + model
    const versions = [...new Set(
        planes
            .filter(p => p.manufacturer === manufacturer && p.model === model)
            .map(p => p.version)
    )].sort();
    
    versionSelect.innerHTML = '<option value="">Select version...</option>';
    versions.forEach(version => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        versionSelect.appendChild(option);
    });
    
    versionSelect.disabled = false;
    updateSubmitButton();
}

// Handle version selection
function onVersionChange() {
    updateSubmitButton();
}

// Update submit button state
function updateSubmitButton() {
    const manufacturer = document.getElementById('manufacturer').value;
    const model = document.getElementById('model').value;
    const version = document.getElementById('version').value;
    const submitBtn = document.getElementById('submit-guess');
    
    submitBtn.disabled = !(manufacturer && model && version);
}

// Update image with zoom effect
function updateImage() {
    const imageDiv = document.getElementById('plane-image');
    const zoomLevel = ZOOM_LEVELS[currentRound - 1];
    
    // If this is the first load, preload the image hidden, then show with zoom already applied
    if (!imageDiv.style.backgroundImage) {
        // Disable transition for initial load
        imageDiv.style.transition = 'none';
        imageDiv.style.opacity = '0';
        
        const img = new Image();
        img.onload = function() {
            imageDiv.style.backgroundImage = `url('${todayPlane.image}')`;
            imageDiv.style.backgroundSize = `${zoomLevel.scale}%`;
            imageDiv.style.backgroundPosition = `${todayPlane.offsetX}% ${todayPlane.offsetY}%`;
            if (zoomLevel.blur > 0) {
                imageDiv.style.filter = `blur(${zoomLevel.blur}px)`;
            } else {
                imageDiv.style.filter = 'none';
            }
            // Force reflow then re-enable transitions and show
            imageDiv.offsetHeight;
            imageDiv.style.transition = 'background-size 0.5s ease-in-out, background-position 0.5s ease-in-out, filter 0.5s ease-in-out, opacity 0.3s ease-in';
            imageDiv.style.opacity = '1';
        };
        img.src = todayPlane.image;
    } else {
        imageDiv.style.backgroundSize = `${zoomLevel.scale}%`;
        imageDiv.style.backgroundPosition = `${todayPlane.offsetX}% ${todayPlane.offsetY}%`;
        if (zoomLevel.blur > 0) {
            imageDiv.style.filter = `blur(${zoomLevel.blur}px)`;
        } else {
            imageDiv.style.filter = 'none';
        }
    }
}

// Update game info display
function updateGameInfo() {
    document.getElementById('current-round').textContent = currentRound;
    document.getElementById('multiplier').textContent = MULTIPLIERS[currentRound - 1];
    document.getElementById('score').textContent = score;
}

// Submit guess
function submitGuess() {
    const manufacturer = document.getElementById('manufacturer').value;
    const model = document.getElementById('model').value;
    const version = document.getElementById('version').value;
    
    const correct = {
        manufacturer: manufacturer === todayPlane.manufacturer,
        model: model === todayPlane.model,
        version: version === todayPlane.version
    };
    
    const allCorrect = correct.manufacturer && correct.model && correct.version;
    
    // Calculate score for this round
    if (allCorrect) {
        const roundScore = 100 * MULTIPLIERS[currentRound - 1];
        score += roundScore;
    }
    
    // Store guess
    gameState.guesses.push({
        round: currentRound,
        manufacturer,
        model,
        version,
        correct
    });
    
    // Show results
    showRoundResults(manufacturer, model, version, correct, allCorrect);
    
    // Hide input section
    document.getElementById('input-section').style.display = 'none';
}

// Show round results
function showRoundResults(manufacturer, model, version, correct, allCorrect) {
    const resultsSection = document.getElementById('results-section');
    
    // Update result displays
    document.getElementById('result-manufacturer').textContent = manufacturer;
    document.getElementById('result-model').textContent = model;
    document.getElementById('result-version').textContent = version;
    
    // Add correct/incorrect classes
    const mfrRow = resultsSection.querySelector('.result-row:nth-child(1)');
    const modelRow = resultsSection.querySelector('.result-row:nth-child(2)');
    const versionRow = resultsSection.querySelector('.result-row:nth-child(3)');
    
    mfrRow.className = 'result-row ' + (correct.manufacturer ? 'correct' : 'incorrect');
    modelRow.className = 'result-row ' + (correct.model ? 'correct' : 'incorrect');
    versionRow.className = 'result-row ' + (correct.version ? 'correct' : 'incorrect');
    
    // Update button text
    const nextBtn = document.getElementById('next-round');
    if (allCorrect || currentRound >= 5) {
        nextBtn.textContent = 'Finish Game';
    } else {
        nextBtn.textContent = 'Next Round';
    }
    
    resultsSection.style.display = 'block';
}

// Next round or finish game
function nextRound() {
    const lastGuess = gameState.guesses[gameState.guesses.length - 1];
    const allCorrect = lastGuess.correct.manufacturer && lastGuess.correct.model && lastGuess.correct.version;
    
    if (allCorrect || currentRound >= 5) {
        finishGame();
        return;
    }
    
    // Move to next round
    currentRound++;
    
    // Reset UI
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('input-section').style.display = 'flex';
    
    // Clear selections
    document.getElementById('manufacturer').value = '';
    document.getElementById('model').value = '';
    document.getElementById('model').disabled = true;
    document.getElementById('version').value = '';
    document.getElementById('version').disabled = true;
    updateSubmitButton();
    
    // Update image and info
    updateImage();
    updateGameInfo();
    
    saveGameState();
}

// Finish game
function finishGame() {
    gameState.completed = true;
    gameState.finalScore = score;
    saveGameState();
    showGameOver();
}

// Show game over screen
function showGameOver() {
    document.getElementById('input-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    
    // Update final score
    document.getElementById('final-score').textContent = gameState.finalScore || score;
    
    // Show correct answer
    document.getElementById('answer-manufacturer').textContent = todayPlane.manufacturer;
    document.getElementById('answer-model').textContent = todayPlane.model;
    document.getElementById('answer-version').textContent = todayPlane.version;
    document.getElementById('attribution').textContent = `Photo: ${todayPlane.attribution}`;
    
    // Show full image
    currentRound = 5;
    updateImage();
    
    document.getElementById('game-over').style.display = 'block';
}

// Share results
function shareResults() {
    const lastGuess = gameState.guesses[gameState.guesses.length - 1];
    const won = lastGuess.correct.manufacturer && lastGuess.correct.model && lastGuess.correct.version;
    
    let shareText = `Plandl ✈️ ${getTodaySeed()}\n`;
    shareText += `Score: ${gameState.finalScore || score}\n`;
    shareText += `Rounds: ${gameState.guesses.length}/5\n\n`;
    
    gameState.guesses.forEach((guess, i) => {
        const mfr = guess.correct.manufacturer ? '🟩' : '🟥';
        const model = guess.correct.model ? '🟩' : '🟥';
        const version = guess.correct.version ? '🟩' : '🟥';
        shareText += `${mfr}${model}${version}\n`;
    });
    
    shareText += '\nPlay at: ' + window.location.href;
    
    if (navigator.share) {
        navigator.share({
            text: shareText
        }).catch(() => {
            copyToClipboard(shareText);
        });
    } else {
        copyToClipboard(shareText);
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    alert('Results copied to clipboard!');
}

// Save game state to localStorage
function saveGameState() {
    const state = {
        date: getTodaySeed(),
        round: currentRound,
        score: score,
        guesses: gameState.guesses,
        completed: gameState.completed,
        finalScore: gameState.finalScore
    };
    localStorage.setItem('plandlState', JSON.stringify(state));
}

// Load game state from localStorage
function loadGameState() {
    const saved = localStorage.getItem('plandlState');
    if (!saved) return;
    
    const state = JSON.parse(saved);
    
    // Check if saved state is from today
    if (state.date !== getTodaySeed()) {
        localStorage.removeItem('plandlState');
        return;
    }
    
    // Restore state
    currentRound = state.round;
    score = state.score;
    gameState.guesses = state.guesses || [];
    gameState.completed = state.completed || false;
    gameState.finalScore = state.finalScore;
}

// Update countdown to next puzzle
function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const countdownEl = document.getElementById('countdown');
    if (countdownEl) {
        countdownEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Start the game when page loads
document.addEventListener('DOMContentLoaded', initGame);
