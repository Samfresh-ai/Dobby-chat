const chat = document.getElementById('chat');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const botName = document.getElementById('botName');

const urlParams = new URLSearchParams(window.location.search);
const bot = urlParams.get('bot') || 'ANI';

botName.textContent = bot === 'ARI' ? '💋 Chat with ARI' : '🧢 Chat with ANI';

function appendMessage(text, sender) {
  const div = document.createElement('div');
  div.className = `message ${sender}`;

  const avatar = document.createElement('span');
  avatar.style.fontSize = '1.5rem';
  avatar.style.marginRight = '0.5rem';

  if (sender === 'user') {
    avatar.textContent = '🧍‍♂️';
  } else {
    avatar.textContent = bot === 'ARI' ? '💄' : '🧢';
  }

  const span = document.createElement('span');
  span.textContent = text;

  div.appendChild(avatar);
  div.appendChild(span);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  appendMessage(message, 'user');
  input.value = '';
  appendMessage(`${bot} is typing...`, 'bot');

  try {
    const res = await fetch(`/api/chat/${bot}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    chat.removeChild(chat.lastChild); // remove "typing"
    appendMessage(data.reply, 'bot');
  } catch (err) {
    chat.removeChild(chat.lastChild);
    appendMessage('⚠️ Something went wrong.', 'bot');
  }
}

sendBtn.onclick = sendMessage;
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
