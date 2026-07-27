const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// KULLANICI BİLGİLERİ
const ADMIN_USERNAME = "adminkensuw";
const ADMIN_PASSWORD = "KensuwBaba9078q";
const DB_FILE = path.join(__dirname, 'database.json');

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            teams: [],
            scores: {},
            leaderboard: [],
            spectating: null,
            mvps: [],
            slots: {},
            rosters: {},
            logos: {},
            alive: {},
            manualStatus: {},
            tournamentLogo: "",
            defaultLogo: "", // EKLENDİ: Varsayılan Takım Logosu
            settings: {
                tournamentName: "PMGO 2026 GRAND FINALS",
                currentMatch: "MATCH 1 / ERANGEL",
                showAlive: true,
                showManualStatus: true,
                showMarquee: true
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, username: ADMIN_USERNAME });
    } else {
        res.status(401).json({ success: false, message: "Hatalı kullanıcı adı veya şifre!" });
    }
});

app.get('/api/data', (req, res) => { 
    res.json(readDB()); 
});

app.post('/api/teams', (req, res) => {
    const { teamList } = req.body;
    const db = readDB();
    if (teamList !== undefined) {
        let trimmedInput = teamList.trim();

        if (trimmedInput === "SIFIRLA") {
            db.teams = [];
            db.scores = {};
            db.rosters = {};
            db.logos = {};
            db.alive = {};
            db.manualStatus = {};
            writeDB(db);
            
            io.emit('liveUpdate', { 
                scores: db.scores, 
                leaderboard: db.leaderboard, 
                settings: db.settings, 
                alive: db.alive, 
                manualStatus: db.manualStatus, 
                logos: db.logos, 
                tournamentLogo: db.tournamentLogo, 
                defaultLogo: db.defaultLogo,
                teams: db.teams 
            });

            return res.json({ success: true, teams: db.teams, reset: true });
        }

        const newTeams = teamList.split('\n').map(t => t.trim()).filter(t => t.length > 0);
        
        let combinedTeams = [...db.teams];
        newTeams.forEach(t => {
            if (!combinedTeams.includes(t)) {
                combinedTeams.push(t);
            }
        });

        if (combinedTeams.length > 23) {
            return res.status(400).json({ success: false, message: "⚠️ Maksimum 23 takım (Slot 3 - 25) sınırına ulaşıldı! Daha fazla ekleyemezsiniz." });
        }

        db.teams = combinedTeams;
        db.teams.forEach(team => {
            if (!db.scores[team]) db.scores[team] = Array(5).fill().map(() => ({ rank: '', kill: '' }));
            if (!db.rosters[team]) db.rosters[team] = ["", "", "", "", ""];
            if (!db.logos[team]) db.logos[team] = "";
            if (!db.alive[team]) db.alive[team] = [3, 3, 3, 3];
            if (db.manualStatus[team] === undefined) db.manualStatus[team] = false;
        });
        
        writeDB(db);
        
        io.emit('liveUpdate', { 
            scores: db.scores, 
            leaderboard: db.leaderboard, 
            settings: db.settings, 
            alive: db.alive, 
            manualStatus: db.manualStatus, 
            logos: db.logos, 
            tournamentLogo: db.tournamentLogo, 
            defaultLogo: db.defaultLogo,
            teams: db.teams 
        });

        res.json({ success: true, teams: db.teams });
    } else {
        res.status(400).json({ success: false, message: "Veri gönderilmedi." });
    }
});

app.post('/api/remove-team', (req, res) => {
    const teamToDelete = req.body.team;
    const db = readDB();
    
    if (teamToDelete) {
        db.teams = db.teams.filter(t => t !== teamToDelete);
        delete db.scores[teamToDelete];
        delete db.rosters[teamToDelete];
        delete db.logos[teamToDelete];
        delete db.alive[teamToDelete];
        delete db.manualStatus[teamToDelete];
        
        writeDB(db);
        return res.json({ success: true, teams: db.teams });
    }
    
    res.status(400).json({ success: false, message: "Takım adı belirtilmedi." });
});

app.post('/api/rosters', (req, res) => { 
    const db = readDB();
    db.rosters = req.body.rosters; 
    writeDB(db);
    res.json({ success: true }); 
});

app.post('/api/logo', (req, res) => { 
    const { team, logo } = req.body;
    const db = readDB();
    db.logos[team] = logo; 
    writeDB(db);
    io.emit('logoUpdate', { logos: db.logos });
    res.json({ success: true }); 
});

app.post('/api/tournament-logo', (req, res) => {
    const { tournamentLogo } = req.body;
    const db = readDB();
    db.tournamentLogo = tournamentLogo;
    writeDB(db);
    io.emit('tourLogoUpdate', { tournamentLogo: db.tournamentLogo });
    res.json({ success: true });
});

// EKLENDİ: Varsayılan Takım Logosu API Endpoints
app.post('/api/default-logo', (req, res) => {
    const { defaultLogo } = req.body;
    const db = readDB();
    db.defaultLogo = defaultLogo;
    writeDB(db);
    io.emit('defaultLogoUpdate', { defaultLogo: db.defaultLogo });
    res.json({ success: true });
});

app.post('/api/mvps', (req, res) => { 
    const db = readDB();
    db.mvps = req.body.mvps; 
    writeDB(db);
    res.json({ success: true }); 
});

app.post('/api/settings', (req, res) => {
    const db = readDB();
    db.settings.tournamentName = req.body.tournamentName;
    db.settings.currentMatch = req.body.currentMatch;
    if (req.body.showAlive !== undefined) db.settings.showAlive = req.body.showAlive;
    if (req.body.showManualStatus !== undefined) db.settings.showManualStatus = req.body.showManualStatus;
    if (req.body.showMarquee !== undefined) db.settings.showMarquee = req.body.showMarquee;
    
    writeDB(db);
    io.emit('liveUpdate', { scores: db.scores, settings: db.settings, leaderboard: db.leaderboard, alive: db.alive, manualStatus: db.manualStatus, logos: db.logos, tournamentLogo: db.tournamentLogo, defaultLogo: db.defaultLogo, teams: db.teams });
    res.json({ success: true });
});

io.on('connection', (socket) => {
    socket.on('liveUpdate', (data) => {
        const db = readDB();
        db.scores = data.scores;
        db.leaderboard = data.leaderboard;
        if(data.alive) db.alive = data.alive;
        if(data.manualStatus) db.manualStatus = data.manualStatus;
        writeDB(db);
        io.emit('liveUpdate', { scores: db.scores, leaderboard: db.leaderboard, settings: db.settings, alive: db.alive, manualStatus: db.manualStatus, logos: db.logos, tournamentLogo: db.tournamentLogo, defaultLogo: db.defaultLogo, teams: db.teams });
    });

    socket.on('aliveUpdate', (data) => {
        const db = readDB();
        db.alive = data.alive;
        writeDB(db);
        io.emit('aliveUpdate', { alive: db.alive });
    });

    socket.on('manualStatusUpdate', (data) => {
        const db = readDB();
        db.manualStatus = data.manualStatus;
        writeDB(db);
        io.emit('manualStatusUpdate', { manualStatus: db.manualStatus });
    });

    socket.on('triggerAlert', (data) => {
        io.emit('triggerAlert', data);
    });

    socket.on('setSpectate', (data) => {
        let teamName = (typeof data === 'object' && data.teamName !== undefined) ? data.teamName : data;
        if (!teamName) teamName = null;
        
        const db = readDB();
        db.spectating = teamName;
        writeDB(db);
        io.emit('spectateUpdate', { team: teamName, logo: teamName ? (db.logos[teamName] || db.defaultLogo || "") : "" });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu çalışıyor: http://localhost:${PORT}`); });