// CONFIG & STATE
const typeColors = {
    water: "#6390F0", fire: "#EE8130", grass: "#7AC74C", electric: "#F7D02C",
    ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1", ground: "#E2BF65",
    flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A", rock: "#B6A136",
    ghost: "#735797", dragon: "#6F35FC", dark: "#705746", steel: "#B7B7CE",
    fairy: "#D685AD", normal: "#A8A77A"
};

let seenTypeSignatures = new Set();
const MAX_RETRIES = 20;

// DOM ELEMENTS
const themes = {
    modern: document.getElementById('modernUI'),
    retro: document.getElementById('retroUI'),
    lobby: document.getElementById('lobbyScreen'),
    selection: document.getElementById('typeSelectionScreen'),
    victory: document.getElementById('victoryScreen')
};
const inputs = {
    modern: document.getElementById('inputModern'),
    retro: document.getElementById('inputRetro')
};
const buttons = {
    modern: document.getElementById('btnModern'),
    retro: document.getElementById('btnRetro')
};

// --- INIT ---
function init() {
    // Start in Lobby
    activeTheme = 'modern'; // Default
    updateThemeClasses();

    if (!window.POKEMON_DB) {
        console.warn("POKEMON_DB not found in init. waiting...");
        // Fallback: check again after 1s
        setTimeout(() => {
            if (!window.POKEMON_DB) {
                console.error("POKEMON_DB failed to load.");
                // Optional: Show visual warning in lobby 
                const lobbyTitle = document.querySelector('.lobby-title');
                if (lobbyTitle) lobbyTitle.innerHTML += '<br><span style="font-size:0.5em;color:red">(Error: BD no cargada)</span>';
            } else {
                console.log("POKEMON_DB loaded late.");
            }
        }, 1000);
    }

    // Event Listeners for Enters (Robust Fix)
    const handleEnter = (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault(); // Prevent default form submission if any
            checkAnswer();
        }
    };

    inputs.modern.addEventListener('keydown', handleEnter);
    inputs.retro.addEventListener('keydown', handleEnter);
}

// Global State
let gameMode = 'random'; // 'random' | 'choice'
let selectedChoiceType = null;
let challengeQueue = [];

function showTypeSelection() {
    console.log("Opening Type Selection Screen...");
    themes.lobby.classList.add('hidden');
    themes.selection.classList.remove('hidden');

    // Ensure correct theme wrapper class
    if (activeTheme === 'modern') {
        themes.selection.classList.remove('retro');
        themes.selection.classList.add('modern');
    } else {
        themes.selection.classList.remove('modern');
        themes.selection.classList.add('retro');
    }

    renderTypeSelectionGrid();
}

function renderTypeSelectionGrid() {
    const grid = document.getElementById('typeGrid');
    grid.innerHTML = "";

    Object.keys(typeColors).forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'type-choice-btn';
        btn.style.backgroundColor = typeColors[type];
        btn.textContent = type;
        btn.onclick = () => startChoiceMode(type);
        grid.appendChild(btn);
    });
}

function startChoiceMode(type) {
    gameMode = 'choice';
    selectedChoiceType = type;

    // Build Queue: [Pure Type, Type+Normal, Type+Fire, ...]
    challengeQueue = [];

    // 1. Add Pure Type Challenge
    challengeQueue.push({ base: type, secondary: null });

    // 2. Add all duals
    Object.keys(typeColors).forEach(secondary => {
        if (secondary !== type) {
            challengeQueue.push({ base: type, secondary: secondary });
        }
    });

    themes.selection.classList.add('hidden');
    startGame('choice');
}

function startGame(mode) {
    if (mode === 'random') {
        gameMode = 'random';
        themes.lobby.classList.add('hidden');
    }
    // For 'choice', startChoiceMode already handled hidden classes for Lobby/Selection

    if (activeTheme === 'modern') {
        themes.modern.classList.remove('hidden');
    } else {
        themes.retro.classList.remove('hidden');
    }

    // Reset Game State
    score = 0;
    streak = 0;
    lives = 5;
    seenTypeSignatures.clear(); // Clear history on new game
    fetchRandomSourcePokemon();
    updateUI();

    // Immediate focus
    setTimeout(() => inputs[activeTheme].focus(), 50);
}

// --- THEME SWITCHING ---
// --- THEME SWITCHING ---
function toggleTheme() {
    activeTheme = activeTheme === 'modern' ? 'retro' : 'modern';
    updateThemeClasses();
}

function updateThemeClasses() {
    // Update Lobby Theme
    if (activeTheme === 'modern') {
        themes.lobby.classList.remove('retro');
        themes.lobby.classList.add('modern');
        document.body.classList.remove('retro-active'); // For modal
    } else {
        themes.lobby.classList.remove('modern');
        themes.lobby.classList.add('retro');
        document.body.classList.add('retro-active'); // For modal
    }

    // If game is active (lobby hidden), flip UIs
    if (themes.lobby.classList.contains('hidden')) {
        if (activeTheme === 'modern') {
            themes.retro.classList.add('hidden');
            themes.modern.classList.remove('hidden');
            inputs.modern.focus();
        } else {
            themes.modern.classList.add('hidden');
            themes.retro.classList.remove('hidden');
            inputs.retro.focus();
        }
    }
    updateUI();
}

// --- GAME LOGIC ---
function updateUI() {
    // Update Score
    document.getElementById('scoreModern').textContent = score;
    document.getElementById('scoreRetro').textContent = score.toString().padStart(3, '0');

    // Update Lives
    const hearts = '❤'.repeat(lives) + '♡'.repeat(5 - lives);
    document.getElementById('livesModern').textContent = hearts;
    document.getElementById('livesRetro').textContent = hearts;

    if (lives <= 2) {
        document.getElementById('livesRetro').style.color = '#FF0000';
    } else {
        document.getElementById('livesRetro').style.color = '#FF3B3B';
    }

    // Sync Inputs
    const activeVal = inputs[activeTheme].value;
    inputs.modern.value = activeVal;
    inputs.retro.value = activeVal;
}

// NEW LOGIC: Fetch Random Pokemon from LOCAL DB
async function fetchRandomSourcePokemon() {
    if (lives <= 0) return;

    // Clear previous types UI
    document.getElementById("typesModern").innerHTML = '<span style="font-size:0.9rem;opacity:0.7">Buscando rastros...</span>';
    document.getElementById("typesRetro").innerHTML = '<span style="font-size:8px;color:#aaa">LOADING...</span>';
    clearFeedback();
    inputs.modern.value = "";
    inputs.retro.value = "";
    setBtnLoading(true);

    if (gameMode === 'choice') {
        // No async needed really, but keeping structure
        setTimeout(() => fetchNextInQueue(), 10);
    } else {
        setTimeout(() => fetchRandomUnique(), 10);
    }
}

function fetchNextInQueue() {
    if (challengeQueue.length === 0) {
        showVictoryScreen();
        return;
    }

    const challenge = challengeQueue.shift(); // Get next

    if (!window.POKEMON_DB) {
        alert("Error: Base de datos de Pokémon no cargada. Revisa tu conexión o los archivos del repositorio.");
        console.error("POKEMON_DB is undefined");
        return;
    }

    try {
        // Filter DB for candidates matching the challenge type(s)
        const candidates = window.POKEMON_DB.filter(p => {
            // We need to check if this pokemon FITS the challenge
            // But the original logic was: "Fetch type X, then pick random from it"
            // Here we can just pick a pokemon that has this type.
            return p.types.includes(challenge.base);
        });

        if (candidates.length === 0) {
            console.log("No candidates for base type:", challenge.base);
            fetchNextInQueue();
            return;
        }

        // Randomized check for valid pokemon in this type list
        // In local DB we have the full object, so we can just check types directly.

        let found = null;
        // Shuffle and find match
        // Optimization: Filter for exact match first

        const matchingCandidates = candidates.filter(p => {
            const types = p.types; // already sorted in DB
            if (challenge.secondary === null) {
                return types.length === 1 && types[0] === challenge.base;
            } else {
                return types.length === 2 && types.includes(challenge.base) && types.includes(challenge.secondary);
            }
        });

        if (matchingCandidates.length > 0) {
            const rnd = Math.floor(Math.random() * matchingCandidates.length);
            found = matchingCandidates[rnd];
            currentTypes = found.types; // Global set
        }

        if (found) {
            renderTypes();
            setBtnLoading(false);
            inputs[activeTheme].focus();
        } else {
            console.log(`No pokemon found for ${challenge.base} + ${challenge.secondary} (in DB). Skipping.`);
            fetchNextInQueue(); // Recursively try next
        }

    } catch (e) {
        console.error(e);
        fetchNextInQueue(); // Skip on error
    }
}

function showVictoryScreen() {
    themes.modern.classList.add('hidden');
    themes.retro.classList.add('hidden');
    themes.selection.classList.add('hidden');
    themes.victory.classList.remove('hidden');

    document.getElementById('victoryType').textContent = selectedChoiceType;

    // Theme wrapper for victory
    if (activeTheme === 'modern') {
        themes.victory.classList.remove('retro');
        themes.victory.classList.add('modern');
    } else {
        themes.victory.classList.remove('modern');
        themes.victory.classList.add('retro');
    }
}

function fetchRandomUnique() {
    // Retry logic for unique combinations
    let attempts = 0;
    let newTypes = [];
    let signature = "";
    let foundUnique = false;

    if (!window.POKEMON_DB || window.POKEMON_DB.length === 0) {
        console.error("DB Not loaded");
        return;
    }

    while (attempts < MAX_RETRIES && !foundUnique) {
        attempts++;
        const randomIdx = Math.floor(Math.random() * window.POKEMON_DB.length);
        const p = window.POKEMON_DB[randomIdx];

        newTypes = p.types; // Already sorted
        signature = newTypes.join(",");

        if (!seenTypeSignatures.has(signature)) {
            foundUnique = true;
            seenTypeSignatures.add(signature);
            currentTypes = newTypes; // update global
        } else {
            // console.log(`Skipping duplicate combination: ${signature} (Attempt ${attempts})`);
        }
    }

    if (!foundUnique) {
        console.warn("Could not find unique combination after retries. Resetting history.");
        seenTypeSignatures.clear();
        // Just use the last fetched one
        if (newTypes.length > 0) {
            currentTypes = newTypes;
            seenTypeSignatures.add(signature);
        }
    }

    renderTypes();
    setBtnLoading(false);
    inputs[activeTheme].focus();
}

function renderTypes() {
    // Helper to render
    const render = (containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = "";
        currentTypes.forEach(type => {
            const b = document.createElement("div");
            b.className = "type-badge";
            b.style.background = typeColors[type];
            b.textContent = type;
            container.appendChild(b);
        });
    };

    render("typesModern");
    render("typesRetro");
}

function setBtnLoading(loading) {
    const txtM = loading ? "..." : "Comprobar";
    const txtR = loading ? "..." : "CHECK";
    buttons.modern.textContent = txtM;
    buttons.modern.disabled = loading;
    buttons.retro.textContent = txtR;
    buttons.retro.disabled = loading;
}

function clearFeedback() {
    const elM = document.getElementById('feedbackModern');
    const elR = document.getElementById('feedbackRetro');
    if (elM) {
        elM.textContent = "";
        elM.classList.remove('fade-out');
    }
    if (elR) {
        elR.textContent = "";
        elR.classList.remove('fade-out');
    }
    clearTimeout(feedbackTimeout);
}

// MODIFIED FEEDBACK LOGIC
let feedbackTimeout;
function showFeedback(msg, type) {
    const elM = document.getElementById('feedbackModern');
    const elR = document.getElementById('feedbackRetro');

    // Clear existing timeout/classes
    clearTimeout(feedbackTimeout);
    elM.classList.remove('fade-out');
    elR.classList.remove('fade-out');

    elM.textContent = msg;
    elM.style.opacity = '1';
    elM.style.color = type === 'error' ? 'var(--error)' : (type === 'success' ? 'var(--success)' : 'var(--warning)');

    elR.textContent = msg.toUpperCase();
    elR.style.opacity = '1';
    elR.style.color = type === 'error' ? '#FF3B3B' : (type === 'success' ? '#4caf50' : '#FFCB05');

    // Auto fade out after 2 seconds
    feedbackTimeout = setTimeout(() => {
        elM.classList.add('fade-out');
        elR.classList.add('fade-out');
        // Clear text after animation (1s)
        setTimeout(() => {
            if (elM.classList.contains('fade-out')) {
                elM.textContent = "";
                elR.textContent = "";
                elM.classList.remove('fade-out');
                elR.classList.remove('fade-out');
            }
        }, 1000);
    }, 2000);
}

function triggerConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}

// NEW: LOPUNNY STREAK ANIMATION
// NEW: LOPUNNY STREAK ANIMATION
function checkStreak() {
    if (streak <= 0 || streak > 1000) return;

    let shouldAnnounce = false;

    // Rule: "debe haber racha de 5 en 5 hasta llegar a las 20"
    if (streak <= 20) {
        if (streak % 5 === 0) shouldAnnounce = true;
    }
    // Rule: "a partir de las 20, que se de enunciado de racha solo cada 10"
    else {
        if (streak % 10 === 0) shouldAnnounce = true;
    }

    if (shouldAnnounce) {
        try {
            showSpecialOverlay(`¡RACHA DE ${streak}!`, 'happy');
        } catch (e) {
            console.error("Streak overlay error:", e);
        }
    }
}

function showSpecialOverlay(text, mode) { // mode: 'happy' | 'sad'
    const overlay = document.getElementById('specialOverlay');
    const msg = document.getElementById('streakMsg');
    const img = document.getElementById('lopunnyAnim');

    // Safety check - IF user is missing HTML, prevent crash
    if (!overlay || !msg || !img) {
        console.warn("Overlay elements missing!");
        return;
    }

    msg.textContent = text;
    img.classList.remove('hidden', 'sad-filter');

    if (mode === 'happy') {
        img.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/428.gif"; // Lopunny Anim
        triggerConfetti();
    } else {
        img.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/428.png"; // Static for Sad
        img.classList.add('sad-filter');
    }

    // Add event listener to hide image if it fails to load (User Request: "si no logras cargar el enunciado, mejor retirar")
    img.onerror = function () {
        img.style.display = 'none'; // Hide broken image
    };
    img.style.display = 'block'; // Ensure it's visible if loaded

    overlay.classList.add('active');

    // Hide after 3s
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => img.classList.add('hidden'), 500);
    }, 3000);
}

async function checkAnswer() {
    if (lives <= 0) return;

    const name = inputs[activeTheme].value.toLowerCase().trim();
    if (!name) return;

    // Guard: Don't check if game hasn't loaded a Pokemon yet
    if (currentTypes.length === 0) return;

    setBtnLoading(true);

    try {
        // Local Lookup
        const found = window.POKEMON_DB.find(p => p.name === name);

        if (!found) {
            showFeedback("Pokémon no encontrado / Typo", "warning");
            inputs[activeTheme].classList.add('shake');
            setTimeout(() => inputs[activeTheme].classList.remove('shake'), 400);
            setBtnLoading(false);
            return;
        }

        const pokeTypes = found.types; // Already sorted

        const isCorrect = pokeTypes.length === currentTypes.length &&
            currentTypes.every(t => pokeTypes.includes(t)) &&
            pokeTypes.every(t => currentTypes.includes(t));

        if (isCorrect) {
            score++;
            streak++; // Increment Streak
            showFeedback("¡Correcto!", "success");
            triggerConfetti();
            checkStreak(); // Check for 5, 10, etc.
            updateUI();

            setTimeout(() => {
                fetchRandomSourcePokemon();
            }, 1500);
        } else {
            deductLife();
            streak = 0; // Reset Streak
            if (lives > 0) {
                showFeedback("Tipos incorrectos. -1 Vida.", "error");

                // AUTO-CLEAR INPUT ON WRONG ANSWER
                inputs[activeTheme].value = "";
                inputs[activeTheme].focus();

                inputs[activeTheme].classList.add('shake');
                setTimeout(() => inputs[activeTheme].classList.remove('shake'), 400);
            }
            setBtnLoading(false);
        }

    } catch (e) {
        console.error("CheckAnswer Error:", e);
        showFeedback("Error inesperado", "error");
        setBtnLoading(false);
    }
}

function skip() {
    if (lives <= 0) return;
    deductLife();
    streak = 0; // Reset Streak
    if (lives > 0) {
        showFeedback("Saltado (-1 Vida)", "warning");
        fetchRandomSourcePokemon();
    }
}

function deductLife() {
    lives--;
    updateUI();
    if (lives <= 0) {
        // GAME OVER LOGIC
        try {
            showSpecialOverlay("GAME OVER", 'sad');
        } catch (e) { console.error("Overlay error path:", e); }

        showFeedback("GAME OVER", "error");

        setTimeout(() => {
            alert(`GAME OVER\nPuntaje Final: ${score}`);
            resetGame();
        }, 500);
    }
}

function resetGame() {
    score = 0;
    lives = 5;
    streak = 0;
    fetchRandomSourcePokemon();
    updateUI();
}

// --- NAVIGATION & HOME BUTTON ---
function tryExit() {
    // If no progress (score 0, fresh game), exit immediately
    if (score === 0 && streak === 0 && lives === 5) {
        returnToLobby();
        return;
    }
    // Else show confirmation
    document.getElementById('confirmationModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('confirmationModal').classList.add('hidden');
}

function confirmExit() {
    closeModal();
    returnToLobby();
}

function returnToLobby() {
    // Hide Game UIs
    themes.modern.classList.add('hidden');
    themes.retro.classList.add('hidden');
    themes.selection.classList.add('hidden');
    themes.victory.classList.add('hidden');

    // Show Lobby
    themes.lobby.classList.remove('hidden');

    // Reset State (so next game starts fresh)
    gameMode = 'random';
    resetGame();
}

// Start Game
init();
