const BASE_URL = 'https://raw.githubusercontent.com/JayeshPatil2010/Soccer-CS-final-project/main/';
const ELO_CSV_URL = BASE_URL + 'elos.csv';
const RESULTS_CSV_URL = BASE_URL + 'results.csv';

let eloDB = [], resultsDB = [], globalAvg = 1.35;

window.addEventListener('DOMContentLoaded', loadAllData);

async function loadAllData() {
    Papa.parse(ELO_CSV_URL, {
        download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: (elo) => {
            eloDB = elo.data;
            Papa.parse(RESULTS_CSV_URL, {
                download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
                complete: (res) => {
                    resultsDB = res.data;
                    initDropdowns();
                }
            });
        }
    });
}

function initDropdowns() {
    const teams = [...new Set(eloDB.map(r => r.team))].filter(Boolean).sort();
    const tourneys = [...new Set(resultsDB.map(r => r.tournament))].filter(Boolean).sort();
    const cities = [...new Set(resultsDB.map(r => r.city))].filter(Boolean).sort();

    const fill = (id, data) => document.getElementById(id).innerHTML = data.map(i => `<option value="${i}">${i}</option>`).join('');
    fill('homeTeam', teams); fill('awayTeam', teams); fill('tournament', tourneys); fill('city', cities);
}

function randomizeMatch() {
    ['homeTeam', 'awayTeam', 'tournament', 'city'].forEach(id => {
        const sel = document.getElementById(id);
        sel.selectedIndex = Math.floor(Math.random() * sel.options.length);
    });
    document.getElementById('isNeutral').checked = Math.random() > 0.5;
    predictMatch();
}

function toggleDetails() {
    const content = document.getElementById('detailsContent');
    const icon = document.getElementById('toggleIcon');
    const isHidden = content.style.display === "none" || content.style.display === "";
    content.style.display = isHidden ? "block" : "none";
    icon.innerText = isHidden ? "▲" : "▼";
}

function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function poisson(k, λ) { return (Math.pow(λ, k) * Math.exp(-λ)) / factorial(k); }

function predictMatch() {
    const teamA = document.getElementById('homeTeam').value;
    const teamB = document.getElementById('awayTeam').value;
    const isNeutral = document.getElementById('isNeutral').checked;

    const eloA = eloDB.find(t => t.team === teamA);
    const eloB = eloDB.find(t => t.team === teamB);
    if (!eloA || !eloB) return;

    // 1. Calculate Lambda with Balanced Scaling
    let λA = Math.pow(eloA.offensive_elo / eloB.defensive_elo, 3.5) * globalAvg;
    let λB = Math.pow(eloB.offensive_elo / eloA.defensive_elo, 3.5) * globalAvg;

    if (!isNeutral) {
        λA *= (eloA.home_elo / 1500) * 1.10;
        λB *= (eloB.away_elo / 1500) * 0.95;
    }

    // 2. Historical Context
    let h2hMatches = 0;
    resultsDB.forEach(m => {
        if ((m.home_team === teamA && m.away_team === teamB) || (m.home_team === teamB && m.away_team === teamA)) {
            h2hMatches++;
            const aWon = (m.home_team === teamA && m.home_score > m.away_score) || (m.away_team === teamA && m.away_score > m.home_score);
            aWon ? λA *= 1.03 : λB *= 1.03;
        }
    });

    λA = Math.min(λA, 4.0); λB = Math.min(λB, 4.0);

    // 3. Simulating Scores
    let combos = [], pA = 0, pD = 0, pB = 0;
    for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
            let prob = poisson(h, λA) * poisson(a, λB);
            combos.push({ s: `${h} - ${a}`, p: prob });
            if (h > a) pA += prob; else if (h === a) pD += prob; else pB += prob;
        }
    }

    combos.sort((a, b) => b.p - a.p);
    const total = pA + pD + pB;

    // 4. Populate UI
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('matchHeading').innerText = `${teamA} vs ${teamB}`;
    const topScore = combos[0].s.split(' - ');
    document.getElementById('homeScore').innerText = topScore[0];
    document.getElementById('awayScore').innerText = topScore[1];

    const updateBar = (id, val, bar) => {
        const pct = ((val/total)*100).toFixed(1);
        document.getElementById(id).innerText = pct + "%";
        document.getElementById(bar).style.width = pct + "%";
    };
    updateBar('homeWinP', pA, 'barHome'); updateBar('drawP', pD, 'barDraw'); updateBar('awayWinP', pB, 'barAway');

    // Detailed Data
    document.getElementById('scoreBody').innerHTML = combos.slice(0, 5).map(c => `<tr><td>${c.s}</td><td>${((c.p/total)*100).toFixed(1)}%</td></tr>`).join('');
    document.getElementById('eloData').innerText = `${teamA} (${eloA.offensive_elo} Off) vs ${teamB} (${eloB.offensive_elo} Off)`;
    document.getElementById('lambdaData').innerText = `${teamA}: ${λA.toFixed(2)} goals / ${teamB}: ${λB.toFixed(2)} goals`;
    document.getElementById('historyData').innerText = `Adjusted by ${h2hMatches} historical matchups.`;
}
