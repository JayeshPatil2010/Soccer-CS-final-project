/**
 * International Soccer Predictor Pro
 * Optimized with Exponential Power Scaling for High Accuracy
 */

const BASE_URL = 'https://raw.githubusercontent.com/JayeshPatil2010/Soccer-CS-final-project/main/';
const ELO_CSV_URL = BASE_URL + 'elos.csv';
const RESULTS_CSV_URL = BASE_URL + 'results.csv';

let eloDB = [];
let resultsDB = [];
let globalAvg = 1.35; // Calibrated dynamically from results.csv

window.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});

async function loadAllData() {
    // 1. Load Elo Ratings
    Papa.parse(ELO_CSV_URL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (eloResults) => {
            eloDB = eloResults.data;
            
            // 2. Load Match Results
            Papa.parse(RESULTS_CSV_URL, {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (matchResults) => {
                    resultsDB = matchResults.data;
                    calibrateAndInit();
                }
            });
        }
    });
}

function calibrateAndInit() {
    let totalGoals = 0;
    let matchCount = 0;
    
    // Calibrate the baseline goal average from the last 5 years of data
    resultsDB.forEach(m => {
        const h = parseFloat(m.home_score);
        const a = parseFloat(m.away_score);
        if (!isNaN(h) && !isNaN(a)) {
            totalGoals += (h + a);
            matchCount++;
        }
    });
    
    if (matchCount > 0) {
        globalAvg = (totalGoals / (matchCount * 2));
    }
    
    initDropdowns();
}

function initDropdowns() {
    const home = document.getElementById('homeTeam');
    const away = document.getElementById('awayTeam');
    const tourney = document.getElementById('tournament');
    const city = document.getElementById('city');

    const teams = [...new Set(eloDB.map(r => r.team))].filter(Boolean).sort();
    const tourneys = [...new Set(resultsDB.map(r => r.tournament))].filter(Boolean).sort();
    const cities = [...new Set(resultsDB.map(r => r.city))].filter(Boolean).sort();

    const fill = (el, data) => el.innerHTML = data.map(i => `<option value="${i}">${i}</option>`).join('');
    
    fill(home, teams); 
    fill(away, teams); 
    fill(tourney, tourneys); 
    fill(city, cities);
}

// --- MATH CORE ---
function factorial(n) { 
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

function poisson(k, lambda) { 
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k); 
}

// --- PREDICTION ENGINE ---
function predictMatch() {
    const teamA = document.getElementById('homeTeam').value;
    const teamB = document.getElementById('awayTeam').value;
    const selCity = document.getElementById('city').value;
    const selTourn = document.getElementById('tournament').value;
    const isNeutral = document.getElementById('isNeutral').checked;

    const eloA = eloDB.find(t => t.team === teamA);
    const eloB = eloDB.find(t => t.team === teamB);

    if (!eloA || !eloB) return;

    // 1. Base Elo Ratings
    const offA = parseFloat(eloA.offensive_elo || 1500);
    const defA = parseFloat(eloA.defensive_elo || 1500);
    const offB = parseFloat(eloB.offensive_elo || 1500);
    const defB = parseFloat(eloB.defensive_elo || 1500);

    /**
     * 2. POWER SCALING (Crucial for Accuracy)
     * We use a power of 8 to ensure that elite teams like Argentina 
     * are mathematically much more likely to blowout lower-tier teams.
     */
    let lambdaA = Math.pow(offA / defB, 8) * globalAvg;
    let lambdaB = Math.pow(offB / defA, 8) * globalAvg;

    // 3. Home Advantage / Neutral Factor
    if (!isNeutral) {
        // Apply Home/Away specific Elo adjustments from your CSV
        const homePerf = parseFloat(eloA.home_elo || 1500) / 1500;
        const awayPerf = parseFloat(eloB.away_elo || 1500) / 1500;
        
        lambdaA *= (homePerf * 1.12); // Standard 12% home-field goal boost
        lambdaB *= (awayPerf * 0.95); // Slight away-travel penalty
    }

    // 4. Historical Head-to-Head & Tournament Factors
    resultsDB.forEach(m => {
        // H2H: Did Team A beat Team B in their last meetings?
        if ((m.home_team === teamA && m.away_team === teamB) || (m.home_team === teamB && m.away_team === teamA)) {
            const teamAWon = (m.home_team === teamA && m.home_score > m.away_score) || 
                             (m.away_team === teamA && m.away_score > m.home_score);
            if (teamAWon) lambdaA *= 1.05; else lambdaB *= 1.05;
        }
        // City Factor: Does the team play well in this specific city?
        if (m.city === selCity && (m.home_team === teamA || m.away_team === teamA)) {
            const goalsScored = (m.home_team === teamA) ? m.home_score : m.away_score;
            if (goalsScored > 1) lambdaA *= 1.02;
        }
    });

    // 5. Run Poisson Distribution across all score possibilities
    let pWinA = 0, pDraw = 0, pWinB = 0;
    let maxProb = -1, finalH = 0, finalA = 0;

    // We check up to 10 goals to account for high-scoring dominance
    for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
            let prob = poisson(h, lambdaA) * poisson(a, lambdaB);
            
            if (h > a) pWinA += prob;
            else if (h === a) pDraw += prob;
            else pWinB += prob;

            if (prob > maxProb) {
                maxProb = prob;
                finalH = h;
                finalA = a;
            }
        }
    }

    // 6. Final UI Rendering
    renderResults(teamA, teamB, finalH, finalA, pWinA, pDraw, pWinB);
}

function renderResults(home, away, hScore, aScore, pA, pD, pB) {
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('matchHeading').innerText = `${home} vs ${away}`;
    document.getElementById('homeScore').innerText = hScore;
    document.getElementById('awayScore').innerText = aScore;

    const setProb = (id, val, barId) => {
        const pct = Math.min(100, (val * 100)).toFixed(1);
        document.getElementById(id).innerText = pct + "%";
        document.getElementById(barId).style.width = pct + "%";
    };

    setProb('homeWinP', pA, 'barHome');
    setProb('drawP', pD, 'barDraw');
    setProb('awayWinP', pB, 'barAway');
}
