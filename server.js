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

// TEK YÖNETİCİ BİLGİLERİ
const ADMIN_USERNAME = "adminkensuw";
const ADMIN_PASSWORD = "KensuwBaba9078q";

// Veritabanı dosya yolu
const DB_FILE = path.join(__dirname, 'database.json');

// Veritabanını okuyan fonksiyon
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
            defaultLogo: "", 
            tournamentLogo: "",
            settings: {
                tournamentName: "PMGO 2026 GRAND FINALS",
                currentMatch: "MATCH 1 / ERANGEL",
                showAlive: true,
                showMarquee: true
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Veritabanına yazan fonksiyon
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Giriş API'si
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
    if (teamList) {
        teamList.split('\n').map(t => t.trim()).filter(t => t.length > 0).forEach(team => {
            if (!db.teams.includes(team)) {
                db.teams.push(team);
                db.scores[team] = Array(5).fill().map(() => ({ rank: '', kill: '' }));
                db.rosters[team] = ["", "", "", "", ""];
                db.logos[team] = db.defaultLogo || "";
                db.alive[team] = [3, 3, 3, 3];
            }
        });
    }
    writeDB(db);
    res.json({ success: true, teams: db.teams });
});

app.post('/api/remove-team', (req, res) => {
    const { team } = req.body;
    const db = readDB();
    db.teams = db.teams.filter(t => t !== team);
    delete db.scores[team];
    delete db.rosters[team];
    delete db.slots[team];
    delete db.logos[team];
    delete db.alive[team];
    writeDB(db);
    res.json({ success: true });
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

app.post('/api/default-logo', (req, res) => {
    const { defaultLogo } = req.body;
    const db = readDB();
    db.defaultLogo = defaultLogo;
    db.teams.forEach(team => {
        if (!db.logos[team] || db.logos[team] === "") {
            db.logos[team] = defaultLogo;
        }
    });
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
    if (req.body.showMarquee !== undefined) db.settings.showMarquee = req.body.showMarquee;
    
    writeDB(db);
    io.emit('liveUpdate', { settings: db.settings, leaderboard: db.leaderboard, alive: db.alive, logos: db.logos, tournamentLogo: db.tournamentLogo });
    res.json({ success: true });
});

app.post('/api/reset', (req, res) => {
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
    res.json({ success: true });
});

io.on('connection', (socket) => {
    socket.on('liveUpdate', (data) => {
        const db = readDB();
        db.scores = data.scores;
        db.leaderboard = data.leaderboard;
        if(data.alive) db.alive = data.alive;
        writeDB(db);
        io.emit('liveUpdate', { scores: db.scores, leaderboard: db.leaderboard, settings: db.settings, alive: db.alive, logos: db.logos, tournamentLogo: db.tournamentLogo });
    });

    socket.on('aliveUpdate', (data) => {
        const db = readDB();
        db.alive = data.alive;
        writeDB(db);
        io.emit('aliveUpdate', { alive: db.alive });
    });

    socket.on('setSpectate', (data) => {
        const teamName = (typeof data === 'object' && data.teamName) ? data.teamName : data;
        const db = readDB();
        db.spectating = teamName;
        writeDB(db);
        io.emit('spectateUpdate', { team: teamName, logo: db.logos[teamName] || "" });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu çalışıyor: http://localhost:${PORT}`); });