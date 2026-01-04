let matches = [];
let eloMap = new Map();

function logDebug(msg, isError = false) {
    const el = document.getElementById('debug');
    const color = isError ? "#ff453a" : "#32d74b";
    el.innerHTML += `<br><span style="color: ${color}">> ${msg}</span>`;
    el.scrollTop = el.scrollHeight;
}

async function processFiles() {
    const mFile = document.getElementById('matchFile').files[0];
    const eFile = document.getElementById('eloFile').files[0];
    
    if (!mFile || !eFile) {
        logDebug("MISSING FILES", true);
        return;
    }

    try {
        matches = await parseCSV(mFile);
        const eloData = await parseCSV(eFile);

        eloMap.clear();
        eloData.forEach(row => {
            if (row.length >= 4) {
                const team = row[0].trim().toLowerCase();
                eloMap.set(team, {
                    off: parseFloat(row[2]) || 1500,
                    def: parseFloat(row[3]) || 1500,
                    home: parseFloat(row[4]) || 1500,
                    away: parseFloat(row[5]) || 1500,
                    overall: parseFloat(row[1]) || 1500
                });
            }
        });

        logDebug(`MAPPING COMPLETE: ${eloMap.size} TEAMS`);
        populateDropdowns();
        document.getElementById('setupSection').classList.remove('opacity-30', 'pointer-events-none');
    } catch (e) {
        logDebug("PARSING ERROR", true);
    }
}

function parseCSV(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const lines = e.target.result.split('\n').filter(l => l.trim());
            resolve(lines.map(line => line.split(',').map(c => c.replace(/"/g, '').trim())));
        };
        reader.readAsText(file);
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
    const fill = (id, list) => {
        document.getElementById(id).innerHTML = list.map(i => `<option value="${i}">${i}</option>`).join('');
    };
    fill('teamA', Array.from(teams).sort());
    fill('teamB', Array.from(teams).sort());
    fill('tournament', Array.from(tours).sort());
}

function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function poisson(k, lambda) { return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k); }

function generatePrediction() {
    const tA = document.getElementById('teamA').value;
    const tB = document.getElementById('teamB').value;
    const tourney = document.getElementById('tournament').value;
    const isNeutral = document.getElementById('neutral').checked;

    const eA = eloMap.get(tA.toLowerCase()) || { off: 1500, def: 1500, home: 1500, away: 1500, overall: 1500 };
    const eB = eloMap.get(tB.toLowerCase()) || { off: 1500, def: 1500, home: 1500, away: 1500, overall: 1500 };

    logDebug(`FETCH: ${tA} OFF(${eA.off}) | ${tB} DEF(${eB.def})`);

    const baseXG = 1.2;
    let hA = 1.0, hB = 1.0;
    if (!isNeutral) {
        hA += (eA.home - eA.overall) * 0.0015;
        hB += (eB.away - eB.overall) * 0.0015;
    }

    const lambdaA = Math.max(0.01, baseXG * Math.pow(10, (eA.off - eB.def) / 400) * hA);
    const lambdaB = Math.max(0.01, baseXG * Math.pow(10, (eB.off - eA.def) / 400) * hB);

    let scores = [];
    for (let a = 0; a <= 6; a++) {
        for (let b = 0; b <= 6; b++) {
            scores.push({ s: `${a} - ${b}`, p: poisson(a, lambdaA) * poisson(b, lambdaB) });
        }
    }
    scores.sort((x, y) => y.p - x.p);

    document.getElementById('welcomeState').classList.add('hidden');
    document.getElementById('resultState').classList.remove('hidden');
    document.getElementById('finalPickText').innerText = lambdaA > lambdaB ? tA : tB;
    
    document.getElementById('scorelineOutput').innerHTML = scores.slice(0, 5).map(s => 
        `<div class="flex justify-between p-4 bg-[#f5f5f7] rounded-2xl font-bold text-gray-700">
            <span>${s.s}</span>
            <span class="text-blue-600">${(s.p * 100).toFixed(1)}%</span>
        </div>`).join('');

    document.getElementById('historicalOutput').innerHTML = `
        <p>Current Match: ${tA} vs ${tB}</p>
        <p>Tournament: ${tourney}</p>
        <p>Venue: ${isNeutral ? 'Neutral Ground' : 'Home Field Advantage'}</p>
        <p class="mt-4 pt-4 border-t border-gray-100 text-[10px] text-gray-400">POISSON LAMBDA: ${lambdaA.toFixed(2)} vs ${lambdaB.toFixed(2)}</p>
    `;
}
