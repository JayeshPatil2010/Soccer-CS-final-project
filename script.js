/**
 * International Soccer Predictor - Engine Logic
 * Using Poisson Distribution calibrated by historical results
 */

// --- CONFIGURATION ---
// Replace these with your actual Raw GitHub URLs
const ELO_CSV_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/elos.csv';
const RESULTS_CSV_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/results.csv';

let eloDatabase = [];
let globalAvgGoals = 1.35; // Default fallback until results.csv loads

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    loadData();
});

async function loadData() {
    // 1. Load ELO Ratings
    Papa.parse(ELO_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(eloResults) {
            eloDatabase = eloResults.data;
            populateTeamDropdowns();
            
            // 2. Load Match Results to calibrate the Poisson "Lambda"
            Papa.parse(RESULTS_CSV_URL, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(matchResults) {
                    calibrateModel(matchResults.data);
                }
            });
        }
    });
}

function populateTeamDropdowns() {
    const homeSelect = document.getElementById('homeTeam');
    const awaySelect = document.getElementById('awayTeam');
    
    // Get unique team names and sort alphabetically
    const teams = [...new Set(eloDatabase.map(row => row.team))].filter(t => t).sort();
    
    const optionsHTML = teams.map(team => `<option value="${team}">${team}</option>`).join('');
    homeSelect.innerHTML = optionsHTML;
    awaySelect.innerHTML = optionsHTML;
}

/**
 * Calibrates the model by finding the average goals per team 
 * in all international matches since 2020.
 */
function calibrateModel(data) {
    if (!data || data.length === 0) return;
    
    let totalGoals = 0;
    let matchCount = 0;

    data.forEach(match => {
        const homeS = parseInt(match.home_score);
        const awayS = parseInt(match.away_score);
        if (!isNaN(homeS) && !isNaN(awayS)) {
            totalGoals += (homeS + awayS);
            matchCount++;
        }
    });

    // Average goals scored by ONE team in a match
    globalAvgGoals = (totalGoals / (matchCount * 2));
    console.log(`Model calibrated. Baseline Lambda: ${globalAvgGoals.toFixed(3)}`);
}

// --- MATH CORE ---

function factorial(n) {
    if (n < 0) return 0;
    if (n === 0) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

/**
 * Poisson Formula: P(k; λ) = (λ^k * e^-λ) / k!
 */
function getPoisson(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// --- PREDICTION ENGINE ---

function predictMatch() {
    const homeName = document.getElementById('homeTeam').value;
    const awayName = document.getElementById('awayTeam').value;
    
    const homeElo = eloDatabase.find(t => t.team === homeName);
    const awayElo = eloDatabase.find(t => t.team === awayName);

    if (!homeElo || !awayElo) {
        alert("Team data not found. Please wait for CSVs to load.");
        return;
    }

    // 1. Calculate Expected Goals (Lambda) for both teams
    // We compare Offensive Elo of Attacker vs Defensive Elo of Defender
    let lambdaHome = (parseFloat(homeElo.offensive_elo) / parseFloat(awayElo.defensive_elo)) * globalAvgGoals;
    let lambdaAway = (parseFloat(awayElo.offensive_elo) / parseFloat(homeElo.defensive_elo)) * globalAvgGoals;

    // 2. Adjust for Home Advantage (standard international boost is ~10%)
    lambdaHome *= 1.10;

    // 3. Find Most Likely Scoreline
    let maxProbability = 0;
    let predictedHomeScore = 0;
    let predictedAwayScore = 0;

    // We check every score combination from 0-0 to 8-8
    for (let h = 0; h <= 8; h++) {
        for (let a = 0; a <= 8; a++) {
            let prob = getPoisson(h, lambdaHome) * getPoisson(a, lambdaAway);
            if (prob > maxProbability) {
                maxProbability = prob;
                predictedHomeScore = h;
                predictedAwayScore = a;
            }
        }
    }

    // 4. Calculate Home Win Probability (Sum of all h > a)
    let homeWinProb = 0;
    for (let h = 1; h <= 10; h++) {
        for (let a = 0; a < h; a++) {
            homeWinProb += getPoisson(h, lambdaHome) * getPoisson(a, lambdaAway);
        }
    }

    updateUI(homeName, awayName, predictedHomeScore, predictedAwayScore, homeWinProb);
}

// --- UI UPDATES ---

function updateUI(home, away, hScore, aScore, winProb) {
    const resultsArea = document.getElementById('resultsArea');
    const probBar = document.getElementById('probBar');
    
    resultsArea.classList.remove('hidden');
    
    document.getElementById('matchHeading').innerText = `${home} vs ${away}`;
    document.getElementById('homeScore').innerText = hScore;
    document.getElementById('awayScore').innerText = aScore;
    
    const winPercentage = (winProb * 100).toFixed(1);
    document.getElementById('winProb').innerText = `${winPercentage}%`;
    
    // Smoothly animate the progress bar
    setTimeout(() => {
        probBar.style.width = `${winPercentage}%`;
    }, 50);
}
