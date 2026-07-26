const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let db = {
    teams: [],
    scores: {},
    leaderboard: [],
    spectating: null,
    mvps: [],
    slots: {},
    rosters: {},
    logos: {},
    alive: {},
    defaultLogo: "", // Varsayılan logo alanı
    tournamentLogo: "",
    settings: {
        tournamentName: "PMGO 2026 GRAND FINALS",
        currentMatch: "MATCH 1 / ERANGEL",
        showAlive: true,
        showMarquee: true
    }
};

app.get('/api/data', (req, res) => { res.json(db); });

app.post('/api/teams', (req, res) => {
    const { teamList } = req.body;
    if (teamList) {
        teamList.split('\n').map(t => t.trim()).filter(t => t.length > 0).forEach(team => {
            if (!db.teams.includes(team)) {
                db.teams.push(team);
                db.scores[team] = Array(5).fill().map(() => ({ rank: '', kill: '' }));
                db.rosters[team] = ["", "", "", "", ""];
                // Yeni takıma varsayılan logo atanır
                db.logos[team] = db.defaultLogo || "";
                db.alive[team] = [3, 3, 3, 3];
            }
        });
    }
    res.json({ success: true, teams: db.teams });
});

app.post('/api/remove-team', (req, res) => {
    const { team } = req.body;
    db.teams = db.teams.filter(t => t !== team);
    delete db.scores[team];
    delete db.rosters[team];
    delete db.slots[team];
    delete db.logos[team];
    delete db.alive[team];
    res.json({ success: true });
});

app.post('/api/rosters', (req, res) => { db.rosters = req.body.rosters; res.json({ success: true }); });

app.post('/api/logo', (req, res) => { 
    const { team, logo } = req.body;
    db.logos[team] = logo; 
    io.emit('logoUpdate', { logos: db.logos });
    res.json({ success: true }); 
});

// EKLENDİ: Varsayılan logo yüklenince tüm logosu olmayan takımlara uygula ve yayına bildir
app.post('/api/default-logo', (req, res) => {
    const { defaultLogo } = req.body;
    db.defaultLogo = defaultLogo;
    db.teams.forEach(team => {
        if (!db.logos[team] || db.logos[team] === "") {
            db.logos[team] = defaultLogo;
        }
    });
    io.emit('logoUpdate', { logos: db.logos });
    res.json({ success: true });
});

app.post('/api/tournament-logo', (req, res) => {
    const { tournamentLogo } = req.body;
    db.tournamentLogo = tournamentLogo;
    io.emit('tourLogoUpdate', { tournamentLogo: db.tournamentLogo });
    res.json({ success: true });
});

app.post('/api/mvps', (req, res) => { db.mvps = req.body.mvps; res.json({ success: true }); });

app.post('/api/settings', (req, res) => {
    db.settings.tournamentName = req.body.tournamentName;
    db.settings.currentMatch = req.body.currentMatch;
    if (req.body.showAlive !== undefined) db.settings.showAlive = req.body.showAlive;
    if (req.body.showMarquee !== undefined) db.settings.showMarquee = req.body.showMarquee;
    
    io.emit('liveUpdate', { settings: db.settings, leaderboard: db.leaderboard, alive: db.alive, logos: db.logos, tournamentLogo: db.tournamentLogo });
    res.json({ success: true });
});

app.post('/api/reset', (req, res) => {
    db.teams = []; db.scores = {}; db.leaderboard = []; db.spectating = null; db.slots = {}; db.rosters = {}; db.logos = {}; db.alive = {}; db.defaultLogo = ""; db.tournamentLogo = "";
    res.json({ success: true });
});

io.on('connection', (socket) => {
    socket.on('liveUpdate', (data) => {
        db.scores = data.scores;
        db.leaderboard = data.leaderboard;
        if(data.alive) db.alive = data.alive;
        io.emit('liveUpdate', { scores: db.scores, leaderboard: db.leaderboard, settings: db.settings, alive: db.alive, logos: db.logos, tournamentLogo: db.tournamentLogo });
    });

    socket.on('aliveUpdate', (data) => {
        db.alive = data.alive;
        io.emit('aliveUpdate', { alive: db.alive });
    });

    socket.on('setSpectate', (teamName) => {
        db.spectating = teamName;
        io.emit('spectateUpdate', { team: teamName, logo: db.logos[teamName] || "" });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu çalışıyor: http://localhost:${PORT}`); });