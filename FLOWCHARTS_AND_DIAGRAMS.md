# Flowcharts & Visual Diagrams

## 1. User Completes Task Multiple Times

```
┌─────────────────────────────────────────────────────────────────┐
│ DAY 1 - User can do task 2 times (maxAttempts: 2)              │
└─────────────────────────────────────────────────────────────────┘

                    9:00 AM
                       │
                       ▼
        ┌──────────────────────────┐
        │ View Task Card           │
        │ "Xem trang A"            │
        │ 💰 50 V-coin | [0/2]    │  ← Shows 0 of 2 attempts
        │                          │
        │ 🔗 Vượt link nhận thưởng │
        └──────────────────────────┘
                       │
                       │ Click button
                       ▼
        ┌──────────────────────────┐
        │ Check remaining attempts │
        │ ✓ remaining = 2          │
        │ ✓ Can proceed            │
        └──────────────────────────┘
                       │
                       │ Create Link4m dynamically
                       ▼
        ┌──────────────────────────┐
        │ API: shortenWithLink4m   │
        │ Input: return URL +      │
        │        taskId            │
        │ Output: short URL        │
        └──────────────────────────┘
                       │
                       │ Open new tab
                       ▼
        ┌──────────────────────────┐
        │ User completes task      │
        │ (watch ad, view page,    │
        │  fill form, etc.)        │
        └──────────────────────────┘
                       │
                       │ Redirect with ?claim=taskId
                       ▼
        ┌──────────────────────────┐
        │ Auto-claim reward        │
        │ ✓ Grant +50 V-coin       │
        │ ✓ Count: 0→1             │
        │ ✓ Update display         │
        └──────────────────────────┘
                       │
                       │ Refresh display
                       ▼
        ┌──────────────────────────┐
        │ View Task Card (Updated) │
        │ "Xem trang A"            │
        │ 💰 50 V-coin | [1/2]    │  ← Now shows 1 of 2
        │                          │
        │ 🔗 Vượt link nhận thưởng │  ← Still clickable
        └──────────────────────────┘
                       │
                       │ Click again
                       ▼
        ┌──────────────────────────┐
        │ Check remaining attempts │
        │ ✓ remaining = 1          │
        │ ✓ Can proceed            │
        └──────────────────────────┘
                       │
                       │ Create NEW Link4m link
                       ▼
        ┌──────────────────────────┐
        │ Different short URL      │
        │ (different from 1st one) │
        └──────────────────────────┘
                       │
                       │ Complete task again
                       ▼
        ┌──────────────────────────┐
        │ Auto-claim second reward │
        │ ✓ Grant +50 V-coin       │
        │ ✓ Count: 1→2             │
        │ ✓ Update display         │
        └──────────────────────────┘
                       │
                       │ Refresh display
                       ▼
        ┌──────────────────────────┐
        │ View Task Card (Final)   │
        │ "Xem trang A"            │
        │ 💰 50 V-coin | [2/2]    │  ← Shows 2 of 2
        │                          │
        │ ⏳ Hết lượt hôm nay       │  ← Button disabled!
        └──────────────────────────┘
                       │
                       │ 11:59:59 PM (midnight approaches)
                       ▼
        ┌──────────────────────────┐
        │ DAY 2 - System resets!   │
        │ Counter: 2→0             │
        │ Date: "2026-07-12"→      │
        │       "2026-07-13"       │
        └──────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ View Task Card (Next Day)│
        │ "Xem trang A"            │
        │ 💰 50 V-coin | [0/2]    │  ← Reset to 0!
        │                          │
        │ 🔗 Vượt link nhận thưởng │  ← Enabled again
        └──────────────────────────┘
```

---

## 2. Data Flow: Task Completion

```
USER CLICKS BUTTON
        │
        ▼
    startTask(taskId)
        │
        ├─→ Check: isUserLoggedIn()? ─No──→ Show login modal
        │
        ├─→ Check: remaining attempts? ─No──→ Show "Hết lượt"
        │
        ├─→ Generate short link
        │   │
        │   ├─→ Has Link4m API key?
        │   │   │
        │   │   ├─Yes──→ shortenWithLink4mDynamic()
        │   │   │            │
        │   │   │            ├─→ API call to link4m.co
        │   │   │            │   
        │   │   │            ├─→ Success? Use short URL
        │   │   │            │
        │   │   │            └─→ Fail? Fall back to return URL
        │   │   │
        │   │   └─No──→ Use return URL directly
        │   │
        │   └─→ Set taskStartMarker (local storage)
        │
        ├─→ Open link in new tab
        │
        └─→ renderTasks() - update UI

TASK COMPLETION PAGE
        │
        ▼
    User completes (watches ad, fills form, etc.)
        │
        ▼
    Redirect to: ?claim=taskId
        │
        ▼
    autoClaimTaskFromReturn(taskId)
        │
        ├─→ Check: taskStartMarker exists? ─No──→ Ask user to try again
        │
        ├─→ Check: remaining attempts? ─No──→ Show "Hết lượt"
        │
        ├─→ grantTaskReward(task)
        │   │
        │   ├─→ Load user from Firestore
        │   │
        │   ├─→ Get completedTasks[taskId]
        │   │   │
        │   │   ├─→ Check: lastResetDate === today?
        │   │   │   ├─No (new day)──→ Reset count to 0
        │   │   │   └─Yes (same day)──→ Keep count
        │   │   │
        │   │   └─→ Check: count < maxAttempts?
        │   │       ├─No──→ Return error
        │   │       └─Yes──→ Increment count
        │   │
        │   ├─→ Add reward to vcoin
        │   │
        │   ├─→ Save user to Firestore
        │   │
        │   └─→ Update local user state
        │
        ├─→ Clear taskStartMarker (local storage)
        │
        └─→ renderTasks() - update UI
            │
            └─→ Display new counter [1/2]
```

---

## 3. Admin Creates Task: Before vs After

### BEFORE (One-time links)
```
ADMIN CREATES TASK
        │
        ▼
┌─────────────────────────────┐
│ Fill form:                  │
│ - Title: "Task A"           │
│ - Link: [empty]             │
│ - Reward: 50                │
└─────────────────────────────┘
        │
        │ Click "Tự động tạo Link4m"
        ▼
┌─────────────────────────────┐
│ App creates short link      │
│ (ONE TIME)                  │
│ Output: link4m.co/abc123    │
└─────────────────────────────┘
        │
        │ Fill into form
        ▼
┌─────────────────────────────┐
│ Link field:                 │
│ "https://link4m.co/abc123"  │
└─────────────────────────────┘
        │
        │ Click "Lưu nhiệm vụ"
        ▼
┌─────────────────────────────┐
│ Save to Firestore           │
│ {                           │
│   id: "t123",               │
│   title: "Task A",          │
│   link: "link4m.co/abc123"  │
│   reward: 50                │
│ }                           │
└─────────────────────────────┘
        │
        ▼
EVERY USER GETS SAME LINK
    │
    ├─→ User 1: link4m.co/abc123 ← same for everyone
    ├─→ User 2: link4m.co/abc123 ← same for everyone  
    └─→ User 3: link4m.co/abc123 ← same for everyone

PROBLEMS:
- Link can expire
- All users share same link
- No tracking which user/attempt
- Can't change link per task
```

### AFTER (Dynamic links)
```
ADMIN CREATES TASK
        │
        ▼
┌─────────────────────────────┐
│ Fill form:                  │
│ - Title: "Task A"           │
│ - Link: [paste original]    │
│ - Reward: 50                │
│ - Max Attempts: 2           │
└─────────────────────────────┘
        │
        │ No need for "Tự động tạo" button
        │ (removed in new version)
        │
        ▼
┌─────────────────────────────┐
│ Link field:                 │
│ "https://example.com/page"  │ ← Original link
└─────────────────────────────┘
        │
        │ Click "Lưu nhiệm vụ"
        ▼
┌─────────────────────────────┐
│ Save to Firestore           │
│ {                           │
│   id: "t123",               │
│   title: "Task A",          │
│   link: "example.com/page"  │ ← Original
│   reward: 50,               │
│   maxAttempts: 2            │
│ }                           │
└─────────────────────────────┘
        │
        ▼
EACH USER/ATTEMPT GETS NEW LINK
    │
    ├─→ User 1, Attempt 1: link4m.co/xyz111
    ├─→ User 1, Attempt 2: link4m.co/xyz222 ← DIFFERENT!
    ├─→ User 2, Attempt 1: link4m.co/abc333
    └─→ User 2, Attempt 1: link4m.co/abc444 ← DIFFERENT!

BENEFITS:
✓ Fresh link each time
✓ No expiration issues
✓ Unique per user/attempt
✓ Better tracking
✓ Harder to abuse/spam
```

---

## 4. Data Structure Evolution

```
USER: OLD vs NEW

OLD STRUCTURE (completedTaskIds: [])
┌──────────────────────────────────┐
│ {                                │
│   username: "user123",           │
│   displayName: "John",           │
│   vcoin: 100,                    │
│   completedTaskIds: [           │
│     "t1",                        │ ← Task marked as done
│     "t2",                        │ ← Forever
│     "t3"                         │
│   ]                              │
│ }                                │
└──────────────────────────────────┘
        │
        │ Auto-migration on load
        │
        ▼
NEW STRUCTURE (completedTasks: {})
┌──────────────────────────────────────┐
│ {                                    │
│   username: "user123",               │
│   displayName: "John",               │
│   vcoin: 100,                        │
│   completedTasks: {                 │
│     "t1": {                         │
│       count: 2,                     │ ← Done 2 times
│       lastResetDate: "2026-07-12"   │ ← Reset on this date
│     },                              │
│     "t2": {                         │
│       count: 1,                     │
│       lastResetDate: "2026-07-11"   │
│     },                              │
│     "t3": {                         │
│       count: 3,                     │
│       lastResetDate: "2026-07-12"   │
│     }                               │
│   }                                 │
│ }                                   │
└──────────────────────────────────────┘
```

---

## 5. Attempt Counter Reset Logic

```
DAILY RESET MECHANISM

Day 1: 2026-07-12
┌─────────────────────────┐
│ completedTasks: {       │
│   "t1": {               │
│     count: 2,           │
│     lastResetDate:      │
│       "2026-07-12"      │ ← Today's date
│   }                     │
│ }                       │
└─────────────────────────┘
        │
        │ Check remaining attempts:
        │ remaining = maxAttempts - count
        │ remaining = 2 - 2 = 0
        │ → Button disabled
        │
        ▼ (Time passes, it's now 12:00 AM)
        │
        ▼
Day 2: 2026-07-13
┌─────────────────────────┐
│ User loads page         │
│                         │
│ Check: lastResetDate    │
│ "2026-07-12" != "2026-07-13"  ← Different day!
│                         │
│ → RESET:                │
│ {                       │
│   count: 0,             │
│   lastResetDate:        │
│     "2026-07-13"        │ ← Update to today
│ }                       │
└─────────────────────────┘
        │
        │ Check remaining:
        │ remaining = 2 - 0 = 2
        │ → Button enabled again!
        │
        ▼
┌─────────────────────────┐
│ Display [0/2]           │
│ User can do task 2x     │
│ again today             │
└─────────────────────────┘
```

---

## 6. Link4m API Call Flow

```
USER CLICKS "VƯỢT LINK"
        │
        ▼
    startTask(taskId)
        │
        ├─→ Check: task has link? ✓
        │
        ├─→ Check: API key configured?
        │   │
        │   ├─No──→ Use original link: window.open(task.link)
        │   │
        │   └─Yes──→ Call shortenWithLink4mDynamic()
        │           │
        │           ▼ (async function)
        │       ┌─────────────────────────────────────┐
        │       │ Build return URL:                   │
        │       │ example.com?claim=t123&user=user1   │
        │       └─────────────────────────────────────┘
        │           │
        │           ▼
        │       ┌─────────────────────────────────────┐
        │       │ API Call:                           │
        │       │ GET link4m.co/api-shorten/v2?      │
        │       │   api=[key]                         │
        │       │   url=[encoded_return_url]          │
        │       │   format=text                       │
        │       └─────────────────────────────────────┘
        │           │
        │           ├─→ Success (200 OK)
        │           │   │
        │           │   ▼
        │           │ Response: link4m.co/xyz789
        │           │ (NEW short link, different each time)
        │           │
        │           └──→ Return short URL
        │
        │       OR
        │
        │           ├─→ Network error
        │           │   │
        │           │   ▼
        │           │ Log error
        │           │ Fall back to return URL
        │           │
        │           └──→ Return original URL
        │
        └──→ window.open(linkToOpen)
                    │
                    ▼
            Open in new tab
                    │
                    ▼
            User completes task
                    │
                    ▼
            Redirect to return URL
                    │
                    ▼
            autoClaimTaskFromReturn()
                    │
                    ▼
            Grant reward + increment counter
```

---

## 7. State Machine: Task Button States

```
┌──────────────────────────────────────────────────────┐
│                   BUTTON STATES                      │
└──────────────────────────────────────────────────────┘

START: Not logged in
┌────────────────────────────────────────┐
│ Button: "Đăng nhập để làm nhiệm vụ"   │
│ Action: Opens login modal              │
│ Color: Primary                         │
└────────────────────────────────────────┘
    │
    │ User logs in
    ▼
Logged in, has attempts left
┌────────────────────────────────────────┐
│ Button: "🔗 Vượt link nhận thưởng"    │
│ Action: Generate link + open new tab   │
│ Color: Green/Success                   │
└────────────────────────────────────────┘
    │
    │ Click button
    ▼
Task started, waiting for completion
┌────────────────────────────────────────┐
│ Button: "✅ Tôi đã hoàn thành"        │
│ Action: Confirm completion             │
│ Color: Blue/Info                       │
└────────────────────────────────────────┘
    │
    │ User completes + returns
    ▼
Has more attempts (but not maxed)
┌────────────────────────────────────────┐
│ Button: "🔗 Vượt link nhận thưởng"    │
│ Status: [1/2]                          │
│ Action: Generate new link + open       │
│ Color: Green/Success                   │
└────────────────────────────────────────┘
    │
    │ Click again, complete, return
    ▼
No attempts left TODAY
┌────────────────────────────────────────┐
│ Button: "⏳ Hết lượt hôm nay"          │
│ Status: [2/2]                          │
│ Disabled: Yes                          │
│ Color: Gray/Muted                      │
│ Action: None (disabled)                │
└────────────────────────────────────────┘
    │
    │ Time passes (midnight)
    │ Counter resets
    ▼
NEW DAY - Back to "has attempts left"
┌────────────────────────────────────────┐
│ Button: "🔗 Vượt link nhận thưởng"    │
│ Status: [0/2]                          │
│ Action: Generate link + open           │
│ Color: Green/Success                   │
└────────────────────────────────────────┘
```

---

## 8. Database Read/Write Operations

```
OPERATION TRACE: User Completes Task

1. User clicks "Vượt link"
   ├─→ READ user from sessionStorage (local)
   └─→ 0 Firestore operations

2. App generates Link4m
   └─→ 1 HTTP API call to link4m.co
   └─→ 0 Firestore operations

3. User completes task, returns with ?claim=taskId
   ├─→ autoClaimTaskFromReturn() starts
   └─→ 0 Firestore operations (so far)

4. grantTaskReward() called
   ├─→ READ: loadUserDoc(username)
   │   └─→ 1 Firestore READ
   │
   ├─→ Check: remaining attempts
   │   └─→ 0 Firestore operations (calculations only)
   │
   ├─→ WRITE: saveUserDoc(updated_user)
   │   └─→ 1 Firestore WRITE
   │
   └─→ UPDATE: setCurrentUser() local
       └─→ 0 Firestore operations (sessionStorage)

5. renderTasks() updates UI
   └─→ 0 Firestore operations (read from local state)

TOTAL PER COMPLETION:
- Firestore READs: 1
- Firestore WRITEs: 1
- API calls: 1 (to link4m.co)
- Local operations: many

COST IMPLICATIONS:
- 1 completion = ~$0.000015 (Firestore pricing)
- 1000 completions = ~$0.015
- Monitor usage for large scale apps!
```

---

## 9. Error Handling Flow

```
ERROR HANDLING FLOW

User clicks "Vượt link"
        │
        ▼
    ┌─ NOT LOGGED IN?
    │   ├─Yes──→ Show: "Vui lòng đăng nhập"
    │   │        Action: Open login modal
    │   └─No──→ Continue
    │
    ├─ TASK NOT FOUND?
    │   ├─Yes──→ Show: "Nhiệm vụ không tồn tại"
    │   │        Action: Refresh page
    │   └─No──→ Continue
    │
    ├─ NO ATTEMPTS LEFT?
    │   ├─Yes──→ Show: "Bạn đã hết lượt"
    │   │        Action: Disable button
    │   └─No──→ Continue
    │
    ├─ NO API KEY FOR LINK4M?
    │   ├─Yes──→ Show: "Chưa cấu hình API Key"
    │   │        Action: Use original link (fallback)
    │   └─No──→ Try API call
    │
    ├─ API CALL FAILS?
    │   ├─Yes──→ Log error
    │   │        Show: "Không thể tạo link" (toast)
    │   │        Action: Use original link (fallback)
    │   └─No──→ Use shortened link
    │
    └─ OPEN LINK
        │
        ▼
    User completes task
        │
        ▼
    Returns with ?claim=taskId
        │
        ├─ NOT LOGGED IN?
        │   ├─Yes──→ Show: "Đăng nhập để nhận coin"
        │   │        Save pendingClaimTaskId
        │   └─No──→ Continue
        │
        ├─ TASK START MARKER NOT FOUND?
        │   ├─Yes──→ Show: "Phiên không tìm thấy"
        │   │        Action: Ask user to try again
        │   └─No──→ Continue
        │
        ├─ NO ATTEMPTS LEFT?
        │   ├─Yes──→ Show: "Bạn đã hết lượt"
        │   │        Action: Don't grant reward
        │   └─No──→ Continue
        │
        └─ GRANT REWARD
            │
            ├─ Firestore error?
            │   ├─Yes──→ Show: "Có lỗi xảy ra"
            │   │        Action: Ask user to try again
            │   └─No──→ Success
            │
            └─ SHOW SUCCESS
                Show: "🎉 Chúc mừng +50 V-coin"
                Update display
                Reset counter
```

---

## 10. Daily Reset Visualization

```
TIMELINE: Same Task Over 3 Days

Day 1 (July 12, 2026) - maxAttempts: 2
┌──────────────────────────────────────────┐
│ 9:00 AM  │ [0/2] ✓ Clickable           │
│ 10:00 AM │ [1/2] ✓ Clickable           │
│ 11:00 AM │ [2/2] ✗ Disabled            │
│ 6:00 PM  │ [2/2] ✗ Disabled            │
│ 11:59 PM │ [2/2] ✗ Disabled            │
└──────────────────────────────────────────┘
                  │
        (Midnight - automatic reset)
                  ▼
Day 2 (July 13, 2026)
┌──────────────────────────────────────────┐
│ 12:00 AM │ [0/2] ✓ Clickable  ← RESET! │
│ 9:00 AM  │ [0/2] ✓ Clickable           │
│ 10:00 AM │ [1/2] ✓ Clickable           │
│ 11:00 AM │ [2/2] ✗ Disabled            │
│ 11:59 PM │ [2/2] ✗ Disabled            │
└──────────────────────────────────────────┘
                  │
        (Midnight - automatic reset)
                  ▼
Day 3 (July 14, 2026)
┌──────────────────────────────────────────┐
│ 12:00 AM │ [0/2] ✓ Clickable  ← RESET! │
│ 8:00 AM  │ [0/2] ✓ Clickable           │
│ 3:00 PM  │ [1/2] ✓ Clickable           │
│ 5:00 PM  │ [2/2] ✗ Disabled            │
│ 11:59 PM │ [2/2] ✗ Disabled            │
└──────────────────────────────────────────┘

HOW RESET WORKS:
1. lastResetDate stored: "2026-07-12"
2. When getTodayString() called: "2026-07-13"
3. "2026-07-13" ≠ "2026-07-12" → RESET!
4. Set: lastResetDate = "2026-07-13"
5. Set: count = 0
6. Button enabled again
```

---

## Summary Diagram

```
OLD SYSTEM                    →    NEW SYSTEM
──────────────────────────────────────────────

One-time tasks               →    Multi-attempt
└─ Done forever              └─ Daily reset

Fixed shortened links        →    Dynamic links
└─ Same for all users        └─ New each time

No tracking                  →    Counter tracking
└─ Just "yes/no"             └─ Shows [X/maxAttempts]

Admin creates link once      →    App creates on-demand
└─ Manual work               └─ Automatic

No rewards                   →    Multiple rewards
└─ One coin per task         └─ Coins per attempt

No limit                     →    Configurable limit
└─ Unlimited tasks active    └─ Admin can limit

RESULT: Better UX, more engagement, more coins earned!
```

