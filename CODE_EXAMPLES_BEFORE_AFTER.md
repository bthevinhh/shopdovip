# Code Examples: Before & After

## 1. User Data Structure

### BEFORE: One-time tasks only
```javascript
// User document in Firestore
{
  username: "user123",
  displayName: "John Doe",
  vcoin: 150,
  completedTaskIds: ["t1", "t2", "t3"]  // Once done = forever marked
}

// Once task is in completedTaskIds, can never do it again
const isDone = user.completedTaskIds.includes(taskId);
if (isDone) {
  showMessage("Bạn đã nhận thưởng nhiệm vụ này rồi");
  return;
}
```

### AFTER: Multi-attempt with daily reset
```javascript
// User document in Firestore
{
  username: "user123",
  displayName: "John Doe",
  vcoin: 150,
  completedTasks: {
    "t1": { count: 2, lastResetDate: "2026-07-12" },
    "t2": { count: 1, lastResetDate: "2026-07-12" },
    "t3": { count: 0, lastResetDate: "2026-07-11" }
  }
}

// Can track how many times done TODAY
const attempts = user.completedTasks[taskId];
const today = getTodayString();
if (attempts?.lastResetDate === today) {
  const remaining = maxAttempts - attempts.count;
  showMessage(`Còn ${remaining}/${maxAttempts} lượt`);
}
```

**Benefits:**
- Track multiple completions per day
- Auto-reset next day
- Know exactly how many attempts used
- Can show progress to user [1/2], [2/5], etc.

---

## 2. Task Document Structure

### BEFORE: Pre-generated shortened link
```javascript
// Task document in Firestore
{
  id: "t1234567890",
  title: "Xem trang giới thiệu",
  desc: "Vào trang này...",
  link: "https://link4m.co/abc123xyz",  // ← FIXED shortened link
  reward: 50,
  active: true,
  createdAt: 1720000000000
}

// Admin created short link ONCE, all users use same link
window.open(task.link);  // Every user opens same link4m URL
```

**Problems:**
- Link might expire or get abused
- No way to track which user clicked which attempt
- All users sharing same link can cause issues

### AFTER: Dynamic link generation
```javascript
// Task document in Firestore
{
  id: "t1234567890",
  title: "Xem trang giới thiệu",
  desc: "Vào trang này...",
  link: "https://example.com/page",  // ← ORIGINAL link (not shortened)
  reward: 50,
  maxAttempts: 2,                    // ← NEW: Limit attempts per day
  active: true,
  createdAt: 1720000000000
}

// App creates NEW short link EACH TIME user clicks
// In startTask():
const returnUrl = buildTaskReturnUrl(taskId);
const shortUrl = await shortenWithLink4mDynamic(returnUrl);
window.open(shortUrl);  // NEW short link every time!
```

**Benefits:**
- Each user gets unique link
- Each attempt gets unique link
- Links don't expire (created fresh)
- Better tracking & security

---

## 3. Checking Task Completion

### BEFORE: Simple array check (one-time only)
```javascript
// Check if user already did this task
if ((user.completedTaskIds || []).includes(taskId)) {
  // Task already done, show "Đã nhận thưởng"
  return {
    ok: false,
    message: "Bạn đã nhận thưởng nhiệm vụ này rồi"
  };
}

// If not in array, allow
await grantReward(taskId);
user.completedTaskIds.push(taskId);
```

**Limitation:** Once done, always locked

### AFTER: Attempt counter with daily reset
```javascript
// Check if user has attempts left TODAY
const attempts = user.completedTasks?.[taskId] || {};
const today = getTodayString();

// Reset counter if new day
if (attempts.lastResetDate !== today) {
  attempts = { count: 0, lastResetDate: today };
}

// Check remaining attempts
const remaining = Math.max(0, maxAttempts - attempts.count);

if (remaining <= 0) {
  // No attempts left
  return {
    ok: false,
    message: "Bạn đã hết lượt làm nhiệm vụ này hôm nay"
  };
}

// Still have attempts, allow
await grantReward(taskId);
attempts.count += 1;
```

**Benefits:**
- Can do same task multiple times per day
- Automatically resets next day
- No manual reset needed
- Fair for all users

---

## 4. Function: grantTaskReward()

### BEFORE: Check completedTaskIds
```javascript
async function grantTaskReward(task) {
  const user = await loadUserDoc(getCurrentUser().username);
  
  // Check if ALREADY in the array (permanent)
  if ((user.completedTaskIds || []).includes(task.id)) {
    return { ok: true, alreadyDone: true };
  }
  
  // Add to array (permanent)
  user.completedTaskIds.push(task.id);
  user.vcoin += task.reward;
  
  await saveUserDoc(user);
  return { ok: true };
}
```

**Problems:**
- Once added, can never remove
- No way to track multiple attempts
- No daily reset

### AFTER: Track with daily counter
```javascript
async function grantTaskReward(task) {
  const user = await loadUserDoc(getCurrentUser().username);
  
  // Initialize if needed
  if (!user.completedTasks) {
    user.completedTasks = {};
  }
  
  const today = getTodayString();
  const taskAttempt = user.completedTasks[task.id] || {};
  
  // Reset if new day
  if (taskAttempt.lastResetDate !== today) {
    taskAttempt = { count: 0, lastResetDate: today };
  }
  
  // Check if still has attempts
  if (taskAttempt.count >= (task.maxAttempts || 1)) {
    return {
      ok: false,
      error: "Bạn đã hết lượt làm nhiệm vụ này hôm nay"
    };
  }
  
  // Grant reward
  taskAttempt.count += 1;
  user.completedTasks[task.id] = taskAttempt;
  user.vcoin += task.reward;
  
  await saveUserDoc(user);
  return { ok: true };
}
```

**Benefits:**
- Tracks multiple completions
- Daily reset automatic
- Can check how many left
- Better error messages

---

## 5. Function: startTask()

### BEFORE: Just open the pre-saved link
```javascript
window.startTask = function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  
  // Just open the link (already shortened by admin)
  window.open(task.link, '_blank');
  
  // Mark as started
  setTaskStartMarker(taskId);
};
```

**Problems:**
- All users share same link
- No dynamic generation
- No attempt checking

### AFTER: Generate link dynamically + check attempts
```javascript
window.startTask = async function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  const user = getCurrentUser();
  
  // CHECK ATTEMPTS FIRST
  const remaining = getRemainingAttempts(
    user.username,
    taskId,
    task.maxAttempts || 1
  );
  
  if (remaining <= 0) {
    showToast("Bạn đã hết lượt làm nhiệm vụ này hôm nay");
    return;
  }
  
  // CREATE LINK DYNAMICALLY
  let linkToOpen = task.link;
  
  if (appSettings.link4mApiKey) {
    try {
      const returnUrl = buildTaskReturnUrl(taskId);
      linkToOpen = await shortenWithLink4mDynamic(returnUrl);
    } catch (e) {
      console.error("Failed to shorten link:", e);
      // Fall back to return URL
      linkToOpen = returnUrl;
    }
  }
  
  // Open the dynamically created link
  window.open(linkToOpen, '_blank');
  setTaskStartMarker(taskId);
};
```

**Benefits:**
- Checks attempts before opening
- New short link every time
- Falls back gracefully if API fails
- Better user experience

---

## 6. Rendering Task Card

### BEFORE: Show "Đã nhận thưởng" (one-time only)
```javascript
function renderTasks() {
  const user = getCurrentUser();
  const completedIds = user?.completedTaskIds || [];
  
  tasks.forEach(task => {
    const isDone = completedIds.includes(task.id);
    
    if (isDone) {
      // Show locked message
      html += `<button disabled>✔ Đã nhận thưởng</button>`;
    } else {
      // Show get rewards button
      html += `<button onclick="startTask('${task.id}')">🔗 Vượt link</button>`;
    }
  });
}
```

**Display:**
```
✔ Đã nhận thưởng  (forever locked)
```

### AFTER: Show attempts left
```javascript
function renderTasks() {
  const user = getCurrentUser();
  
  tasks.forEach(task => {
    const remaining = getRemainingAttempts(
      user.username,
      task.id,
      task.maxAttempts || 1
    );
    
    // Display attempt counter
    const display = `[${task.maxAttempts - remaining}/${task.maxAttempts}]`;
    html += `<span class="badge">${display}</span>`;
    
    if (remaining <= 0) {
      // Hết lượt
      html += `<button disabled>⏳ Hết lượt hôm nay</button>`;
    } else {
      // Còn lượt
      html += `<button onclick="startTask('${task.id}')">🔗 Vượt link</button>`;
    }
  });
}
```

**Display:**
```
[0/2]  🔗 Vượt link        (can do 2 times)
[1/2]  🔗 Vượt link        (can do 1 more time)
[2/2]  ⏳ Hết lượt hôm nay  (no more attempts today)

Next day automatically resets to [0/2]
```

---

## 7. User Login - Initialize

### BEFORE: Simple array init
```javascript
function createNewUser(username, displayName) {
  return {
    username,
    displayName,
    vcoin: 0,
    completedTaskIds: []  // Empty array
  };
}
```

### AFTER: New structure
```javascript
function createNewUser(username, displayName) {
  return {
    username,
    displayName,
    vcoin: 0,
    completedTasks: {}  // Empty object
  };
}
```

**Difference:**
- Array: `[taskId1, taskId2]` - just a list
- Object: `{taskId1: {count, date}, taskId2: {count, date}}` - tracks details

---

## 8. Backward Compatibility - Data Migration

### BEFORE: Old user data in DB
```javascript
{
  username: "olduser",
  displayName: "Old User",
  vcoin: 100,
  completedTaskIds: ["t1", "t2"]  // Old structure
}
```

### AFTER: Auto-migrate when loading
```javascript
async function loadUserDocWithMigration(username) {
  const doc = await loadUserDoc(username);
  
  // If old structure exists, migrate it
  if (doc.completedTaskIds && !doc.completedTasks) {
    const today = getTodayString();
    doc.completedTasks = {};
    
    // Convert array to object
    for (const taskId of doc.completedTaskIds) {
      doc.completedTasks[taskId] = {
        count: 1,
        lastResetDate: today
      };
    }
    
    // Optionally save back
    await saveUserDoc(doc);
  }
  
  return doc;
}
```

**Result:**
```javascript
// Old structure:
{ completedTaskIds: ["t1", "t2"] }

// Becomes:
{ 
  completedTasks: {
    "t1": { count: 1, lastResetDate: "2026-07-12" },
    "t2": { count: 1, lastResetDate: "2026-07-12" }
  }
}
```

**Important:** 
- Old users can still use the system
- No data lost
- Auto-migrated on first load
- Seamless upgrade

---

## 9. API: shortenWithLink4m

### BEFORE: Called by admin (one time)
```javascript
// In admin form when saving task
async function saveTask() {
  const link = "https://example.com/page";
  
  // Admin manually clicks "Tự động tạo"
  const shortLink = await shortenWithLink4m(link);
  task.link = shortLink;  // Save shortened link
  
  // Later, user gets the saved link
  window.open(task.link);  // Opens pre-shortened link
}
```

**Problem:** Same link for all attempts

### AFTER: Called dynamically (every time)
```javascript
// In user's startTask() when they click button
window.startTask = async function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  
  // Generate SHORT link DYNAMICALLY
  const returnUrl = buildTaskReturnUrl(taskId);
  const shortLink = await shortenWithLink4mDynamic(returnUrl);
  
  // Each time, new short link is created
  window.open(shortLink);
}
```

**Benefits:**
- New link for each attempt
- User-specific links
- Better tracking
- Harder to cheat/abuse

---

## 10. Error Messages

### BEFORE: Limited feedback
```javascript
// Only two states:
// 1. "Bạn đã nhận thưởng nhiệm vụ này rồi" (forever)
// 2. Button is active (can do)
```

### AFTER: Informative messages
```javascript
// Multiple informative states:

// No attempts left
"Bạn đã hết lượt làm nhiệm vụ này hôm nay"

// Check attempts
const remaining = getRemainingAttempts(...);
if (remaining === 1) {
  "Còn 1 lượt duy nhất trong hôm nay"
} else if (remaining > 1) {
  `Còn ${remaining}/${maxAttempts} lượt`
}

// No API key
"Chưa cấu hình API Key Link4m. Vào tab Cài đặt..."

// API failed
"Không thể tạo link rút gọn, sẽ sử dụng link gốc"
```

**Better UX:** Users understand why button is disabled/enabled

---

## 11. Testing Examples

### BEFORE: Test one-time completion
```javascript
// Test 1: First completion
user.completedTaskIds = [];
await grantTaskReward(task);
assert(user.completedTaskIds.includes(task.id));

// Test 2: Try again - should fail
const result = await grantTaskReward(task);
assert(result.alreadyDone === true);

// Can never do again (even next day)
user.completedTaskIds; // Still contains taskId
```

### AFTER: Test multi-attempt with daily reset
```javascript
// Test 1: First completion on day 1
user.completedTasks = {};
const today = getTodayString();
await grantTaskReward(task);  // maxAttempts = 2
assert(user.completedTasks[task.id].count === 1);

// Test 2: Second completion on day 1
await grantTaskReward(task);
assert(user.completedTasks[task.id].count === 2);

// Test 3: Third attempt on day 1 - should fail
const result = await grantTaskReward(task);
assert(result.ok === false);

// Test 4: Next day - simulate date change
user.completedTasks[task.id].lastResetDate = "2026-07-13";
const result = await grantTaskReward(task);
assert(result.ok === true);  // Can do again!
assert(user.completedTasks[task.id].count === 1);  // Counter reset
```

---

## 12. Admin Settings Form

### BEFORE: Only API key
```html
<label>API Key Link4m</label>
<input id="link4mApiKey" placeholder="Dán API Key vào đây">
<!-- Use Link4m to pre-create short links for tasks -->
```

### AFTER: API key + task limit info
```html
<label>API Key Link4m</label>
<input id="link4mApiKey" placeholder="Dán API Key vào đây">
<p style="font-size:12px;color:gray;">
  API Key được sử dụng để tự động tạo link rút gọn khi user bấm "Vượt link". 
  Link được tạo mới mỗi lần để tránh trùng lặp và spam.
</p>

<label>Giới hạn số nhiệm vụ đang hoạt động cùng lúc</label>
<input id="maxActiveTasks" placeholder="0 = không giới hạn">
```

**Note:** Individual task limit is per-task (maxAttempts), not global

---

## Summary Table

| Aspect | Before | After |
|--------|--------|-------|
| **User Data** | `completedTaskIds: []` | `completedTasks: {taskId: {count, date}}` |
| **Task Link** | Shortened (fixed) | Original (dynamic shortening) |
| **Max Attempts** | 1 (fixed) | Configurable per task |
| **Reset** | Never | Daily (automatic) |
| **Tracking** | Just "done or not" | Counter per task |
| **Link4m Calls** | Once per task | Once per attempt |
| **User Message** | "Đã nhận thưởng" | "[X/maxAttempts]" + "Còn X lượt" |
| **Difficulty** | Simple | Medium |

