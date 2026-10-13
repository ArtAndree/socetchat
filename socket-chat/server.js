const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const users = new Map();

app.use(express.static(path.join(__dirname, 'public')));

const online = () => Array.from(users, ([id, user]) => ({ id, ...user }));

io.on('connection', (socket) => {
  socket.on('join', (details, reply) => {
    if (users.has(socket.id)) return reply?.({ ok: true });
    const name = typeof details?.name === 'string' ? details.name.trim().slice(0, 25) : '';
    const color = /^#[0-9a-fA-F]{6}$/.test(details?.color) ? details.color : '#8b5cf6';
    if (!name) return reply?.({ ok: false, error: 'Введите имя' });
    if (online().some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      return reply?.({ ok: false, error: 'Это имя уже занято' });
    }
    const present = online().map((u) => u.name);
    users.set(socket.id, { name, color });
    reply?.({ ok: true });
    socket.emit('systemMessage', present.length
      ? `Добро пожаловать. В чате уже присутствуют: ${present.join(', ')}`
      : 'Добро пожаловать. Вы первый в чате.');
    socket.broadcast.emit('systemMessage', `К нам присоединился ${name}`);
    io.emit('usersUpdate', online());
  });

  socket.on('chatMessage', (text) => {
    const user = users.get(socket.id);
    if (!user || typeof text !== 'string' || !text.trim()) return;
    io.emit('chatMessage', { from: user.name, color: user.color, text: text.trim().slice(0, 2000), time: Date.now(), private: false });
  });

  socket.on('privateMessage', (payload) => {
    const sender = users.get(socket.id);
    const receiver = users.get(payload?.to);
    if (!sender || !receiver || payload.to === socket.id || typeof payload.text !== 'string' || !payload.text.trim()) return;
    const message = { from: sender.name, to: receiver.name, color: sender.color, text: payload.text.trim().slice(0, 2000), time: Date.now(), private: true };
    io.to(payload.to).emit('chatMessage', message);
    socket.emit('chatMessage', message);
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;
    users.delete(socket.id);
    io.emit('systemMessage', `${user.name} нас покинул.`);
    io.emit('usersUpdate', online());
  });
});

server.listen(process.env.PORT || 3000, () => console.log(`Чат запущен на порту ${process.env.PORT || 3000}`));
