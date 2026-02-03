const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;

// 記憶體儲存
const users = new Map(); // socketId -> user info
const waitingQueue = []; // 等待配對的用戶
const matches = new Map(); // matchId -> {user1, user2, messages, messageCount}
const userMatches = new Map(); // userId -> current matchId

// 靜態文件服務
app.use(express.static('public'));

// 檢查是否在開放時間（晚上9點到12點）
function isOpenTime() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 21 && hour <= 23; // 21:00 - 23:59
}

// 檢查是否在最後10分鐘（23:50-23:59）
function isLastTenMinutes() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  return hour === 23 && minute >= 50;
}

// 計算剩餘時間（秒）
function getTimeRemaining() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
}

// Socket.io 連線處理
io.on('connection', (socket) => {
  console.log('用戶連線:', socket.id);

  // 用戶加入
  socket.on('join', (username) => {
    const userId = uuidv4();
    users.set(socket.id, {
      id: userId,
      username: username || `用戶${socket.id.substring(0, 5)}`,
      socketId: socket.id
    });

    socket.emit('joined', { userId, username: users.get(socket.id).username });

    // 檢查開放時間
    if (isOpenTime()) {
      socket.emit('status', { open: true });
      // 自動加入配對隊列
      addToQueue(socket);
    } else {
      const now = new Date();
      const nextOpen = new Date(now);
      nextOpen.setHours(21, 0, 0, 0);
      if (now.getHours() >= 21) {
        nextOpen.setDate(nextOpen.getDate() + 1);
      }
      socket.emit('status', { open: false, nextOpen: nextOpen.getTime() });
    }
  });

  // 加入配對隊列
  function addToQueue(socket) {
    if (!isOpenTime()) {
      socket.emit('error', '現在不在開放時間');
      return;
    }

    const user = users.get(socket.id);
    if (!user) return;

    // 檢查是否已在隊列中
    if (waitingQueue.find(u => u.socketId === socket.id)) {
      return;
    }

    waitingQueue.push(user);
    socket.emit('waiting', '正在尋找配對對象...');

    // 嘗試配對
    tryMatch();
  }

  // 嘗試配對
  function tryMatch() {
    while (waitingQueue.length >= 2) {
      const user1 = waitingQueue.shift();
      const user2 = waitingQueue.shift();

      const matchId = uuidv4();
      matches.set(matchId, {
        user1: user1,
        user2: user2,
        messages: [],
        messageCount: { [user1.id]: 0, [user2.id]: 0 },
        friendRequestSent: false
      });

      userMatches.set(user1.id, matchId);
      userMatches.set(user2.id, matchId);

      // 通知雙方配對成功
      io.to(user1.socketId).emit('matched', {
        matchId,
        partner: { id: user2.id, username: user2.username }
      });
      io.to(user2.socketId).emit('matched', {
        matchId,
        partner: { id: user1.id, username: user1.username }
      });

      // 如果在最後10分鐘，立即發送倒數提醒
      if (isLastTenMinutes()) {
        const remaining = getTimeRemaining();
        io.to(user1.socketId).emit('time_warning', { remainingSeconds: remaining });
        io.to(user2.socketId).emit('time_warning', { remainingSeconds: remaining });
      }
    }
  }

  // 發送訊息
  socket.on('send_message', ({ matchId, message }) => {
    const match = matches.get(matchId);
    const user = users.get(socket.id);
    
    if (!match || !user) return;

    const messageData = {
      id: uuidv4(),
      userId: user.id,
      username: user.username,
      message: message,
      timestamp: Date.now()
    };

    match.messages.push(messageData);

    // 發送給雙方
    io.to(match.user1.socketId).emit('new_message', messageData);
    io.to(match.user2.socketId).emit('new_message', messageData);
  });

  // 斷線處理
  socket.on('disconnect', () => {
    console.log('用戶斷線:', socket.id);
    
    // 從等待隊列移除
    const queueIndex = waitingQueue.findIndex(u => u.socketId === socket.id);
    if (queueIndex > -1) {
      waitingQueue.splice(queueIndex, 1);
    }

    // 通知配對對象
    const user = users.get(socket.id);
    if (user) {
      const matchId = userMatches.get(user.id);
      if (matchId) {
        const match = matches.get(matchId);
        if (match) {
          const partnerId = match.user1.id === user.id ? match.user2.socketId : match.user1.socketId;
          io.to(partnerId).emit('partner_disconnected');
        }
        userMatches.delete(user.id);
      }
    }

    users.delete(socket.id);
  });
});

// 定期檢查開放時間和最後10分鐘提醒
setInterval(() => {
  const open = isOpenTime();
  io.emit('time_check', { open });
  
  // 如果在最後10分鐘，發送倒數提醒給所有在線用戶
  if (isLastTenMinutes()) {
    const remaining = getTimeRemaining();
    io.emit('time_warning', { remainingSeconds: remaining });
  }
}, 60000); // 每分鐘檢查一次

http.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});
