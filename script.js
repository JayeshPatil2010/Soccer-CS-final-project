/**
 * International Soccer Predictor Pro
 * Source: JayeshPatil2010/Soccer-CS-final-project
 */

const BASE_URL = 'https://raw.githubusercontent.com/JayeshPatil2010/Soccer-CS-final-project/main/';
const ELO_CSV_URL = BASE_URL + 'elos.csv';
const RESULTS_CSV_URL = BASE_URL + 'results.csv';

let eloDB = [];
let resultsDB = [];
let globalAvg = 1.35; // Calibrated dynamically

// Initial Load
window.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});

async function loadAllData() {
    Papa.parse(ELO_CSV_URL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (eloResults) => {
            eloDB = eloResults.data;
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

    const teams = [...new Set(eloDB.map(r => r.team))].filter(Boolean).sort();
    const tourneys = [...new Set(resultsDB.map(r => r.tournament))].filter(Boolean).sort();
    const cities = [...new Set(resultsDB.map(r => r.city))].filter(Boolean).sort();

    const fill = (el, data) => el.innerHTML = data.map(i => `<option value="${i}">${i}</option>`).join('');
    fill(home, teams); fill(away, teams); fill(tourney, tourneys); fill(city, cities);
}

// Math core
function factorial(n) {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

function poisson(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Randomizer
function randomizeMatch() {
    const selects = ['homeTeam', 'awayTeam', 'tournament', 'city'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        const items = el.getElementsByTagName('option');
        el.selectedIndex = Math.floor(Math.random() * items.length);
    });
    document.getElementById('isNeutral').checked = Math.random() > 0.5;
    predictMatch();
}

// Prediction Logic
function predictMatch() {
    const teamA = document.getElementById('homeTeam').value;
    const teamB = document.getElementById('awayTeam').value;
    const selCity = document.getElementById('city').value;
    const isNeutral = document.getElementById('isNeutral').checked;

    const eloA = eloDB.find(t => t.team === teamA);
    const eloB = eloDB.find(t => t.team === teamB);

    if (!eloA || !eloB) return;

    // Power Scaling: Ratio raised to power of 8 to increase gap between favorites and underdogs
    let lambdaA = Math.pow(parseFloat(eloA.offensive_elo) / parseFloat(eloB.defensive_elo), 8) * globalAvg;
    let lambdaB = Math.pow(parseFloat(eloB.offensive_elo) / parseFloat(eloA.defensive_elo), 8) * globalAvg;

    if (!isNeutral) {
        // Adjust based on specific home/away elo performance
        lambdaA *= (parseFloat(eloA.home_elo) / 1500) * 1.12; // 12% Home Boost
        lambdaB *= (parseFloat(eloB.away_elo) / 1500) * 0.95; // Travel penalty
    }

    // Adjust based on Head-to-Head History in results.csv
    resultsDB.forEach(m => {
        if ((m.home_team === teamA && m.away_team === teamB) || (m.home_team === teamB && m.away_team === teamA)) {
            const teamAWon = (m.home_team === teamA && m.home_score > m.away_score) || (m.away_team === teamA && m.away_score > m.home_score);
            if (teamAWon) lambdaA *= 1.05; else lambdaB *= 1.05;
        }
    });

    let rawWinA = 0, rawDraw = 0, rawWinB = 0;
    let maxProb = -1, finalH = 0, finalA = 0;

    // Simulate scorelines up to 12 goals
    for (let h = 0; h <= 12; h++) {
        for (let a = 0; a <= 12; a++) {
            let prob = poisson(h, lambdaA) * poisson(a, lambdaB);
            if (h > a) rawWinA += prob;
            else if (h === a) rawDraw += prob;
            else rawWinB += prob;

            if (prob > maxProb) { maxProb = prob; finalH = h; finalA = a; }
        }
    }

    // Normalization logic: Stretch percentages to total 100%
    const total = rawWinA + rawDraw + rawWinB;
    renderResults(teamA, teamB, finalH, finalA, rawWinA/total, rawDraw/total, rawWinB/total);
}

function renderResults(home, away, hScore, aScore, pA, pD, pB) {
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('matchHeading').innerText = `${home} vs ${away}`;
    document.getElementById('homeScore').innerText = hScore;
    document.getElementById('awayScore').innerText = aScore;

    const setProb = (id, val, barId) => {
        const pct = (val * 100).toFixed(1);
        document.getElementById(id).innerText = pct + "%";
        document.getElementById(barId).style.width = pct + "%";
    };

    setProb('homeWinP', pA, 'barHome');
    setProb('drawP', pD, 'barDraw');
    setProb('awayWinP', pB, 'barAway');
}
