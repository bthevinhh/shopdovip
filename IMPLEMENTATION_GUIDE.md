# Hướng dẫn Cập nhật: Nhiệm vụ Có Thể Làm Nhiều Lần & Link4m Động

## 🎯 Tóm tắt thay đổi

### 1. **Nhiệm vụ Có Thể Làm Nhiều Lần/Ngày**
- **Trước**: Mỗi task chỉ làm được 1 lần, sau đó bị khóa vĩnh viễn
- **Sau**: Mỗi task có thể làm được nhiều lần/ngày với giới hạn admin đặt (0/2, 0/100, v.v.)
- Ví dụ: Admin tạo task "Xem trang A" với **maxAttempts: 2** → Người dùng có thể làm 2 lần/ngày

### 2. **Link4m Động (Tạo Mới Mỗi Lần)**
- **Trước**: Admin tạo link rút gọn sẵn, lưu vào DB, tất cả người dùng dùng link này
- **Sau**: Link4m được tạo **động** khi user bấm "🔗 Lấy link vượt" 
  - Tránh trùng lặp/spam
  - Mỗi người dùng + session có link riêng
  - Link được tạo trong lúc bấm, chứ không phải từ trước

---

## 📊 Thay đổi Cấu trúc Dữ liệu

### Task Document (Firestore: `tasks/{taskId}`)

**TRƯỚC:**
```javascript
{
  id: "t1234567890",
  title: "Xem trang giới thiệu",
  desc: "Vào trang này...",
  link: "https://link4m.co/abc123",  // ← Link rút gọn được tạo sẵn
  reward: 50,
  active: true,
  createdAt: 1720000000000
}
```

**SAU:**
```javascript
{
  id: "t1234567890",
  title: "Xem trang giới thiệu",
  desc: "Vào trang này...",
  link: "https://example.com/page",  // ← Link gốc (không rút gọn)
  reward: 50,
  maxAttempts: 2,                    // ← NEW: Giới hạn lượt/ngày (0 = vô hạn)
  active: true,
  createdAt: 1720000000000
}
```

### User Document (Firestore: `users/{username}`)

**TRƯỚC:**
```javascript
{
  username: "user123",
  displayName: "Tên người dùng",
  vcoin: 150,
  completedTaskIds: ["t1", "t2"],  // ← Danh sách task đã làm (mãi mãi)
}
```

**SAU:**
```javascript
{
  username: "user123",
  displayName: "Tên người dùng",
  vcoin: 150,
  completedTasks: {                // ← NEW: Theo dõi lượt làm theo ngày
    "t1": {
      count: 2,                     // ← Đã làm 2 lượt
      lastResetDate: "2026-07-12"   // ← Ngày reset cuối cùng
    },
    "t2": {
      count: 1,
      lastResetDate: "2026-07-12"
    }
  }
}
```

---

## 🔄 Luồng Công Việc Chi Tiết

### Flow 1: Tạo/Sửa Nhiệm Vụ (Admin)

```
Admin nhập form → Chọn "Link gốc" (chứ không phải link rút gọn)
                    ↓
                Nhập maxAttempts (2, 5, 100, 0 = vô hạn)
                    ↓
                Bấm "Lưu nhiệm vụ"
                    ↓
                Lưu vào Firestore (không cần Link4m lúc này)
```

**Thay đổi HTML form:**
- Xóa/ẩn nút "🔗 Tự động tạo (Link4m)" (không cần nữa)
- Thêm field "Giới hạn lượt/ngày (maxAttempts)"
  - Input: số từ 0 trở lên
  - 0 = vô hạn lượt, các số khác = giới hạn cụ thể

### Flow 2: Làm Nhiệm Vụ (User)

```
User vào tab Nhiệm vụ
         ↓
  Thấy task: "Xem trang A" [💰50 V-coin] [0/2]  ← Hiển thị "0/2" (đã làm 0, tối đa 2)
         ↓
  Bấm "🔗 Vượt link nhận thưởng"
         ↓
  ※ App tạo Link4m động:
      - Gọi API Link4m.co/api-shorten/v2
      - Truyền link quay về dài + taskId
      - Nhận link rút gọn
         ↓
  Mở tab mới: link rút gọn → trang của admin
         ↓
  User hoàn thành ở trang đó
         ↓
  Trang redirect về: ?claim=t1234567890
         ↓
  App check: còn lượt không?
      - Nếu còn → Cộng V-coin, tăng counter
      - Nếu hết → Thông báo "Đã hết lượt hôm nay"
```

**Thay đổi Task Card Display:**

**TRƯỚC:**
```
┌─────────────────────────┐
│ Xem trang giới thiệu    │
│ 💰 50 V-coin            │
│                         │
│ 🔗 Vượt link nhận...    │
│ ✅ Tôi đã hoàn thành    │
│ ✔ Đã nhận thưởng        │
└─────────────────────────┘
```

**SAU:**
```
┌─────────────────────────┐
│ Xem trang giới thiệu    │
│ 💰 50 V-coin | [0/2]    │ ← Hiển thị tiến độ
│                         │
│ 🔗 Lấy link vượt...     │ ← Tạo link động
│ ✅ Tôi đã hoàn thành    │
│ (Button bị disable nếu  │
│  hết lượt hôm nay)      │
└─────────────────────────┘
```

---

## 🛠️ Các Hàm Thay Đổi Chính

### 1. `shortenWithLink4mDynamic(longUrl)` [NEW]
```javascript
// TẠO LINK ĐỘNG KHI USER BẤMS
// Tương tự shortenWithLink4m nhưng được gọi từ startTask()
async function shortenWithLink4mDynamic(longUrl) {
  // Gọi API Link4m ngay lúc đó
  // Trả về link rút gọn
}
```

### 2. `getRemainingAttempts(username, taskId, maxAttempts)` [NEW]
```javascript
// Kiểm tra user còn bao nhiêu lượt cho task này hôm nay
// Logic:
//   - Lấy completedTasks[taskId] từ user doc
//   - Check lastResetDate === hôm nay?
//     - Nếu đúng: trả về (maxAttempts - count)
//     - Nếu sai: reset count = 0, trả về maxAttempts
```

### 3. `grantTaskReward(t)` [MODIFY]
```javascript
// TRƯỚC: check nếu task đã trong completedTaskIds → báo lỗi
// SAU: check nếu còn lượt?
//   - Có lượt → Cộng V-coin + tăng counter
//   - Hết lượt → Báo "Đã hết lượt hôm nay"
```

### 4. `renderTasks()` [MODIFY]
```javascript
// Hiển thị [X/maxAttempts] bên cạnh reward badge
// Logic tô màu:
//   - Còn lượt: button màu bình thường
//   - Hết lượt: button bị disable/mờ
```

### 5. `startTask(id)` [MODIFY]
```javascript
// TRƯỚC: Chỉ mở t.link sẵn
// SAU: 
//   1. Check còn lượt không
//   2. Nếu hết → showToast + return
//   3. Nếu còn → Tạo link rút gọn động
//   4. Rồi mở link đó
```

---

## 📋 Thay Đổi HTML (index.html)

### Trong Task Form (view-task-form):

**THÊM:**
```html
<label>Giới hạn lượt làm/ngày (0 = vô hạn lượt)</label>
<input type="text" id="tMaxAttempts" placeholder="VD: 2, 5, 100, 0" inputmode="numeric">
```

**XÓA/ẨN:**
```html
<!-- Xóa nút "🔗 Tự động tạo (Link4m)" vì không cần nữa -->
<!-- <button type="button" class="mini-btn" id="autoShortenBtn">...</button> -->
```

**ĐỔI TÊN:**
- Label "Link vượt (shortlink)" → "Link gốc (để rút gọn động)"
- Placeholder: "https://trang-của-bạn.com"

---

## 🔑 Chỉnh Sửa Chính Trong app.js

### A. Khai báo biến

```javascript
// Cập nhật structure user trong sesStorage
// completedTaskIds [] → completedTasks {}

// Ví dụ:
{
  username: "user123",
  vcoin: 100,
  completedTasks: {  // ← Cấu trúc mới
    "t1": {count: 2, lastResetDate: "2026-07-12"},
    "t2": {count: 1, lastResetDate: "2026-07-12"}
  }
}
```

### B. Tạo hàm hỗ trợ

```javascript
// 1. Hàm reset counter hàng ngày
function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// 2. Hàm lấy lượt còn lại
function getRemainingAttempts(username, taskId, maxAttempts) {
  if (maxAttempts === 0) return Infinity;  // Vô hạn
  
  const cur = getCurrentUser();
  if (!cur) return 0;
  
  const taskAttempt = cur.completedTasks?.[taskId] || {};
  const today = getTodayString();
  
  if (taskAttempt.lastResetDate !== today) {
    // Đã sang ngày mới → reset
    return maxAttempts;
  }
  
  return Math.max(0, maxAttempts - (taskAttempt.count || 0));
}

// 3. Hàm kiểm tra còn lượt
function hasAttemptLeft(username, taskId, maxAttempts) {
  return getRemainingAttempts(username, taskId, maxAttempts) > 0;
}
```

### C. Cập nhật grantTaskReward

```javascript
async function grantTaskReward(t){
  const cur = getCurrentUser();
  if(!cur) return {ok:false};
  
  // Check xem còn lượt không
  const remaining = getRemainingAttempts(cur.username, t.id, t.maxAttempts || 0);
  if(remaining <= 0 && t.maxAttempts > 0) {
    return {ok:false, error:'Bạn đã hết lượt làm nhiệm vụ này hôm nay.'};
  }
  
  const freshUser = await loadUserDoc(cur.username);
  if(!freshUser) return {ok:false};
  
  // Khởi tạo cấu trúc nếu chưa có
  if(!freshUser.completedTasks) freshUser.completedTasks = {};
  
  // Cập nhật counter
  const today = getTodayString();
  if(!freshUser.completedTasks[t.id]) {
    freshUser.completedTasks[t.id] = {count: 0, lastResetDate: today};
  }
  
  // Reset nếu sang ngày mới
  if(freshUser.completedTasks[t.id].lastResetDate !== today) {
    freshUser.completedTasks[t.id] = {count: 0, lastResetDate: today};
  }
  
  // Cộng V-coin + tăng counter
  freshUser.vcoin = (freshUser.vcoin||0) + (t.reward||0);
  freshUser.completedTasks[t.id].count += 1;
  
  const saved = await saveUserDoc(freshUser);
  if(!saved) return {ok:false};
  
  // Cập nhật local user
  setCurrentUser({
    username: cur.username,
    displayName: cur.displayName,
    vcoin: freshUser.vcoin,
    completedTasks: freshUser.completedTasks
  });
  
  return {ok:true};
}
```

### D. Cập nhật startTask

```javascript
window.startTask = async function(id){
  if(!isUserLoggedIn()){
    showToast('Vui lòng đăng nhập để làm nhiệm vụ.');
    openUserAuthModal('login');
    return;
  }
  
  const t = tasks.find(x=>x.id===id);
  if(!t || !t.link){ showToast('Nhiệm vụ chưa có link.'); return; }
  
  const cur = getCurrentUser();
  
  // Check xem còn lượt không
  const remaining = getRemainingAttempts(cur.username, id, t.maxAttempts || 0);
  if(remaining <= 0 && t.maxAttempts > 0) {
    showToast(`Bạn đã hết lượt làm nhiệm vụ này hôm nay. Quay lại ${getTodayString().split('-')[2]}/7 để làm lại.`);
    return;
  }
  
  // Tạo link rút gọn ĐỘNG
  let linkToOpen = t.link;
  
  if(appSettings.link4mApiKey && t.link) {
    try {
      const returnUrl = buildTaskReturnUrl(id);
      const btn = document.querySelector(`[onclick*="startTask('${id}')"]`);
      const originalText = btn ? btn.textContent : '';
      if(btn) btn.disabled = true;
      if(btn) btn.textContent = '🔗 Đang tạo link...';
      
      linkToOpen = await shortenWithLink4mDynamic(returnUrl);
      
      if(btn) btn.textContent = originalText;
      if(btn) btn.disabled = false;
    } catch(e) {
      console.error('Tạo link Link4m thất bại, mở link gốc:', e);
      // Fallback: mở link gốc nếu Link4m fail
    }
  }
  
  setTaskStartMarker(cur.username, id);
  window.open(linkToOpen, '_blank');
  startedTasks.add(id);
  renderTasks();
};
```

### E. Cập nhật renderTasks

```javascript
function renderTasks(){
  // ... code cũ ...
  
  list.innerHTML = visibleTasks.map(t=>{
    // Tính lượt còn lại
    const remaining = getRemainingAttempts(
      cur?.username || '',
      t.id,
      t.maxAttempts || 0
    );
    const attemptsLabel = t.maxAttempts === 0 
      ? 'Vô hạn' 
      : `${Math.max(0, (t.maxAttempts || 1) - remaining)}/${t.maxAttempts}`;
    
    // ... button actions ...
    if(admin){
      actionsHtml = '';
    } else if(!isUserLoggedIn()){
      actionsHtml = `<button class="stamp-btn" onclick="openUserAuthModal('login')">Đăng nhập để làm nhiệm vụ</button>`;
    } else if(remaining <= 0 && t.maxAttempts > 0){
      // ← THAY ĐỔI: Check lượt thay vì check completedTaskIds
      actionsHtml = `<button class="stamp-btn" disabled style="opacity:.5;cursor:not-allowed;">⏳ Hết lượt hôm nay</button>`;
    } else if(isStarted){
      actionsHtml = `
        <button class="ghost-btn" onclick="startTask('${t.id}')">🔗 Mở lại link</button>
        <button class="stamp-btn" onclick="confirmTaskDone('${t.id}')">✅ Tôi đã hoàn thành</button>
      `;
    } else {
      actionsHtml = `<button class="stamp-btn" onclick="startTask('${t.id}')">🔗 Vượt link nhận thưởng</button>`;
    }
    
    return `
    <div class="task-card">
      <div class="task-card-top">
        <div class="task-reward-badge">💰 ${t.reward||0} V-coin</div>
        <div class="task-attempts-badge">[${attemptsLabel}]</div>
        ${admin && t.active===false ? `<div class="task-inactive-badge">Đang tắt</div>` : ''}
      </div>
      <!-- ... rest ... -->
    </div>`;
  }).join('');
}
```

### F. Cập nhật autoClaimTaskFromReturn

```javascript
async function autoClaimTaskFromReturn(taskId){
  if(!isUserLoggedIn()){
    sessionStorage.setItem('pendingClaimTaskId', taskId);
    showToast('Vượt link thành công! Đăng nhập để nhận V-coin nhé.');
    switchView('tasks');
    openUserAuthModal('login');
    return;
  }
  
  const cur = getCurrentUser();
  const t = tasks.find(x=>x.id===taskId);
  if(!t){ showToast('Nhiệm vụ không tồn tại hoặc đã bị xoá.'); switchView('tasks'); return; }
  
  // ← THAY ĐỔI: Check lượt thay vì check completedTaskIds
  const remaining = getRemainingAttempts(cur.username, taskId, t.maxAttempts || 0);
  if(remaining <= 0 && t.maxAttempts > 0) {
    showToast('Bạn đã hết lượt làm nhiệm vụ này hôm nay.');
    switchView('tasks');
    renderTasks();
    return;
  }
  
  const result = await grantTaskReward(t);
  // ... rest ...
}
```

### G. Cập nhật saveTaskBtn

```javascript
document.getElementById('saveTaskBtn').addEventListener('click', async ()=>{
  if(!checkAdmin()) return;
  
  const title = document.getElementById('tTitle').value.trim();
  const desc = document.getElementById('tDesc').value.trim();
  const link = document.getElementById('tLink').value.trim();
  const rewardRaw = document.getElementById('tReward').value.trim();
  const maxAttemptsRaw = document.getElementById('tMaxAttempts').value.trim();  // ← NEW
  
  const reward = rewardRaw ? Math.max(0, parseInt(rewardRaw, 10) || 0) : 0;
  const maxAttempts = maxAttemptsRaw ? Math.max(0, parseInt(maxAttemptsRaw, 10) || 0) : 1;  // ← NEW
  const active = document.getElementById('tActive').checked;
  
  if(!title){ showToast('Vui lòng nhập tên nhiệm vụ.'); return; }
  if(!link){ showToast('Vui lòng nhập link gốc.'); return; }
  if(reward <= 0){ showToast('Vui lòng nhập số V-coin thưởng lớn hơn 0.'); return; }
  
  // ... rest ...
  
  let taskToSave;
  if(editingTaskId){
    const t = tasks.find(x=>x.id===editingTaskId);
    t.title = title; 
    t.desc = desc; 
    t.link = link; 
    t.reward = reward; 
    t.maxAttempts = maxAttempts;  // ← NEW
    t.active = active;
    taskToSave = t;
  } else {
    taskToSave = {
      id: currentFormTaskId || ('t'+Date.now()), 
      title, desc, link, reward, maxAttempts,  // ← NEW
      active, createdAt: Date.now()
    };
    tasks.push(taskToSave);
  }
  
  // ... rest ...
});
```

### H. Cập nhật User Login/Register

```javascript
// Khi khởi tạo user mới
function createNewUser(username, displayName) {
  return {
    username,
    displayName,
    vcoin: 0,
    completedTasks: {}  // ← Thay completedTaskIds
  };
}

// Khi load user từ Firestore
async function loadUserDoc(username) {
  // ... load from DB ...
  // Nếu là cấu trúc cũ (có completedTaskIds), migrate sang completedTasks
  if(doc.completedTaskIds && !doc.completedTasks) {
    doc.completedTasks = {};
    for(const taskId of doc.completedTaskIds) {
      doc.completedTasks[taskId] = {
        count: 1,
        lastResetDate: getTodayString()
      };
    }
  }
  return doc;
}
```

---

## 🎯 Tóm Tắt Công Việc Cần Làm

### Phase 1: Thay đổi HTML
- [ ] Thêm field `tMaxAttempts` vào form task
- [ ] Xóa/ẩn nút "Tự động tạo (Link4m)" trong form
- [ ] Thêm badge hiển thị `[X/maxAttempts]` trong task card

### Phase 2: Cập nhật JavaScript
- [ ] Tạo hàm hỗ trợ: `getTodayString()`, `getRemainingAttempts()`, `hasAttemptLeft()`
- [ ] Sửa `grantTaskReward()`: Check lượt thay vì completedTaskIds
- [ ] Sửa `startTask()`: Tạo Link4m động + check lượt
- [ ] Sửa `renderTasks()`: Hiển thị `[X/maxAttempts]` + disable button khi hết lượt
- [ ] Sửa `autoClaimTaskFromReturn()`: Check lượt
- [ ] Sửa event listener `saveTaskBtn`: Lưu maxAttempts

### Phase 3: Data Migration
- [ ] Thêm logic migrate user cũ: `completedTaskIds` → `completedTasks`
- [ ] Test với user cũ và user mới

### Phase 4: Testing
- [ ] Test tạo task mới với maxAttempts
- [ ] Test làm task nhiều lần (đúng giới hạn)
- [ ] Test reset counter qua ngày
- [ ] Test Link4m tạo động
- [ ] Test user cũ migration

---

## 📝 Ví Dụ Sử Dụng

### Ví dụ 1: Admin tạo task với giới hạn 2 lượt/ngày

```
Tên: "Xem video quảng cáo"
Link gốc: https://video.example.com/ad
Thưởng: 10 V-coin
Lượt/ngày: 2
```

→ Người dùng có thể làm 2 lần, mỗi lần được 10 coin (tổng 20 coin/ngày), ngày hôm sau reset.

### Ví dụ 2: Admin tạo task không giới hạn lượt

```
Tên: "Tham gia Discord"
Link gốc: https://discord.gg/abc
Thưởng: 5 V-coin
Lượt/ngày: 0  (= vô hạn)
```

→ Người dùng có thể làm vô hạn lần, mỗi lần được 5 coin.

### Ví dụ 3: User làm nhiệm vụ

```
[Ngày 12/7/2026, 10:00 AM]
User thấy: "Xem trang A" [💰50 V-coin] [0/2]
Bấm "🔗 Vượt link nhận thưởng"
  → App tạo link rút gọn động qua Link4m
  → Mở tab mới
  → Hoàn thành trang
  → Redirect về, app cộng 50 coin
  → Task card hiển thị [1/2]

[Sau 30 phút]
Bấm "🔗 Vượt link nhận thưởng" lần 2
  → Tạo link rút gọn MỚI động
  → Hoàn thành + cộng 50 coin
  → Task card hiển thị [2/2]
  → Button bị disable

[Ngày 13/7/2026]
Task card auto-reset → [0/2]
User có thể làm lại
```

---

## 🚀 Lợi Ích

1. **Tăng tương tác**: User có thể làm task nhiều lần → chênh lệch V-coin
2. **Tránh spam**: Link4m được tạo động → mỗi lần khác nhau
3. **Linh hoạt**: Admin điều chỉnh giới hạn dễ dàng
4. **Công bằng**: Reset hàng ngày → mọi user có cơ hội bằng nhau
5. **An toàn**: Không lưu link rút gọn → không sợ link hết hạn/bị vô hiệu

