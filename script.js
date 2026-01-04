/**
 * International Soccer Predictor Logic
 * JayeshPatil2010/Soccer-CS-final-project
 */

const BASE_URL = 'https://raw.githubusercontent.com/JayeshPatil2010/Soccer-CS-final-project/main/';
const ELO_CSV_URL = BASE_URL + 'elos.csv';
const RESULTS_CSV_URL = BASE_URL + 'results.csv';

let eloDatabase = [];
let globalAvgGoals = 1.35; // Calibrated dynamically from results.csv

window.addEventListener('DOMContentLoaded', () => {
    loadProjectData();
});

async function loadProjectData() {
    // 1. Fetch Elo Ratings
    Papa.parse(ELO_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(eloResults) {
            eloDatabase = eloResults.data;
            populateTeamLists();
            
            // 2. Fetch Results for Poisson Calibration
            Papa.parse(RESULTS_CSV_URL, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(matchResults) {
                    calibratePoisson(matchResults.data);
                }
            });
        }
    });
}

function populateTeamLists() {
    const homeSelect = document.getElementById('homeTeam');
    const awaySelect = document.getElementById('awayTeam');
    const teams = [...new Set(eloDatabase.map(row => row.team))].filter(t => t).sort();
    
    const optionsHTML = teams.map(t => `<option value="${t}">${t}</option>`).join('');
    homeSelect.innerHTML = optionsHTML;
    awaySelect.innerHTML = optionsHTML;
}

function calibratePoisson(data) {
    if (!data.length) return;
    let totalGoals = 0;
    data.forEach(m => {
        totalGoals += (parseInt(m.home_score) || 0) + (parseInt(m.away_score) || 0);
    });
    // Avg goals per team per match
    globalAvgGoals = (totalGoals / (data.length * 2));
    console.log("Model Calibrated. Goal Average:", globalAvgGoals.toFixed(3));
}

// Math Utility
function factorial(n) {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function poisson(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Prediction Logic
function predictMatch() {
    const homeName = document.getElementById('homeTeam').value;
    const awayName = document.getElementById('awayTeam').value;
    
    const homeElo = eloDatabase.find(t => t.team === homeName);
    const awayElo = eloDatabase.find(t => t.team === awayName);

    if (!homeElo || !awayElo) return;

    // λ (Lambda) calculation based on offensive/defensive Elo ratios
    let lambdaHome = (parseFloat(homeElo.offensive_elo) / parseFloat(awayElo.defensive_elo)) * globalAvgGoals;
    let lambdaAway = (parseFloat(awayElo.offensive_elo) / parseFloat(homeElo.defensive_elo)) * globalAvgGoals;

    // Standard Home Advantage Multiplier
    lambdaHome *= 1.10;

    // Find Mode (Most Likely Score)
    let maxP = 0, predH = 0, predA = 0;
    for (let h = 0; h <= 6; h++) {
        for (let a = 0; a <= 6; a++) {
            let p = poisson(h, lambdaHome) * poisson(a, lambdaAway);
            if (p > maxP) {
                maxP = p; predH = h; predA = a;
            }
        }
    }

    // Win Probability
    let winProb = 0;
    for (let h = 1; h <= 10; h++) {
        for (let a = 0; a < h; a++) {
            winProb += poisson(h, lambdaHome) * poisson(a, lambdaAway);
        }
    }

    renderResults(homeName, awayName, predH, predA, winProb);
}

function renderResults(home, away, hScore, aScore, prob) {
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('matchHeading').innerText = `${home} vs ${away}`;
    document.getElementById('homeScore').innerText = hScore;
    document.getElementById('awayScore').innerText = aScore;
    
    const percent = (prob * 100).toFixed(1);
    document.getElementById('winProb').innerText = `${percent}%`;
    document.getElementById('probBar').style.width = `${percent}%`;
}
