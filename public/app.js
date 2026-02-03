const socket = io();

let currentUser = null;
let currentMatch = null;
let currentPartner = null;
let countdownInterval = null;

// DOM 元素
const countdownScreen = document.getElementById('countdown-screen');
const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const chatScreen = document.getElementById('chat-screen');

const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const partnerNameEl = document.getElementById('partner-name');

// 倒數計時元素
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');

// 獲取台灣時間
function getTaiwanTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
}

// 顯示特定畫面
function showScreen(screen) {
    [countdownScreen, loginScreen, waitingScreen, chatScreen].forEach(s => {
        s.classList.add('hidden');
    });
    screen.classList.remove('hidden');
}

// 更新倒數計時
function updateCountdown(targetTime) {
    const now = getTaiwanTime().getTime();
    const diff = targetTime - now;
    
    if (diff <= 0) {
        clearInterval(countdownInterval);
        showScreen(loginScreen);
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
}

// 檢查開放時間
function checkOpenTime() {
    const now = getTaiwanTime();
    const hour = now.getHours();
    return hour >= 21 && hour <= 23;
}

// 加入聊天
joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('請輸入暱稱');
        return;
    }
    socket.emit('join', username);
});

// 按 Enter 加入
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

// 發送訊息
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentMatch) return;
    
    socket.emit('send_message', {
        matchId: currentMatch,
        message: message
    });
    
    messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// 顯示訊息
function displayMessage(messageData, isOwn) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    
    const time = new Date(messageData.timestamp).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        ${!isOwn ? `<div class="message-sender">${messageData.username}</div>` : ''}
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(messageData.message)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// HTML 轉義
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Socket 事件監聽

// 加入成功
socket.on('joined', (data) => {
    currentUser = data;
    console.log('加入成功:', data);
});

// 狀態更新
socket.on('status', (data) => {
    if (data.open) {
        showScreen(loginScreen);
    } else {
        showScreen(countdownScreen);
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        countdownInterval = setInterval(() => {
            updateCountdown(data.nextOpen);
        }, 1000);
        updateCountdown(data.nextOpen);
    }
});

// 等待配對
socket.on('waiting', (message) => {
    showScreen(waitingScreen);
});

// 配對成功
socket.on('matched', (data) => {
    currentMatch = data.matchId;
    currentPartner = data.partner;
    partnerNameEl.textContent = data.partner.username;
    messagesContainer.innerHTML = '';
    showScreen(chatScreen);
});

// 新訊息
socket.on('new_message', (messageData) => {
    const isOwn = messageData.userId === currentUser.userId;
    displayMessage(messageData, isOwn);
});

// 對方斷線
socket.on('partner_disconnected', () => {
    const notification = document.createElement('div');
    notification.className = 'message';
    notification.innerHTML = `
        <div style="text-align: center; padding: 15px; background: #fef2f2; border-radius: 10px; color: #dc2626; margin: 20px 0;">
            對方已離線
        </div>
    `;
    messagesContainer.appendChild(notification);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// 最後10分鐘倒數提醒
let warningShown = false;
socket.on('time_warning', (data) => {
    if (warningShown) return;
    warningShown = true;
    
    const minutes = Math.floor(data.remainingSeconds / 60);
    const seconds = data.remainingSeconds % 60;
    
    const notification = document.createElement('div');
    notification.className = 'message';
    notification.innerHTML = `
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 10px; color: #92400e; margin: 20px 0; font-weight: 600;">
            ⏰ 注意！還有 ${minutes} 分 ${seconds} 秒就要關閉了<br>
            <span style="font-size: 0.9em; font-weight: normal; margin-top: 8px; display: block;">建議和對方交換聯絡方式，明天再聊！</span>
        </div>
    `;
    messagesContainer.appendChild(notification);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// 定時檢查開放時間
socket.on('time_check', (data) => {
    if (!data.open && ![countdownScreen].some(s => !s.classList.contains('hidden'))) {
        // 如果不在開放時間且不在倒數畫面，顯示提示
        alert('已過開放時間，將返回倒數畫面');
        location.reload();
    }
});

// 初始化
if (checkOpenTime()) {
    showScreen(loginScreen);
} else {
    showScreen(countdownScreen);
    const now = getTaiwanTime();
    const nextOpen = new Date(now);
    nextOpen.setHours(21, 0, 0, 0);
    if (now.getHours() >= 21) {
        nextOpen.setDate(nextOpen.getDate() + 1);
    }
    countdownInterval = setInterval(() => {
        updateCountdown(nextOpen.getTime());
    }, 1000);
    updateCountdown(nextOpen.getTime());
}
