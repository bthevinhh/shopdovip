# Quick Implementation Checklist

## Overview
- [ ] Read IMPLEMENTATION_GUIDE.md to understand the changes
- [ ] Read HTML_MODIFICATIONS.md for UI updates  
- [ ] Read app.js.MODIFICATIONS.js for code changes

---

## Phase 1: Database Structure

### Firestore Documents to Update

**Tasks Collection (`tasks/{taskId}`)**
- [ ] Add `maxAttempts` field to all existing tasks (or set default to 1)
  - Recommend: Run script or manually update
  - Value: number (0 = unlimited, >0 = limit per day)

**Users Collection (`users/{username}`)**
- [ ] Migrate `completedTaskIds: []` → `completedTasks: {}`
- [ ] Migration logic included in `app.js.MODIFICATIONS.js` section H
- [ ] Backward compatible - old structure auto-migrated on load

---

## Phase 2: HTML Updates (index.html)

### 2.1 Task Form (view-task-form)

**Line ~166:**
- [ ] Change label from "Link vượt (shortlink)" → "Link gốc (không cần rút gọn...)"
- [ ] Update placeholder: "https://..." → "https://trang-của-bạn.com/page"

**Line ~168:**
- [ ] REMOVE or hide: `<button id="autoShortenBtn">🔗 Tự động tạo (Link4m)</button>`

**After tReward input (around line 178):**
- [ ] ADD new field for max attempts:
```html
<label>Giới hạn lượt làm/ngày (0 = vô hạn)</label>
<input type="text" id="tMaxAttempts" placeholder="VD: 2, 5, 100, 0 (vô hạn)" inputmode="numeric" value="1">
<p style="color:var(--muted);font-size:12px;margin-top:4px;">
  Người dùng có thể làm lại nhiệm vụ này bao nhiêu lần trong 1 ngày. 
  Ngày hôm sau sẽ tự động reset. Để 0 để cho phép vô hạn lượt.
</p>
```

---

## Phase 3: CSS Updates (style.css)

- [ ] Add task attempts badge styling:
```css
.task-attempts-badge {
  display: inline-block;
  background-color: rgba(100, 150, 255, 0.15);
  color: #2563eb;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 8px;
}

.task-card.out-of-attempts {
  opacity: 0.6;
}
```

---

## Phase 4: JavaScript Updates (app.js)

### 4.1 Add New Helper Functions

**Copy from `app.js.MODIFICATIONS.js` SECTION A:**
- [ ] `getTodayString()` - Get date as YYYY-MM-DD
- [ ] `getRemainingAttempts()` - Calculate user's remaining attempts
- [ ] `hasAttemptLeft()` - Check if user can still do task
- [ ] `getAttemptsDisplay()` - Format attempt string (e.g., "0/2")
- [ ] `shortenWithLink4mDynamic()` - Create Link4m link on-demand

**Location:** Add after `loadSettings()` function or in a dedicated helpers section

### 4.2 Replace Key Functions

**Copy from `app.js.MODIFICATIONS.js` SECTION B:**
- [ ] Replace `grantTaskReward()` function
  - Changes: Check attempts instead of completedTaskIds
  - Uses new `getRemainingAttempts()`
  - Updates `completedTasks` object structure

**Copy from `app.js.MODIFICATIONS.js` SECTION C:**
- [ ] Replace `window.startTask()` function
  - Changes: Check attempts before opening link
  - Generates Link4m link dynamically
  - Shows loading indicator

**Copy from `app.js.MODIFICATIONS.js` SECTION D:**
- [ ] Replace `window.confirmTaskDone()` function
  - Changes: Check attempts instead of completedTaskIds

**Copy from `app.js.MODIFICATIONS.js` SECTION E:**
- [ ] Replace `autoClaimTaskFromReturn()` function
  - Changes: Check attempts instead of completedTaskIds

**Copy from `app.js.MODIFICATIONS.js` SECTION F:**
- [ ] Replace `renderTasks()` function
  - Changes: Display [X/maxAttempts] badge
  - Disable button if no attempts left
  - Different messaging

**Copy from `app.js.MODIFICATIONS.js` SECTION G:**
- [ ] Replace `saveTaskBtn` event listener
  - Changes: Read and save `tMaxAttempts` field
  - Removed autoShortenBtn logic

**Copy from `app.js.MODIFICATIONS.js` SECTION H:**
- [ ] Replace `window.startEditTask()` function
  - Changes: Load `tMaxAttempts` from task

### 4.3 Update User Creation & Loading

**Copy from `app.js.MODIFICATIONS.js` SECTION I:**
- [ ] Update `createNewUser()` function
  - Change: `completedTaskIds: []` → `completedTasks: {}`

- [ ] Replace/wrap `loadUserDoc()` with migration logic
  - Option A: Create new `loadUserDocWithMigration()` function
  - Option B: Add migration logic inside existing `loadUserDoc()`
  - Purpose: Auto-convert old structure to new structure

- [ ] Update all `setCurrentUser()` calls if needed
  - Structure: `{username, displayName, vcoin, completedTasks}`

### 4.4 Remove Obsolete Code

- [ ] Check if `autoShortenBtn` event listener exists → REMOVE
  - Search for: `document.getElementById('autoShortenBtn')`
  - Should have been removed (no need to create Link4m in advance)

- [ ] Check for references to `completedTaskIds` → MIGRATE
  - Search for all `completedTaskIds` references
  - Update to use `completedTasks` object
  - Priority: User login/registration, profile, etc.

---

## Phase 5: Testing

### Unit Tests

**Helper Functions:**
- [ ] `getTodayString()` returns correct format
- [ ] `getRemainingAttempts()` returns correct count
- [ ] `getRemainingAttempts()` resets on new day
- [ ] `getAttemptsDisplay()` formats correctly

**Task Completion:**
- [ ] Task with maxAttempts=1 can be done once, then locked
- [ ] Task with maxAttempts=2 can be done twice, then locked
- [ ] Task with maxAttempts=0 (unlimited) can be done multiple times
- [ ] Counter resets next day

**Link4m:**
- [ ] With API key: dynamically generates short link
- [ ] Without API key: falls back to return URL
- [ ] Loading indicator shows while creating link
- [ ] Button re-enables after link created

### Integration Tests

**User Flow:**
- [ ] New user: completedTasks initialized as empty object
- [ ] Old user: completedTaskIds auto-migrated to completedTasks
- [ ] User earns V-coins correctly for each attempt
- [ ] User can't exceed maxAttempts per day

**Admin Flow:**
- [ ] Create task with maxAttempts=2
- [ ] Task shows [0/2] for users
- [ ] After 2 completions: shows [2/2], button disabled
- [ ] Next day: resets to [0/2], button enabled

**Edge Cases:**
- [ ] Timezone handling: counter resets at midnight in user's timezone
  - Current implementation uses client-side date (might need adjustment)
  - Alternative: use server timestamp from Firestore
- [ ] Concurrent attempts: user clicks twice quickly
  - App should handle gracefully
- [ ] Network failure during Link4m API call
  - Should fall back to return URL

### Manual Testing Checklist

**As Admin:**
- [ ] Open task form
- [ ] See new "Giới hạn lượt/ngày" field
- [ ] No "Tự động tạo" button visible
- [ ] Create task with maxAttempts=2
- [ ] Save successfully
- [ ] Edit task and see maxAttempts preserved
- [ ] Link field doesn't show shortened link anymore

**As User (New Session):**
- [ ] Go to Tasks tab
- [ ] See attempt badge [0/2] on task
- [ ] Click "Vượt link nhận thưởng"
- [ ] See "Đang tạo link..." briefly
- [ ] New window opens with short link
- [ ] Complete the task
- [ ] Return to site
- [ ] See [1/2], can still do task
- [ ] Do task again
- [ ] See [2/2], button now disabled
- [ ] Message: "⏳ Hết lượt hôm nay"

**As User (Next Day):**
- [ ] Refresh page or come back tomorrow
- [ ] See [0/2] again - counter reset!
- [ ] Can do task again

---

## Phase 6: Deployment

- [ ] Backup current Firestore data
- [ ] Deploy HTML changes
- [ ] Deploy CSS changes  
- [ ] Deploy JavaScript changes
- [ ] Monitor console for errors
- [ ] Test with real users
- [ ] Monitor V-coin balance accuracy

---

## Phase 7: Documentation & User Communication

- [ ] Update admin documentation
  - How to create task with limits
  - How to use Link4m API
  - How attempt counter works
  
- [ ] Update user-facing docs
  - How attempts work
  - When counter resets
  - How to know attempts remaining
  
- [ ] Brief admin on changes
  - New maxAttempts field
  - Removed auto-create Link4m
  - Old tasks need updating

---

## Troubleshooting Guide

### Issue: "Hết lượt hôm nay" appears but should be available

**Possible Causes:**
1. `getTodayString()` using wrong timezone
2. Counter not resetting properly
3. User doc not updated after Firestore change

**Solution:**
```javascript
// Check user's completedTasks in console:
console.log(getCurrentUser().completedTasks);

// Manual reset for testing:
const today = getTodayString();
currentUser.completedTasks[taskId] = {count: 0, lastResetDate: today};
```

### Issue: Link4m link not being created

**Possible Causes:**
1. API key not set in settings
2. Network error calling API
3. Link4m API quota exceeded
4. Invalid URL format

**Solution:**
```javascript
// Check settings:
console.log(appSettings.link4mApiKey);

// Try manually:
const shortUrl = await shortenWithLink4mDynamic(testUrl);
console.log(shortUrl);

// Check network tab in DevTools for API call details
```

### Issue: Old users seeing wrong data

**Possible Causes:**
1. Migration not triggered
2. Cached session storage
3. Firestore not updated

**Solution:**
```javascript
// Force migration:
const user = await loadUserDocWithMigration(username);
await saveUserDoc(user);

// Clear cache:
sessionStorage.clear();
localStorage.clear();
```

### Issue: V-coins awarded multiple times for single completion

**Possible Causes:**
1. Auto-claim triggered twice
2. User manually clicking "Tôi đã hoàn thành" after auto-claim
3. Race condition in concurrent requests

**Solution:**
```javascript
// Check completedTasks increment:
console.log('Before:', getCurrentUser().completedTasks[taskId]);
// (complete task)
console.log('After:', getCurrentUser().completedTasks[taskId]);

// Ensure count incremented by 1, not more
```

---

## Performance Considerations

- **Firestore Reads:** Each task completion = 1 read (loadUserDoc) + 1 write (saveUserDoc)
  - Monitor billing
  - Consider batching updates

- **Link4m API Calls:** Each time user clicks "Get link"
  - 1 API call per attempt
  - Monitor Link4m quota
  - Set API rate limits if needed

- **Local Storage:** completedTasks object grows with more tasks
  - For 100 tasks: ~5-10 KB of JSON
  - Not a concern for reasonable task counts

- **Re-render Performance:** renderTasks() called after completion
  - ~100ms for 50 tasks
  - Consider pagination if >100 tasks

---

## Support & Questions

For issues, check:
1. Browser console for error messages
2. Firestore console for document structure
3. Network tab for API calls
4. Application tab for localStorage/sessionStorage

For questions, refer to:
1. IMPLEMENTATION_GUIDE.md - Detailed explanation
2. app.js.MODIFICATIONS.js - Code examples with comments
3. HTML_MODIFICATIONS.md - UI changes explained

