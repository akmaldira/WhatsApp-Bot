const { Client, LegacySessionAuth } = require('whatsapp-web.js');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const express = require('express');
const axios = require('axios');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Path where the session data will be stored
const SESSION_FILE_PATH = './session.json';
// Load the session data if it has been previously saved
let sessionData;
if(fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
    res.sendFile('index.html', {root:__dirname})
})

// Use the saved values
const client = new Client({
    authStrategy: new LegacySessionAuth({
        session: sessionData
    })
});

client.on('message', async msg => {
    if (msg.body.startsWith('!absen ')) {
        const text = msg.body.split(' ')[1];
        const data = text.split('|');
        const absen = await axios.get(`https://absenusk-api.herokuapp.com/?npm=${data[0]}&password=${data[1]}`);
        msg.reply(absen.data.result);
    }
});

client.initialize();

io.on('connection', (socket) => {
    socket.emit('message', 'Connecting...')
    client.on('qr', (qr) => {
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'Scan QR!')
        })
    });

    client.on('authenticated', (session) => {
        socket.emit('authenticated', 'Authenticated');
        socket.emit('message', 'WhatsApp account is authenticated')
        sessionData = session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
            if (err) {
                socket.emit('message', err)
            }
        });
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        socket.emit('message', `Authenticated failure ${msg}`)
    });

    client.on('ready', () => {
        socket.emit('ready', 'WhatsApp is ready!')
        socket.emit('message', 'WhatsApp is ready!')
    });
})

server.listen(3000, () => {
    console.log('Server running');
})