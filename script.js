let eloData = {};
let teamsList = [];

// Initialize by loading your CSV files
async function init() {
    try {
        const response = await fetch('elos.csv');
        const text = await response.text();
        parseEloCsv(text);
        populateDropdowns();
    } catch (err) {
        console.error("Error loading CSVs. Make sure they are in the same folder.", err);
    }
}

function parseEloCsv(csv) {
    const lines = csv.split('\n');
    lines.forEach((line, index) => {
        if (index === 0 || !line.trim()) return; // Skip header
        const columns = line.split(',');
        if (columns.length < 6) return;

        const teamName = columns[0].trim();
        eloData[teamName] = {
            overall: parseFloat(columns[1]),
            offense: parseFloat(columns[2]),
            defense: parseFloat(columns[3]),
            homeAdv: parseFloat(columns[4]),
            awayAdv: parseFloat(columns[5])
        };
        teamsList.push(teamName);
    });
    teamsList.sort();
}

function populateDropdowns() {
    const selA = document.getElementById('teamA');
    const selB = document.getElementById('teamB');
    teamsList.forEach(team => {
        selA.add(new Option(team, team));
        selB.add(new Option(team, team));
    });
}

async function runLiveSimulation() {
    const teamA = document.getElementById('teamA').value;
    const teamB = document.getElementById('teamB').value;
    const log = document.getElementById('simLog');
    const simArea = document.getElementById('simArea');
    
    if (teamA === teamB) return alert("Select two different teams!");

    simArea.style.display = 'block';
    log.innerHTML = "<div>Match Kickoff!</div>";
    let scoreA = 0, scoreB = 0;

    // Simulation settings based on your Java logic
    const pGoalA = (eloData[teamA].offense / eloData[teamB].defense) * 0.025;
    const pGoalB = (eloData[teamB].offense / eloData[teamA].defense) * 0.022;

    for (let min = 1; min <= 90; min++) {
        document.getElementById('simTime').innerText = min + "'";
        let eventFound = false;

        // Scoring Logic
        if (Math.random() < pGoalA) {
            scoreA++;
            addLog(min, "GOAL", teamA, `${teamA} finds the back of the net!`, "goal");
            eventFound = true;
        } 
        if (Math.random() < pGoalB) {
            scoreB++;
            addLog(min, "GOAL", teamB, `${teamB} scores a brilliant goal!`, "goal");
            eventFound = true;
        }

        // Foul/Card Logic
        if (Math.random() < 0.08) {
            const roll = Math.random();
            if (roll < 0.1) {
                addLog(min, "RED CARD", "Ref", "Straight red card issued!", "red");
            } else if (roll < 0.4) {
                addLog(min, "YELLOW CARD", "Ref", "Yellow card for a hard tackle.", "yellow");
            }
        }

        document.getElementById('simScore').innerText = `${teamA} ${scoreA} - ${scoreB} ${teamB}`;
        
        // This creates the "live" feeling. 100ms = 1 minute in-game
        await new Promise(resolve => setTimeout(resolve, 100)); 
    }
    log.innerHTML = `<div class="log-entry"><b>FT: ${teamA} ${scoreA} - ${scoreB} ${teamB}</b></div>` + log.innerHTML;
}

function addLog(min, type, team, desc, cssClass) {
    const log = document.getElementById('simLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${cssClass}`;
    entry.innerHTML = `[${min}'] ${type}: ${desc}`;
    log.insertBefore(entry, log.firstChild); // Newest events at top
}

document.getElementById('simBtn').onclick = runLiveSimulation;
init();
