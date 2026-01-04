const BASE_URL = 'https://raw.githubusercontent.com/JayeshPatil2010/Soccer-CS-final-project/main/';
const ELO_CSV_URL = BASE_URL + 'elos.csv';
const RESULTS_CSV_URL = BASE_URL + 'results.csv';

let eloDB = [];
let resultsDB = [];
let globalAvg = 1.35;

window.addEventListener('DOMContentLoaded', () => {
    Papa.parse(ELO_CSV_URL, {
        download: true, header: true, skipEmptyLines: true,
        complete: (e) => {
            eloDB = e.data;
            Papa.parse(RESULTS_CSV_URL, {
                download: true, header: true, skipEmptyLines: true,
                complete: (r) => {
                    resultsDB = r.data;
                    initDropdowns();
                }
            });
        }
    });
});

function initDropdowns() {
    const home = document.getElementById('homeTeam');
    const away = document.getElementById('awayTeam');
    const tourney = document.getElementById('tournament');
    const city = document.getElementById('city');

    const teams = [...new Set(eloDB.map(r => r.team))].sort();
    const tourneys = [...new Set(resultsDB.map(r => r.tournament))].sort();
    const cities = [...new Set(resultsDB.map(r => r.city))].sort();

    const fill = (el, data) => el.innerHTML = data.map(i => `<option value="${i}">${i}</option>`).join('');
    fill(home, teams); fill(away, teams); fill(tourney, tourneys); fill(city, cities);
}

function factorial(n) { return (n <= 1) ? 1 : n * factorial(n - 1); }
function poisson(k, λ) { return (Math.pow(λ, k) * Math.exp(-λ)) / factorial(k); }

function predictMatch() {
    const teamA = document.getElementById('homeTeam').value;
    const teamB = document.getElementById('awayTeam').value;
    const selCity = document.getElementById('city').value;
    const selTourn = document.getElementById('tournament').value;
    const isNeutral = document.getElementById('isNeutral').checked;

    const eloA = eloDB.find(t => t.team === teamA);
    const eloB = eloDB.find(t => t.team === teamB);

    // 1. Base Lambda from Elos
    let λA = (parseFloat(eloA.offensive_elo) / parseFloat(eloB.defensive_elo)) * globalAvg;
    let λB = (parseFloat(eloB.offensive_elo) / parseFloat(eloA.defensive_elo)) * globalAvg;

    // 2. Adjust for Neutral vs Home/Away specific Elos
    if (!isNeutral) {
        λA *= (parseFloat(eloA.home_elo) / 1500); 
        λB *= (parseFloat(eloB.away_elo) / 1500);
        λA *= 1.15; // Natural Home Advantage
    }

    // 3. Historical Factors from results.csv
    resultsDB.forEach(m => {
        // Head to Head
        if ((m.home_team === teamA && m.away_team === teamB)) {
            if (parseInt(m.home_score) > parseInt(m.away_score)) λA *= 1.02;
        }
        // City factor
        if (m.city === selCity) {
            if (m.home_team === teamA || m.away_team === teamA) λA *= 1.01;
        }
        // Tournament factor
        if (m.tournament === selTourn) {
            if (m.home_team === teamA) λA *= 1.01;
        }
    });

    // 4. Calculate Probabilities
    let pWinA = 0, pDraw = 0, pWinB = 0;
    let maxP = 0, finalH = 0, finalA = 0;

    for (let h = 0; h <= 8; h++) {
        for (let a = 0; a <= 8; a++) {
            let p = poisson(h, λA) * poisson(a, λB);
            if (h > a) pWinA += p;
            else if (h === a) pDraw += p;
            else pWinB += p;

            if (p > maxP) { maxP = p; finalH = h; finalA = a; }
        }
    }

    // 5. Update UI
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('matchHeading').innerText = `${teamA} vs ${teamB}`;
    document.getElementById('homeScore').innerText = finalH;
    document.getElementById('awayScore').innerText = finalA;

    const updateBar = (id, val, barId) => {
        const pct = (val * 100).toFixed(1);
        document.getElementById(id).innerText = pct + "%";
        document.getElementById(barId).style.width = pct + "%";
    }

    updateBar('homeWinP', pWinA, 'barHome');
    updateBar('drawP', pDraw, 'barDraw');
    updateBar('awayWinP', pWinB, 'barAway');
}
