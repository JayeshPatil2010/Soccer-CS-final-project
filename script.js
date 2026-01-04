/**
 * Predictor Pro Engine
 * Balanced Power Scaling & Normalized Probabilities
 */

const BASE_URL = 'https://raw.githubusercontent.com/JayeshPatil2010/Soccer-CS-final-project/main/';
const ELO_CSV_URL = BASE_URL + 'elos.csv';
const RESULTS_CSV_URL = BASE_URL + 'results.csv';

let eloDB = [];
let resultsDB = [];
let globalAvg = 1.35;

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

// --- RANDOMIZER ---
function randomizeMatch() {
    const selects = ['homeTeam', 'awayTeam', 'tournament', 'city'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        const options = el.options;
        if (options.length > 0) {
            el.selectedIndex = Math.floor(Math.random() * options.length);
        }
    });
    document.getElementById('isNeutral').checked = Math.random() > 0.5;
    predictMatch();
}

// --- MATH CORE ---
function factorial(n) {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

function poisson(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// --- PREDICTION ENGINE ---
function predictMatch() {
    const teamA = document.getElementById('homeTeam').value;
    const teamB = document.getElementById('awayTeam').value;
    const isNeutral = document.getElementById('isNeutral').checked;

    const eloA = eloDB.find(t => t.team === teamA);
    const eloB = eloDB.find(t => t.team === teamB);

    if (!eloA || !eloB) return;

    // Balanced Scaling: Power of 3.5 favors the strong without exploding scores
    let lambdaA = Math.pow(parseFloat(eloA.offensive_elo) / parseFloat(eloB.defensive_elo), 3.5) * globalAvg;
    let lambdaB = Math.pow(parseFloat(eloB.offensive_elo) / parseFloat(eloA.defensive_elo), 3.5) * globalAvg;

    if (!isNeutral) {
        lambdaA *= (parseFloat(eloA.home_elo) / 1500) * 1.10;
        lambdaB *= (parseFloat(eloB.away_elo) / 1500) * 0.95;
    }

    // Historical H2H Boost
    resultsDB.forEach(m => {
        if ((m.home_team === teamA && m.away_team === teamB) || (m.home_team === teamB && m.away_team === teamA)) {
            const teamAWon = (m.home_team === teamA && m.home_score > m.away_score) || (m.away_team === teamA && m.away_score > m.home_score);
            if (teamAWon) lambdaA *= 1.03; else lambdaB *= 1.03;
        }
    });

    // Final Goal Caps to keep scores realistic
    lambdaA = Math.min(lambdaA, 4.0);
    lambdaB = Math.min(lambdaB, 4.0);

    let rawWinA = 0, rawDraw = 0, rawWinB = 0;
    let maxProb = -1, finalH = 0, finalA = 0;

    for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
            let prob = poisson(h, lambdaA) * poisson(a, lambdaB);
            if (h > a) rawWinA += prob;
            else if (h === a) rawDraw += prob;
            else rawWinB += prob;

            if (prob > maxProb) { maxProb = prob; finalH = h; finalA = a; }
        }
    }

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
