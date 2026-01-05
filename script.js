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
    const isHidden = content.style.display === "none" || content.style.display === "";
    content.style.display = isHidden ? "block" : "none";
    document.getElementById('toggleIcon').innerText = isHidden ? "▲" : "▼";
}

function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function poisson(k, λ) { return (Math.pow(λ, k) * Math.exp(-λ)) / factorial(k); }

function predictMatch() {
    const teamA = document.getElementById('homeTeam').value;
    const teamB = document.getElementById('awayTeam').value;
    const isNeutral = document.getElementById('isNeutral').checked;
    const selTourney = document.getElementById('tournament').value;
    const selCity = document.getElementById('city').value;

    const eloA = eloDB.find(t => t.team === teamA);
    const eloB = eloDB.find(t => t.team === teamB);
    if (!eloA || !eloB) return;

    // 1. Base Goal Expectancy (Offensive vs Defensive Elo)
    let λA = Math.pow(eloA.offensive_elo / eloB.defensive_elo, 3.5) * globalAvg;
    let λB = Math.pow(eloB.offensive_elo / eloA.defensive_elo, 3.5) * globalAvg;

    // 2. Venue Context (Home vs Away Elo)
    if (!isNeutral) {
        λA *= (eloA.home_elo / 1500); 
        λB *= (eloB.away_elo / 1500);
    }

    // 3. Historical Point System Logic
    let ptsA = 0, ptsB = 0, h2hGames = [];
    resultsDB.forEach(m => {
        const isH2H = (m.home_team === teamA && m.away_team === teamB) || (m.home_team === teamB && m.away_team === teamA);
        
        if (isH2H) {
            h2hGames.push(m);
            // H2H Win: +3 Points
            if (m.home_team === teamA && m.home_score > m.away_score) ptsA += 3;
            else if (m.away_team === teamA && m.away_score > m.home_score) ptsA += 3;
            else if (m.home_team === teamB && m.home_score > m.away_score) ptsB += 3;
            else if (m.away_team === teamB && m.away_score > m.home_score) ptsB += 3;
        }

        // City Win: +1 Point
        if (m.city === selCity) {
            if (m.home_team === teamA && m.home_score > m.away_score) ptsA += 1;
            if (m.home_team === teamB && m.home_score > m.away_score) ptsB += 1;
        }

        // Tournament Win: +1 Point (No boost for Friendlies)
        if (selTourney !== "Friendly" && m.tournament === selTourney) {
            if (m.home_team === teamA && m.home_score > m.away_score) ptsA += 1;
            if (m.home_team === teamB && m.home_score > m.away_score) ptsB += 1;
        }
    });

    // Apply Boost: Each point adds 1% to the lambda
    λA *= (1 + (ptsA / 100));
    λB *= (1 + (ptsB / 100));
    λA = Math.min(λA, 4.0); λB = Math.min(λB, 4.0);

    // 4. Probability Simulation
    let combos = [], pWinA = 0, pDraw = 0, pWinB = 0;
    for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
            let prob = poisson(h, λA) * poisson(a, λB);
            combos.push({ score: `${h}-${a}`, p: prob });
            if (h > a) pWinA += prob; else if (h === a) pDraw += prob; else pWinB += prob;
        }
    }
    combos.sort((x, y) => y.p - x.p);
    const total = pWinA + pDraw + pWinB;

    // 5. Update Interface
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('matchHeading').innerText = `${teamA} vs ${teamB}`;
    document.getElementById('homeScore').innerText = combos[0].score.split('-')[0];
    document.getElementById('awayScore').innerText = combos[0].score.split('-')[1];

    const renderProb = (id, val, bar) => {
        const pct = ((val/total)*100).toFixed(1);
        document.getElementById(id).innerText = pct + "%";
        document.getElementById(bar).style.width = pct + "%";
    };
    renderProb('homeWinP', pWinA, 'barHome'); renderProb('drawP', pDraw, 'barDraw'); renderProb('awayWinP', pWinB, 'barAway');

    // 6. Deep Dive Data Population
    document.getElementById('scoreBody').innerHTML = combos.slice(0, 5).map(c => 
        `<tr><td>${c.score}</td><td>${((c.p/total)*100).toFixed(1)}%</td></tr>`).join('');

    const h2hEl = document.getElementById('h2hList');
    h2hEl.innerHTML = h2hGames.length > 0 ? h2hGames.map(m => `
        <div class="h2h-item">
            <span style="width:75px">${m.date}</span>
            <span>${m.home_team} vs ${m.away_team}</span>
            <b>${m.home_score}-${m.away_score}</b>
        </div>`).join('') : "<p>None</p>";

    document.getElementById('eloDetails').innerHTML = `
        <br><b>${teamA}:</b> Off ${eloA.offensive_elo} | Def ${eloA.defensive_elo} | Home ${eloA.home_elo}
        <br><b>${teamB}:</b> Off ${eloB.offensive_elo} | Def ${eloB.defensive_elo} | Away ${eloB.away_elo}`;
    document.getElementById('pointsDetails').innerText = `${teamA}: +${ptsA} pts | ${teamB}: +${ptsB} pts (1pt = 1% boost)`;
    document.getElementById('lambdaDetails').innerText = `${teamA}: ${λA.toFixed(3)} | ${teamB}: ${λB.toFixed(3)}`;
}
