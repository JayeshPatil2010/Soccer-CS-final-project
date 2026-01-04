let matches = [];
let eloMap = new Map();

// Run this as soon as the page loads
window.onload = function() {
    autoLoadData();
};

async function autoLoadData() {
    logDebug("FETCHING REPOSITORY DATA...");
    try {
        // Fetch both files simultaneously
        const [resultsRes, eloRes] = await Promise.all([
            fetch('results.csv'),
            fetch('elos.csv')
        ]);

        if (!resultsRes.ok || !eloRes.ok) throw new Error("Files not found");

        const resultsText = await resultsRes.text();
        const eloText = await eloRes.text();

        // Parse Results
        matches = parseCSVText(resultsText);
        
        // Parse Elos
        const eloData = parseCSVText(eloText);
        eloMap.clear();
        eloData.forEach(row => {
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

        // Update UI
        populateDropdowns();
        document.getElementById('loadStatus').innerText = "System Ready";
        document.getElementById('loadStatus').className = "text-[10px] font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full uppercase tracking-widest";
        document.getElementById('setupSection').classList.remove('opacity-30', 'pointer-events-none');
        logDebug(`ENGINE ONLINE: ${eloMap.size} TEAMS LOADED`);

    } catch (err) {
        logDebug("AUTO-LOAD FAILED: " + err.message, true);
        document.getElementById('loadStatus').innerText = "Load Error";
        document.getElementById('loadStatus').className = "text-[10px] font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full uppercase tracking-widest";
    }
}

function parseCSVText(text) {
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map(line => line.split(',').map(c => c.replace(/"/g, '').trim()));
}

// ... (Keep the rest of your functions from the previous app.js)
// populateDropdowns(), generatePrediction(), poisson(), factorial(), logDebug()
