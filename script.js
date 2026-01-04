let eloData = {};
let matchHistory = [];
let teams = [];
let tournaments = [];
let cities = [];

// INITIALIZE DATA
async function init() {
    // In a real competition, you'd fetch your CSVs here
    // For now, we simulate the data load to ensure logic works
    await loadCSVData();
    populateSelects();
}

// THE HEURISTIC ALGORITHM (From your Image 2)
function calculateHeuristics(teamA, teamB, currentTourn, currentCity, isNeutral) {
    let stats = { a: 0, b: 0, logs: [] };

    // 1. Head-to-Head (3pts per win)
    const h2h = matchHistory.filter(m => (m.h === teamA && m.a === teamB) || (m.h === teamB && m.a === teamA));
    h2h.forEach(m => {
        const winner = m.hs > m.as ? m.h : (m.as > m.hs ? m.a : null);
        if (winner === teamA) { stats.a += 3; } else if (winner === teamB) { stats.b += 3; }
    });
    stats.logs.push(`Head-to-head (3pts per win): ${stats.a} vs ${stats.b}`);

    // 2. Tournament History (2pts per win in same tournament)
    const tournH = matchHistory.filter(m => m.tournament === currentTourn);
    let tA = 0, tB = 0;
    tournH.forEach(m => {
        if (m.h === teamA && m.hs > m.as) tA += 2;
        if (m.a === teamA && m.as > m.hs) tA += 2;
        if (m.h === teamB && m.hs > m.as) tB += 2;
        if (m.a === teamB && m.as > m.hs) tB += 2;
    });
    stats.a += tA; stats.b += tB;
    stats.logs.push(`Tournament history (2pts per win): ${tA} vs ${tB}`);

    // 3. Home Advantage (Team A as home if not neutral)
    if (isNeutral === "no") {
        stats.a += 2; // Standard bonus
        stats.logs.push(`Home advantage (Team A): 2 vs 0`);
    } else {
        stats.logs.push(`Home advantage: 0 vs 0 (Neutral)`);
    }

    return stats;
}

// THE POISSON ENGINE
function runPoisson(teamA, teamB) {
    // Logic: ExpGoals = (OffenseA / DefenseB) * Weight
    const expA = (eloData[teamA].off / eloData[teamB].def) * 1.5;
    const expB = (eloData[teamB].off / eloData[teamA].def) * 1.2;

    const probabilities = [];
    for (let i = 0; i <= 5; i++) {
        for (let j = 0; j <= 5; j++) {
            const prob = (poissonProb(i, expA) * poissonProb(j, expB));
            probabilities.push({ s1: i, s2: j, p: prob });
        }
    }
    return { expA, expB, sorted: probabilities.sort((a, b) => b.p - a.p).slice(0, 5) };
}

function poissonProb(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

// SCREEN CONTROL
function executeFullAnalysis() {
    const tA = document.getElementById('teamA').value;
    const tB = document.getElementById('teamB').value;
    const tourn = document.getElementById('tournament').value;
    const city = document.getElementById('city').value;
    const neutral = document.getElementById('isNeutral').value;

    const heuristic = calculateHeuristics(tA, tB, tourn, city, neutral);
    const poisson = runPoisson(tA, tB);

    // Render results to UI
    document.getElementById('analysisOutput').style.display = 'block';
    const hList = document.getElementById('heuristicList');
    hList.innerHTML = heuristic.logs.map(l => `<li>${l}</li>`).join('');
    
    document.getElementById('heuristicTotal').innerHTML = `
        <strong>Historical Totals:</strong> ${tA} Score: ${heuristic.a} | ${tB} Score: ${heuristic.b}
    `;

    const sList = document.getElementById('scoreLines');
    sList.innerHTML = poisson.sorted.map(s => 
        `<li>${tA} ${s.s1} - ${s.s2} ${tB} (${(s.p * 100).toFixed(2)}%)</li>`
    ).join('');
}

// Navigation
function openModule(id) {
    document.getElementById('hubScreen').style.display = 'none';
    document.getElementById(id + 'Module').style.display = 'block';
}

function goHome() {
    location.reload(); // Simplest way to reset state
}

init();
