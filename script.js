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
    
    const fill = (id, data) => {
        const el = document.getElementById(id);
        el.innerHTML = data.map(i => `<option value="${i}">${i}</option>`).join('');
    };
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

    // 1. BASE CALCULATION
    let baseλA = Math.pow(eloA.offensive_elo / eloB.defensive_elo, 3.5) * globalAvg;
    let baseλB = Math.pow(eloB.offensive_elo / eloA.defensive_elo, 3.5) * globalAvg;

    // 2. VENUE WEIGHTING (Home Advantage Floor Logic)
    let venueModA = 1.0, venueModB = 1.0;
    let homeWeightFormula = "";
    let awayWeightFormula = "";

    if (!isNeutral) {
        // Standard Home Advantage (Baseline + 50 points)
        venueModA = (eloA.home_elo + 50) / 1500; 
        
        // Away advantage is capped at Home Advantage (Home is always >= Away)
        let rawAwayMod = eloB.away_elo / 1500;
        venueModB = Math.min(rawAwayMod, venueModA);

        homeWeightFormula = `(${eloA.home_elo} HomeElo + 50) / 1500`;
        awayWeightFormula = rawAwayMod > venueModA 
            ? `Capped at Home Weight (${venueModA.toFixed(3)})` 
            : `${eloB.away_elo} AwayElo / 1500`;
    } else {
        homeWeightFormula = "Neutral (1.000)";
        awayWeightFormula = "Neutral (1.000)";
    }

    // 3. HISTORICAL POINT SWING
    let h2hPtsA = 0, h2hPtsB = 0, h2hGames = [];
    let cityPtsA = 0, cityPtsB = 0;
    let tourneyPtsA = 0, tourneyPtsB = 0;

    resultsDB.forEach(m => {
        const isH2H = (m.home_team === teamA && m.away_team === teamB) || (m.home_team === teamB && m.away_team === teamA);
        if (isH2H) {
            h2hGames.push(m);
            if (m.home_team === teamA && m.home_score > m.away_score) h2hPtsA += 3;
            else if (m.away_team === teamA && m.away_score > m.home_score) h2hPtsA += 3;
            else if (m.home_team === teamB && m.home_score > m.away_score) h2hPtsB += 3;
            else if (m.away_team === teamB && m.away_score > m.home_score) h2hPtsB += 3;
        }
        if (m.city === selCity) {
            if (m.home_team === teamA && m.home_score > m.away_score) cityPtsA += 1;
            if (m.home_team === teamB && m.home_score > m.away_score) cityPtsB += 1;
        }
        if (selTourney !== "Friendly" && m.tournament === selTourney) {
            if (m.home_team === teamA && m.home_score > m.away_score) tourneyPtsA += 1;
            if (m.home_team === teamB && m.home_score > m.away_score) tourneyPtsB += 1;
        }
    });

    const totalPtsA = h2hPtsA + cityPtsA + tourneyPtsA;
    const totalPtsB = h2hPtsB + cityPtsB + tourneyPtsB;

    let λA = baseλA * venueModA * (1 + (totalPtsA / 100));
    let λB = baseλB * venueModB * (1 + (totalPtsB / 100));

    // 4. SIMULATION
    let combos = [], pA = 0, pD = 0, pB = 0;
    for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
            let prob = poisson(h, λA) * poisson(a, λB);
            combos.push({ s: `${h}-${a}`, p: prob });
            if (h > a) pA += prob; else if (h === a) pD += prob; else pB += prob;
        }
    }
    combos.sort((x, y) => y.p - x.p);
    const total = pA + pD + pB;

    // 5. UPDATE UI
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('matchHeading').innerText = `${teamA} vs ${teamB}`;
    document.getElementById('homeScore').innerText = combos[0].s.split('-')[0];
    document.getElementById('awayScore').innerText = combos[0].s.split('-')[1];

    const setProb = (id, val, barId) => {
        const pct = ((val/total)*100).toFixed(1);
        document.getElementById(id).innerText = pct + "%";
        document.getElementById(barId).style.width = pct + "%";
    };
    setProb('homeWinP', pA, 'barHome'); setProb('drawP', pD, 'barDraw'); setProb('awayWinP', pB, 'barAway');

    document.getElementById('scoreBody').innerHTML = combos.slice(0, 5).map(c => 
        `<tr><td>${c.s}</td><td>${((c.p/total)*100).toFixed(1)}%</td></tr>`).join('');

    document.getElementById('h2hList').innerHTML = h2hGames.length > 0 ? h2hGames.map(m => `
        <div class="h2h-item"><span>${m.date}</span><span>${m.home_team} vs ${m.away_team}</span><b>${m.home_score}-${m.away_score}</b></div>`).join('') : "None";

    document.getElementById('pointsBreakdown').innerHTML = `
        <li><b>H2H Record:</b> ${teamA} (+${h2hPtsA} pts) | ${teamB} (+${h2hPtsB} pts)</li>
        <li><b>City Advantage:</b> ${teamA} (+${cityPtsA} pts) | ${teamB} (+${cityPtsB} pts)</li>
        <li><b>Tournament History:</b> ${teamA} (+${tourneyPtsA} pts) | ${teamB} (+${tourneyPtsB} pts)</li>
    `;

    document.getElementById('mathBreakdown').innerText = `
${teamA} λ CALCULATION:
Base: (${eloA.offensive_elo} Off / ${eloB.defensive_elo} Def)^3.5 * 1.35 = ${baseλA.toFixed(3)}
Venue Weight: ${homeWeightFormula} = ${venueModA.toFixed(3)}
Total λ: ${baseλA.toFixed(3)} * Venue(${venueModA.toFixed(3)}) * Hist(${(1+totalPtsA/100).toFixed(2)}) = ${λA.toFixed(3)} goals

${teamB} λ CALCULATION:
Base: (${eloB.offensive_elo} Off / ${eloA.defensive_elo} Def)^3.5 * 1.35 = ${baseλB.toFixed(3)}
Venue Weight: ${awayWeightFormula} = ${venueModB.toFixed(3)}
Total λ: ${baseλB.toFixed(3)} * Venue(${venueModB.toFixed(3)}) * Hist(${(1+totalPtsB/100).toFixed(2)}) = ${λB.toFixed(3)} goals`;
}
