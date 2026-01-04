let TEAMS = []; // Will be populated from CSV

// =========================================================
// 1. DATA INITIALIZATION
// =========================================================
async function initEngine() {
    const response = await fetch('elos.csv');
    const data = await response.text();
    const rows = data.split('\n').slice(1);
    
    TEAMS = rows.filter(r => r.trim()).map((row, index) => {
        const cols = row.split(',');
        return {
            name: cols[0].trim(),
            elo: parseFloat(cols[1]),
            elo_attack: parseFloat(cols[2]),
            elo_defense: parseFloat(cols[3]),
            rank: index + 1
        };
    });
    populateDropdowns();
}

function populateDropdowns() {
    const selA = document.getElementById('teamA');
    const selB = document.getElementById('teamB');
    TEAMS.forEach(team => {
        selA.add(new Option(team.name, team.name));
        selB.add(new Option(team.name, team.name));
    });
}

// =========================================================
// 2. CORE ALGORITHMS (Poisson & Penalties)
// =========================================================
function simulateGoals(teamA, teamB) {
    const lambdaBase = 1.35; 
    // Complexity: Attack power minus opponent defense power
    const attackAdvantage = teamA.elo_attack - teamB.elo_defense;
    const lambda = lambdaBase * Math.pow(10, attackAdvantage / 1000); 

    let k = 0, p = 1.0, L = Math.exp(-lambda);
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

function simulatePenalties(team1, team2) {
    let t1p = 0, t2p = 0;
    const kick = (adv) => Math.random() < (0.7 + (adv / 3000));
    for (let i = 0; i < 5; i++) {
        if (kick(team1.elo_attack - team2.elo_defense)) t1p++;
        if (kick(team2.elo_attack - team1.elo_defense)) t2p++;
    }
    while (t1p === t2p) { // Sudden death
        if (kick(team1.elo_attack - team2.elo_defense)) t1p++;
        if (kick(team2.elo_attack - team1.elo_defense)) t2p++;
    }
    return { t1p, t2p };
}

function simulateMatch(team1, team2, isKnockout = true) {
    let s1 = simulateGoals(team1, team2);
    let s2 = simulateGoals(team2, team1);
    let winner = null, p1, p2;

    if (s1 === s2 && isKnockout) {
        const pens = simulatePenalties(team1, team2);
        p1 = pens.t1p; p2 = pens.t2p;
        winner = p1 > p2 ? team1 : team2;
    } else {
        if (s1 > s2) winner = team1;
        else if (s2 > s1) winner = team2;
    }

    return { team1, team2, s1, s2, p1, p2, winner };
}

// =========================================================
// 3. PAGE LOGIC
// =========================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(screenId + 'Screen').style.display = 'block';
}

function handlePrediction() {
    const tA = TEAMS.find(t => t.name === document.getElementById('teamA').value);
    const tB = TEAMS.find(t => t.name === document.getElementById('teamB').value);
    
    let winsA = 0, winsB = 0, draws = 0;
    const scores = new Map();

    for (let i = 0; i < 10000; i++) {
        const res = simulateMatch(tA, tB, false);
        const line = `${res.s1}-${res.s2}`;
        scores.set(line, (scores.get(line) || 0) + 1);
        if (res.winner === tA) winsA++;
        else if (res.winner === tB) winsB++;
        else draws++;
    }

    renderPrediction(tA, tB, winsA, winsB, draws, scores);
}

function renderPrediction(tA, tB, wA, wB, d, scoreMap) {
    document.getElementById('predictionResults').style.display = 'block';
    document.getElementById('probA').innerHTML = `${tA.name}<br><strong>${(wA/100).toFixed(1)}%</strong>`;
    document.getElementById('probDraw').innerHTML = `Draw<br><strong>${(d/100).toFixed(1)}%</strong>`;
    document.getElementById('probB').innerHTML = `${tB.name}<br><strong>${(wB/100).toFixed(1)}%</strong>`;

    const tbody = document.querySelector('#scoreTable tbody');
    tbody.innerHTML = '';
    [...scoreMap.entries()].sort((a,b) => b[1] - a[1]).slice(0,5).forEach(([score, count]) => {
        const row = tbody.insertRow();
        row.insertCell().textContent = score;
        row.insertCell().textContent = count;
        row.insertCell().textContent = (count/100).toFixed(2) + '%';
    });
}

// 4. TOURNAMENT LOGIC
function runFullSimulation() {
    const viz = document.getElementById('bracketVisualization');
    const log = document.getElementById('bracketRounds');
    viz.innerHTML = ''; log.innerHTML = '';
    
    let currentTeams = [...TEAMS].sort((a,b) => a.rank - b.rank).slice(0, 16);
    let round = 1;

    while (currentTeams.length > 1) {
        const nextRoundTeams = [];
        let roundHtml = `<div class="round-col">`;
        for (let i = 0; i < currentTeams.length; i += 2) {
            const match = simulateMatch(currentTeams[i], currentTeams[i+1], true);
            nextRoundTeams.push(match.winner);
            roundHtml += `
                <div class="bracket-match">
                    <div class="${match.winner === match.team1 ? 'match-winner' : ''}">${match.team1.name}: ${match.s1}</div>
                    <div class="${match.winner === match.team2 ? 'match-winner' : ''}">${match.team2.name}: ${match.s2}</div>
                </div>`;
        }
        viz.innerHTML += roundHtml + `</div>`;
        currentTeams = nextRoundTeams;
        round++;
    }
}

initEngine();
