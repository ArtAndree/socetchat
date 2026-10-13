const socket = io();
const $ = (id) => document.getElementById(id);
let currentUser = null;

$('joinForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('name').value.trim();
  const color = $('color').value;
  if (!name) return;
  socket.emit('join', { name, color }, (response) => {
    if (!response?.ok) return $('error').textContent = response?.error || 'Не удалось войти';
    currentUser = { name, color };
    $('error').textContent = '';
    $('login').hidden = true;
    $('login').style.display = 'none';
    $('message').focus();
  });
});

$('sendForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!currentUser || !socket.connected) return;
  const text = $('message').value.trim();
  if (!text) return;
  if ($('recipient').value === 'all') socket.emit('chatMessage', text);
  else socket.emit('privateMessage', { to: $('recipient').value, text });
  $('message').value = '';
  $('message').focus();
});

function appendMessage(element) {
  $('messages').append(element);
  $('messages').scrollTop = $('messages').scrollHeight;
}

socket.on('systemMessage', (text) => {
  const div = document.createElement('div');
  div.className = 'system';
  div.textContent = text;
  appendMessage(div);
});

socket.on('chatMessage', (data) => {
  const div = document.createElement('div');
  div.className = data.private ? 'bubble private' : 'bubble';
  const author = document.createElement('strong');
  author.textContent = data.from + (data.private ? ` → ${data.to} (личное)` : '');
  author.style.color = data.color;
  const time = document.createElement('time');
  time.textContent = new Date(data.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const body = document.createElement('p');
  body.textContent = data.text;
  div.append(author, time, body);
  appendMessage(div);
});

socket.on('usersUpdate', (users) => {
  $('count').textContent = users.length;
  $('users').replaceChildren();
  const selected = $('recipient').value;
  $('recipient').replaceChildren(new Option('Всем', 'all'));
  for (const user of users) {
    const item = document.createElement('li');
    const dot = document.createElement('span');
    dot.style.backgroundColor = user.color;
    item.append(dot, document.createTextNode(user.name + (user.id === socket.id ? ' (вы)' : '')));
    $('users').append(item);
    if (user.id !== socket.id) $('recipient').add(new Option('Лично: ' + user.name, user.id));
  }
  if ([...$('recipient').options].some((option) => option.value === selected)) $('recipient').value = selected;
});

socket.on('disconnect', () => {
  if (currentUser) {
    const div = document.createElement('div');
    div.className = 'system';
    div.textContent = 'Связь с сервером потеряна. Переподключаемся…';
    appendMessage(div);
  }
});

socket.on('connect', () => {
  if (currentUser) socket.emit('join', currentUser, (response) => {
    if (!response?.ok) {
      currentUser = null;
      $('login').hidden = false;
      $('login').style.display = 'grid';
      $('error').textContent = response?.error || 'Повторите вход';
    }
  });
});
