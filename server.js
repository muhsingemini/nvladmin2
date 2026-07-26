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

// Yöneticiler ve şifreleri
const USERS = {
    "admin1": "1234",
    "admin2": "1234"
};

// Kullanıcıya özel veritabanı dosyası yolu oluşturan fonksiyon
function getDBFile(username) {
    const safeUser = username && USERS[username] ? username : "admin1";
    return path.join(__dirname, `database_${safeUser}.json`);
}

// Kullanıcının veritabanını okuyan fonksiyon
function readDB(username) {
    const dbFile = getDBFile(username);
    if (!fs.existsSync(dbFile)) {
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
        fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

// Kullanıcının veritabanına yazan fonksiyon
function writeDB(username, data) {
    const dbFile = getDBFile(username);
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// Giriş API'si
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (USERS[username] && USERS[username] === password) {
        res.json({ success: true, username });
    } else {
        res.status(401).json({ success: false, message: "Hatalı kullanıcı adı veya şifre!" });
    }
});

app.get('/api/data', (req, res) => { 
    const user = req.query.user || "admin1";
    res.json(readDB(user)); 
});

app.post('/api/teams', (req, res) => {
    const { user, teamList } = req.body;
    const db = readDB(user);
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
    writeDB(user, db);
    res.json({ success: true, teams: db.teams });
});

app.post('/api/remove-team', (req, res) => {
    const { user, team } = req.body;
    const db = readDB(user);
    db.teams = db.teams.filter(t => t !== team);
    delete db.scores[team];
    delete db.rosters[team];
    delete db.slots[team];
    delete db.logos[team];
    delete db.alive[team];
    writeDB(user, db);
    res.json({ success: true });
});

app.post('/api/rosters', (req, res) => { 
    const { user, rosters } = req.body;
    const db = readDB(user);
    db.rosters = rosters; 
    writeDB(user, db);
    res.json({ success: true }); 
});

app.post('/api/logo', (req, res) => { 
    const { user, team, logo } = req.body;
    const db = readDB(user);
    db.logos[team] = logo; 
    writeDB(user, db);
    io.to(user).emit('logoUpdate', { logos: db.logos });
    res.json({ success: true }); 
});

app.post('/api/default-logo', (req, res) => {
    const { user, defaultLogo } = req.body;
    const db = readDB(user);
    db.defaultLogo = defaultLogo;
    db.teams.forEach(team => {
        if (!db.logos[team] || db.logos[team] === "") {
            db.logos[team] = defaultLogo;
        }
    });
    writeDB(user, db);
    io.to(user).emit('logoUpdate', { logos: db.logos });
    res.json({ success: true });
});

app.post('/api/tournament-logo', (req, res) => {
    const { user, tournamentLogo } = req.body;
    const db = readDB(user);
    db.tournamentLogo = tournamentLogo;
    writeDB(user, db);
    io.to(user).emit('tourLogoUpdate', { tournamentLogo: db.tournamentLogo });
    res.json({ success: true });
});

app.post('/api/mvps', (req, res) => { 
    const { user, mvps } = req.body;
    const db = readDB(user);
    db.mvps = mvps; 
    writeDB(user, db);
    res.json({ success: true }); 
});

app.post('/api/settings', (req, res) => {
    const user = req.body.user;
    const db = readDB(user);
    db.settings.tournamentName = req.body.tournamentName;
    db.settings.currentMatch = req.body.currentMatch;
    if (req.body.showAlive !== undefined) db.settings.showAlive = req.body.showAlive;
    if (req.body.showMarquee !== undefined) db.settings.showMarquee = req.body.showMarquee;
    
    writeDB(user, db);
    io.to(user).emit('liveUpdate', { settings: db.settings, leaderboard: db.leaderboard, alive: db.alive, logos: db.logos, tournamentLogo: db.tournamentLogo });
    res.json({ success: true });
});

app.post('/api/reset', (req, res) => {
    const { user } = req.body;
    const dbFile = getDBFile(user);
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    res.json({ success: true });
});

io.on('connection', (socket) => {
    socket.on('joinRoom', (user) => {
        socket.join(user || "admin1");
    });

    socket.on('liveUpdate', (data) => {
        const user = data.user || "admin1";
        const db = readDB(user);
        db.scores = data.scores;
        db.leaderboard = data.leaderboard;
        if(data.alive) db.alive = data.alive;
        writeDB(user, db);
        io.to(user).emit('liveUpdate', { scores: db.scores, leaderboard: db.leaderboard, settings: db.settings, alive: db.alive, logos: db.logos, tournamentLogo: db.tournamentLogo });
    });

    socket.on('aliveUpdate', (data) => {
        const user = data.user || "admin1";
        const db = readDB(user);
        db.alive = data.alive;
        writeDB(user, db);
        io.to(user).emit('aliveUpdate', { alive: db.alive });
    });

    socket.on('setSpectate', (data) => {
        const user = (typeof data === 'object' && data.user) ? data.user : "admin1";
        const teamName = (typeof data === 'object' && data.teamName) ? data.teamName : data;
        const db = readDB(user);
        db.spectating = teamName;
        writeDB(user, db);
        io.to(user).emit('spectateUpdate', { team: teamName, logo: db.logos[teamName] || "" });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu çalışıyor: http://localhost:${PORT}`); });