let TEAMS = {};
let HISTORY = [];

// 1. DATA BOOTSTRAPPING
async function initialize() {
    try {
        const [eloCSV, resultsCSV] = await Promise.all([
            fetch('elos.csv').then(r => r.text()),
            fetch('results.csv').then(r => r.text())
        ]);
        
        parseElo(eloCSV);
        parseResults(resultsCSV);
        populateMenus();
    } catch (err) {
        console.error("Data Load Error. Ensure elos.csv and results.csv are present.");
    }
}

function parseElo(data) {
    data.split('\n').slice(1).forEach(row => {
        const c = row.split(',');
        if (c.length < 6) return;
        TEAMS[c[0].trim()] = {
            overall: +c[1], off: +c[2], def: +c[3], home: +c[4], away: +c[5]
        };
    });
}

function parseResults(data) {
    data.split('\n').slice(1).forEach(row => {
        const c = row.split(',');
        if (c.length < 7) return;
        HISTORY.push({ h: c[1], a: c[2], hs: +c[3], as: +c[4], tourn: c[5], city: c[6] });
    });
}

function populateMenus() {
    const teamNames = Object.keys(TEAMS).sort();
    const tourns = [...new Set(HISTORY.map(m => m.tourn))].sort();
    const cities = [...new Set(HISTORY.map(m => m.city))].sort();

    const tA = document.getElementById('teamASelect');
    const tB = document.getElementById('teamBSelect');
    const trn = document.getElementById('tournamentSelect');
    const cty = document.getElementById('citySelect');

    teamNames.forEach(n => { tA.add(new Option(n, n)); tB.add(new Option(n, n)); });
    tourns.forEach(t => trn.add(new Option(t, t)));
    cities.forEach(c => cty.add(new Option(c, c)));
}

// 2. HEURISTIC & POISSON LOGIC (From Image 2)
function startAnalysis() {
    const tA = document.getElementById('teamASelect').value;
    const tB = document.getElementById('teamBSelect').value;
    const tourn = document.getElementById('tournamentSelect').value;
    const city = document.getElementById('citySelect').value;
    const neutral = document.getElementById('isNeutralSelect').value;

    let ptsA = 0, ptsB = 0;
    let logHTML = "";

    // A. H2H (3pts per win)
    const matches = HISTORY.filter(m => (m.h === tA && m.a === tB) || (m.h === tB && m.a === tA));
    let winA = 0, winB = 0;
    matches.forEach(m => {
        const winner = m.hs > m.as ? m.h : (m.as > m.hs ? m.a : null);
        if (winner === tA) winA++; if (winner === tB) winB++;
    });
    ptsA += (winA * 3); ptsB += (winB * 3);
    logHTML += `Head-to-head (3pts per historical win) : ${winA*3} vs ${winB*3}<br>`;

    // B. Tournament History (2pts)
    const trnWinsA = HISTORY.filter(m => m.tourn === tourn && ((m.h === tA && m.hs > m.as) || (m.a === tA && m.as > m.hs))).length;
    const trnWinsB = HISTORY.filter(m => m.tourn === tourn && ((m.h === tB && m.hs > m.as) || (m.a === tB && m.as > m.hs))).length;
    ptsA += (trnWinsA * 2); ptsB += (trnWinsB * 2);
    logHTML += `Tournament history (2pts per win in ${tourn}) : ${trnWinsA*2} vs ${trnWinsB*2}<br>`;

    // C. City Influence (1pt)
    const ctyWinsA = HISTORY.filter(m => m.city === city && ((m.h === tA && m.hs > m.as) || (m.a === tA && m.as > m.hs))).length;
    const ctyWinsB = HISTORY.filter(m => m.city === city && ((m.h === tB && m.hs > m.as) || (m.a === tB && m.as > m.hs))).length;
    ptsA += ctyWinsA; ptsB += ctyWinsB;
    logHTML += `City influence (1pt per win in ${city}) : ${ctyWinsA} vs ${ctyWinsB}<br>`;

    // D. Home Advantage
    if (neutral === "No") { ptsA += 2; logHTML += `Home advantage (Team A as home) : 2 vs 0<br>`; }

    // E. Poisson Simulation
    const eloA = TEAMS[tA], eloB = TEAMS[tB];
    const expA = (eloA.off / eloB.def) * 1.25;
    const expB = (eloB.off / eloA.def) * 1.10;

    // Render Results
    document.getElementById('analysisOutput').style.opacity = 1;
    document.getElementById('heuristicLog').innerHTML = logHTML;
    document.getElementById('heuristicTotals').innerHTML = `${tA} score: ${ptsA} | ${tB} score: ${ptsB}`;
    
    // Final Pick
    const winner = ptsA > ptsB ? tA : (ptsB > ptsA ? tB : "DRAW / TOO CLOSE");
    document.getElementById('finalVerdict').innerText = `FINAL PICK: ${winner}`;
}

// 3. UI CONTROLS
function openModule(type) {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById(type + '-screen').style.display = 'block';
}

function exitToHub() {
    document.getElementById('home-screen').style.display = 'flex';
    document.getElementById('predictor-screen').style.display = 'none';
    document.getElementById('simulator-screen').style.display = 'none';
}

initialize();
