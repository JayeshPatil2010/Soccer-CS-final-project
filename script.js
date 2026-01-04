/**
 * International Soccer Predictor Pro - Fixed Data Integration
 */

const BASE_URL = 'https://raw.githubusercontent.com/JayeshPatil2010/Soccer-CS-final-project/main/';
const ELO_CSV_URL = BASE_URL + 'elos.csv';
const RESULTS_CSV_URL = BASE_URL + 'results.csv';

let eloDB = [];
let resultsDB = [];
let globalAvg = 1.35; // Calibrated baseline

window.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});

async function loadAllData() {
    // 1. Load ELOs
    Papa.parse(ELO_CSV_URL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (eloResults) => {
            eloDB = eloResults.data;
            
            // 2. Load Results
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
    // Calculate global average goals for the Poisson baseline
    let totalGoals = 0;
    let matchCount = 0;
    
    resultsDB.forEach(m => {
        const h = parseFloat(m.home_score);
        const a = parseFloat(m.away_score);
        if (!isNaN(h) && !isNaN(a)) {
            totalGoals += (h + a);
            matchCount++;
        }
    });
    
    if (matchCount > 0) globalAvg = (totalGoals / (matchCount * 2));
    
    initDropdowns();
}

function initDropdowns() {
    const home = document.getElementById('homeTeam');
    const away = document.getElementById('awayTeam');
    const tourney = document.getElementById('tournament');
    const city = document.getElementById('city');

    // Clean data and get unique values
    const teams = [...new Set(eloDB.map(r => r.team))].filter(Boolean).sort();
    const tourneys = [...new Set(resultsDB.map(r => r.tournament))].filter(Boolean).sort();
    const cities = [...new Set(resultsDB.map(r => r.city))].filter(Boolean).sort();

    const fill = (el, data) => el.innerHTML = data.map(i => `<option value="${i}">${i}</option>`).join('');
    
    fill(home, teams); 
    fill(away, teams); 
    fill(tourney, tourneys); 
    fill(city, cities);
}

// Math core
function factorial(n) { return (n <= 1) ? 1 : n * factorial(n - 1); }
function poisson(k, lambda) { return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k); }

function predictMatch() {
    const teamA = document.getElementById('homeTeam').value;
    const teamB = document.getElementById('awayTeam').value;
    const selCity = document.getElementById('city').value;
    const selTourn = document.getElementById('tournament').value;
    const isNeutral = document.getElementById('isNeutral').checked;

    const eloA = eloDB.find(t => t.team === teamA);
    const eloB = eloDB.find(t => t.team === teamB);

    if (!eloA || !eloB) {
        console.error("Team data missing for:", teamA, "or", teamB);
        return;
    }

    // --- ACCURACY LOGIC ---
    // Extracting values safely (handling possible column name differences)
    const offA = parseFloat(eloA.offensive_elo || eloA['offensive_elo'] || 1500);
    const defB = parseFloat(eloB.defensive_elo || eloB['defensive_elo'] || 1500);
    const offB = parseFloat(eloB.offensive_elo || eloB['offensive_elo'] || 1500);
    const defA = parseFloat(eloA.defensive_elo || eloA['defensive_elo'] || 1500);

    // 1. Initial Lambda based on Attacking vs Defending Elo ratios
    let lambdaA = (offA / defB) * globalAvg;
    let lambdaB = (offB / defA) * globalAvg;

    // 2. Home Advantage / Neutral Grounds
    if (!isNeutral) {
        // Use home_elo and away_elo relative to average (1500)
        const homePower = parseFloat(eloA.home_elo || 1500) / 1500;
        const awayPower = parseFloat(eloB.away_elo || 1500) / 1500;
        lambdaA *= (homePower * 1.10); // Standard 10% home boost
        lambdaB *= awayPower;
    }

    // 3. Historical Data Adjustments (H2H and Performance Trends)
    resultsDB.forEach(m => {
        // Head-to-Head History
        if ((m.home_team === teamA && m.away_team === teamB) || (m.home_team === teamB && m.away_team === teamA)) {
            const isAHome = m.home_team === teamA;
            const diff = m.home_score - m.away_score;
            if (diff > 0) isAHome ? lambdaA *= 1.05 : lambdaB *= 1.05;
            if (diff < 0) isAHome ? lambdaB *= 1.05 : lambdaA *= 1.05;
        }
        // City Familiarity
        if (m.city === selCity) {
            if (m.home_team === teamA || m.away_team === teamA) lambdaA *= 1.02;
            if (m.home_team === teamB || m.away_team === teamB) lambdaB *= 1.02;
        }
    });

    // 4. Run Poisson Simulation
    let pWinA = 0, pDraw = 0, pWinB = 0;
    let maxP = -1, finalH = 0, finalA = 0;

    for (let h = 0; h <= 9; h++) {
        for (let a = 0; a <= 9; a++) {
            let prob = poisson(h, lambdaA) * poisson(a, lambdaB);
            
            if (h > a) pWinA += prob;
            else if (h === a) pDraw += prob;
            else pWinB += prob;

            if (prob > maxP) {
                maxP = prob;
                finalH = h;
                finalA = a;
            }
        }
    }

    // 5. Update UI
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
