let matches = [];
let eloMap = new Map();

// Initialize on load
window.onload = function() {
    logDebug("WINDOW LOADED. STARTING FETCH...");
    autoLoadData();
};

async function autoLoadData() {
    try {
        // 1. Fetching files from the SAME folder as index.html
        // We use {cache: "no-store"} to prevent the "old code" issue from earlier
        const resultsRes = await fetch('./results.csv', { cache: "no-store" });
        const eloRes = await fetch('./elos.csv', { cache: "no-store" });

        if (!resultsRes.ok) throw new Error(`results.csv not found (Status: ${resultsRes.status})`);
        if (!eloRes.ok) throw new Error(`elos.csv not found (Status: ${eloRes.status})`);

        const resultsText = await resultsRes.text();
        const eloText = await eloRes.text();

        // 2. Parse Results
        matches = parseCSVText(resultsText);
        logDebug(`PARSED ${matches.length} MATCH ROWS`);
        
        // 3. Parse Elos
        const eloData = parseCSVText(eloText);
        eloMap.clear();
        eloData.forEach((row, index) => {
            if (row.length >= 4) {
                const team = row[0].trim().toLowerCase();
                eloMap.set(team, {
                    name: row[0].trim(),
                    overall: parseFloat(row[1]) || 1500,
                    off: parseFloat(row[2]) || 1500,
                    def: parseFloat(row[3]) || 1500,
                    home: parseFloat(row[4]) || 1500,
                    away: parseFloat(row[5]) || 1500
                });
            }
        });

        if (eloMap.size === 0) throw new Error("Elo file parsed but no teams found.");

        // 4. Update UI
        populateDropdowns();
        
        const statusEl = document.getElementById('loadStatus');
        statusEl.innerText = "System Ready";
        statusEl.className = "text-[10px] font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full uppercase tracking-widest";
        
        document.getElementById('setupSection').classList.remove('opacity-30', 'pointer-events-none');
        logDebug(`ENGINE ONLINE: ${eloMap.size} TEAMS LOADED`);

    } catch (err) {
        // This will print the exact reason it's stuck to your Engine Console
        logDebug("CRITICAL ERROR: " + err.message, true);
        const statusEl = document.getElementById('loadStatus');
        statusEl.innerText = "Load Failed";
        statusEl.className = "text-[10px] font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full uppercase tracking-widest";
        console.error(err);
    }
}

function parseCSVText(text) {
    // Splits lines and removes empty ones, then splits by comma
    return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
        return line.split(',').map(c => c.replace(/"/g, '').trim());
    });
}

function populateDropdowns() {
    const teams = new Set();
    const tours = new Set();
    
    matches.forEach(m => {
        if(m[1]) teams.add(m[1]);
        if(m[2]) teams.add(m[2]);
        if(m[5]) tours.add(m[5]);
    });
    
    const teamList = Array.from(teams).sort();
    const tourList = Array.from(tours).sort();

    fillDropdown('teamA', teamList);
    fillDropdown('teamB', teamList);
    fillDropdown('tournament', tourList);
}

function fillDropdown(id, list) {
    const el = document.getElementById(id);
    el.innerHTML = list.map(i => `<option value="${i}">${i}</option>`).join('');
}

function logDebug(msg, isError = false) {
    const el = document.getElementById('debug');
    if (!el) return;
    const color = isError ? "#ff453a" : "#32d74b";
    el.innerHTML += `<br><span style="color: ${color}">> ${msg}</span>`;
    el.scrollTop = el.scrollHeight;
}

// Math logic
function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function poisson(k, lambda) { return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k); }

function generatePrediction() {
    const tA = document.getElementById('teamA').value;
    const tB = document.getElementById('teamB').value;
    const tourney = document.getElementById('tournament').value;
    const isNeutral = document.getElementById('neutral').checked;

    const eA = eloMap.get(tA.toLowerCase()) || { off: 1500, def: 1500, home: 1500, away: 1500, overall: 1500 };
    const eB = eloMap.get(tB.toLowerCase()) || { off: 1500, def: 1500, home: 1500, away: 1500, overall: 1500 };

    logDebug(`CALC: ${tA} vs ${tB}`);

    const baseXG = 1.2;
    let hA = 1.0, hB = 1.0;
    if (!isNeutral) {
        hA += (eA.home - eA.overall) * 0.0015;
        hB += (eB.away - eB.overall) * 0.0015;
    }

    const lambdaA = Math.max(0.01, baseXG * Math.pow(10, (eA.off - eB.def) / 400) * hA);
    const lambdaB = Math.max(0.01, baseXG * Math.pow(10, (eB.off - eA.def) / 400) * hB);

    let scores = [];
    let winA = 0, winB = 0;
    for (let a = 0; a <= 7; a++) {
        for (let b = 0; b <= 7; b++) {
            const prob = poisson(a, lambdaA) * poisson(b, lambdaB);
            scores.push({ s: `${a} - ${b}`, p: prob });
            if (a > b) winA += prob; else if (b > a) winB += prob;
        }
    }
    scores.sort((x, y) => y.p - x.p);

    document.getElementById('welcomeState').classList.add('hidden');
    document.getElementById('resultState').classList.remove('hidden');
    document.getElementById('finalPickText').innerText = lambdaA > lambdaB ? tA : tB;
    
    document.getElementById('scorelineOutput').innerHTML = scores.slice(0, 5).map(s => 
        `<div class="flex justify-between p-3 bg-[#f5f5f7] rounded-2xl font-bold text-gray-700">
            <span>${s.s}</span>
            <span class="text-blue-600">${(s.p * 100).toFixed(1)}%</span>
        </div>`).join('');

    document.getElementById('historicalOutput').innerHTML = `
        <p>H2H Comparison: ${tA} vs ${tB}</p>
        <p>Target Tournament: ${tourney}</p>
        <p>Lambda A: ${lambdaA.toFixed(2)} | Lambda B: ${lambdaB.toFixed(2)}</p>
    `;
}
