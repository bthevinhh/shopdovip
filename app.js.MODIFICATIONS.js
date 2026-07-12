/**
 * MODIFICATIONS FOR MULTI-ATTEMPT TASKS & DYNAMIC LINK4M
 * 
 * This file contains the key modifications needed for:
 * 1. Tasks that can be completed multiple times per day (with admin-set limits)
 * 2. Dynamic Link4m link generation (instead of pre-saved links)
 * 
 * Copy these functions and integrate them into your app.js file.
 * 
 * Key changes:
 * - Replace completedTaskIds[] with completedTasks{} object
 * - Add attempt tracking with daily reset
 * - Generate Link4m links dynamically on-demand
 * - Add maxAttempts field to task documents
 */

// ============================================================
// SECTION A: NEW HELPER FUNCTIONS
// ============================================================

/**
 * Get today's date as string: YYYY-MM-DD
 */
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get remaining attempts for a user on a specific task today
 * 
 * @param {string} username - User's username
 * @param {string} taskId - Task ID
 * @param {number} maxAttempts - Max attempts per day (0 = unlimited)
 * @returns {number} - Remaining attempts (Infinity if unlimited)
 */
function getRemainingAttempts(username, taskId, maxAttempts) {
  // If maxAttempts is 0, unlimited
  if (maxAttempts === 0) return Infinity;
  
  const cur = getCurrentUser();
  if (!cur) return maxAttempts;
  
  // Get task attempt record from user's completedTasks object
  const taskAttempt = cur.completedTasks?.[taskId] || {};
  const today = getTodayString();
  
  // If it's a new day, reset the counter
  if (taskAttempt.lastResetDate !== today) {
    return maxAttempts;
  }
  
  // Return remaining attempts
  const used = taskAttempt.count || 0;
  return Math.max(0, maxAttempts - used);
}

/**
 * Check if user has remaining attempts for this task
 * 
 * @param {string} username - User's username
 * @param {string} taskId - Task ID
 * @param {number} maxAttempts - Max attempts per day (0 = unlimited)
 * @returns {boolean} - True if user can still do this task
 */
function hasAttemptLeft(username, taskId, maxAttempts) {
  const remaining = getRemainingAttempts(username, taskId, maxAttempts);
  return remaining > 0;
}

/**
 * Get formatted attempt string for display
 * e.g., "0/2", "1/5", "Vô hạn"
 * 
 * @param {string} username - User's username
 * @param {string} taskId - Task ID
 * @param {number} maxAttempts - Max attempts per day
 * @returns {string} - Formatted string
 */
function getAttemptsDisplay(username, taskId, maxAttempts) {
  if (maxAttempts === 0) return 'Vô hạn';
  
  const remaining = getRemainingAttempts(username, taskId, maxAttempts);
  const used = Math.max(0, maxAttempts - remaining);
  return `${used}/${maxAttempts}`;
}

/**
 * Create a short link dynamically using Link4m API
 * Called when user clicks "Get link" button
 * 
 * @param {string} longUrl - The URL to shorten
 * @returns {string} - Short URL
 * @throws {Error} - If API key not configured or API fails
 */
async function shortenWithLink4mDynamic(longUrl) {
  const apiKey = (appSettings.link4mApiKey || '').trim();
  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key Link4m. Vào mục "Cài đặt Link4m & Giới hạn" ở tab Nhiệm vụ để nhập API Key.');
  }
  
  const apiUrl = `https://link4m.co/api-shorten/v2?api=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(longUrl)}&format=text`;
  
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      throw new Error(`Link4m API lỗi HTTP ${res.status}`);
    }
    
    const text = (await res.text()).trim();
    
    if (!text || !/^https?:\/\//i.test(text)) {
      throw new Error(text || 'Link4m không trả về link hợp lệ. Kiểm tra lại API Key.');
    }
    
    return text;
  } catch (error) {
    console.error('Link4m API error:', error);
    throw error;
  }
}

// ============================================================
// SECTION B: MODIFY grantTaskReward()
// ============================================================

/**
 * MODIFIED VERSION: Grant task reward to user
 * 
 * Changes:
 * - Changed from checking completedTaskIds array
 * - Now checks remaining attempts
 * - Daily counter reset logic
 * - Tracks attempts in completedTasks object
 */
async function grantTaskReward(t) {
  const cur = getCurrentUser();
  if (!cur) return { ok: false };
  
  // Check if user has remaining attempts
  const remaining = getRemainingAttempts(
    cur.username,
    t.id,
    t.maxAttempts || 1
  );
  
  // If no attempts left and maxAttempts > 0
  if (remaining <= 0 && (t.maxAttempts || 1) > 0) {
    return {
      ok: false,
      error: 'Bạn đã hết lượt làm nhiệm vụ này hôm nay.'
    };
  }
  
  const freshUser = await loadUserDoc(cur.username);
  if (!freshUser) return { ok: false };
  
  // Initialize completedTasks if not exists
  if (!freshUser.completedTasks) {
    freshUser.completedTasks = {};
  }
  
  const today = getTodayString();
  
  // Initialize or reset task attempt record
  if (!freshUser.completedTasks[t.id]) {
    freshUser.completedTasks[t.id] = {
      count: 0,
      lastResetDate: today
    };
  }
  
  // Reset if it's a new day
  if (freshUser.completedTasks[t.id].lastResetDate !== today) {
    freshUser.completedTasks[t.id] = {
      count: 0,
      lastResetDate: today
    };
  }
  
  // Grant reward
  freshUser.vcoin = (freshUser.vcoin || 0) + (t.reward || 0);
  freshUser.completedTasks[t.id].count += 1;
  
  const saved = await saveUserDoc(freshUser);
  if (!saved) return { ok: false };
  
  // Update local user state
  setCurrentUser({
    username: cur.username,
    displayName: cur.displayName,
    vcoin: freshUser.vcoin,
    completedTasks: freshUser.completedTasks
  });
  
  return { ok: true };
}

// ============================================================
// SECTION C: MODIFY startTask()
// ============================================================

/**
 * MODIFIED VERSION: Start a task and open the short link
 * 
 * Changes:
 * - Check remaining attempts before opening link
 * - Generate Link4m link DYNAMICALLY when user clicks
 * - Show loading state while creating link
 */
window.startTask = async function(id) {
  if (!isUserLoggedIn()) {
    showToast('Vui lòng đăng nhập để làm nhiệm vụ.');
    openUserAuthModal('login');
    return;
  }
  
  const t = tasks.find(x => x.id === id);
  if (!t || !t.link) {
    showToast('Nhiệm vụ chưa có link.');
    return;
  }
  
  const cur = getCurrentUser();
  
  // Check remaining attempts
  const remaining = getRemainingAttempts(
    cur.username,
    id,
    t.maxAttempts || 1
  );
  
  if (remaining <= 0 && (t.maxAttempts || 1) > 0) {
    showToast(`Bạn đã hết lượt làm nhiệm vụ này hôm nay. Quay lại vào ngày mai để làm lại.`);
    return;
  }
  
  // Prepare return URL for Link4m
  const returnUrl = buildTaskReturnUrl(id);
  let linkToOpen = t.link;
  
  // Try to create shortened link if Link4m API key is configured
  if (appSettings.link4mApiKey) {
    try {
      // Find and disable the button while loading
      const button = document.querySelector(`button[onclick*="startTask('${id}')"]`);
      let originalText = '';
      let wasDisabled = false;
      
      if (button) {
        originalText = button.textContent;
        wasDisabled = button.disabled;
        button.disabled = true;
        button.textContent = '🔗 Đang tạo link...';
      }
      
      // Generate short link dynamically
      linkToOpen = await shortenWithLink4mDynamic(returnUrl);
      
      // Restore button state
      if (button) {
        button.textContent = originalText;
        button.disabled = wasDisabled;
      }
    } catch (error) {
      console.error('Failed to create Link4m link, using original URL:', error);
      showToast('Không thể tạo link rút gọn, sẽ sử dụng link gốc.');
      // Fall back to original link
      linkToOpen = returnUrl;
    }
  }
  
  // Mark this task as started
  setTaskStartMarker(cur.username, id);
  
  // Open the link (either shortened or original)
  window.open(linkToOpen, '_blank');
  
  // Track that this task was started
  startedTasks.add(id);
  renderTasks();
};

// ============================================================
// SECTION D: MODIFY confirmTaskDone()
// ============================================================

/**
 * MODIFIED VERSION: Confirm task completion
 * 
 * Changes:
 * - Check remaining attempts instead of checking completedTaskIds
 */
window.confirmTaskDone = async function(id) {
  if (!isUserLoggedIn()) {
    showToast('Vui lòng đăng nhập để làm nhiệm vụ.');
    openUserAuthModal('login');
    return;
  }
  
  const cur = getCurrentUser();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  
  // Check remaining attempts
  const remaining = getRemainingAttempts(
    cur.username,
    id,
    t.maxAttempts || 1
  );
  
  if (remaining <= 0 && (t.maxAttempts || 1) > 0) {
    showToast('Bạn đã hết lượt làm nhiệm vụ này hôm nay.');
    return;
  }
  
  const ok = await askConfirm({
    title: 'Xác nhận hoàn thành',
    message: `Bạn xác nhận đã vượt link và hoàn thành nhiệm vụ "${t.title}" để nhận ${t.reward || 0} V-coin?`,
    okText: 'Đã hoàn thành'
  });
  
  if (!ok) return;
  
  const result = await grantTaskReward(t);
  if (!result.ok) {
    showToast(result.error || 'Có lỗi xảy ra, thử lại nhé.');
    return;
  }
  
  clearTaskStartMarker(cur.username, id);
  startedTasks.delete(id);
  
  showToast(`🎉 Chúc mừng! Bạn vừa nhận được +${t.reward || 0} V-coin.`);
  renderVcoinUI();
  renderTasks();
};

// ============================================================
// SECTION E: MODIFY autoClaimTaskFromReturn()
// ============================================================

/**
 * MODIFIED VERSION: Auto-claim task reward when returning from shortened link
 * 
 * Changes:
 * - Check remaining attempts instead of completedTaskIds
 */
async function autoClaimTaskFromReturn(taskId) {
  if (!isUserLoggedIn()) {
    sessionStorage.setItem('pendingClaimTaskId', taskId);
    showToast('Vượt link thành công! Đăng nhập để nhận V-coin nhé.');
    switchView('tasks');
    openUserAuthModal('login');
    return;
  }
  
  const cur = getCurrentUser();
  
  if (!tasksLoaded) {
    tasks = await loadTasks();
    tasksLoaded = true;
  }
  
  const t = tasks.find(x => x.id === taskId);
  if (!t) {
    showToast('Nhiệm vụ không tồn tại hoặc đã bị xoá.');
    switchView('tasks');
    return;
  }
  
  // Check start marker
  const startedTs = getTaskStartMarker(cur.username, taskId);
  if (!startedTs) {
    showToast('Không tìm thấy phiên bắt đầu nhiệm vụ trên trình duyệt này. Vui lòng bấm "Vượt link nhận thưởng" ở tab Nhiệm vụ trước nhé.');
    switchView('tasks');
    renderTasks();
    return;
  }
  
  // Check remaining attempts
  const remaining = getRemainingAttempts(
    cur.username,
    taskId,
    t.maxAttempts || 1
  );
  
  if (remaining <= 0 && (t.maxAttempts || 1) > 0) {
    showToast('Bạn đã hết lượt làm nhiệm vụ này hôm nay.');
    switchView('tasks');
    renderTasks();
    return;
  }
  
  const result = await grantTaskReward(t);
  clearTaskStartMarker(cur.username, taskId);
  startedTasks.delete(taskId);
  
  if (!result.ok) {
    showToast(result.error || 'Có lỗi xảy ra khi cộng V-coin, thử lại nhé.');
    switchView('tasks');
    return;
  }
  
  showToast(`🎉 Chào mừng quay lại! Bạn vừa nhận được +${t.reward || 0} V-coin.`);
  renderVcoinUI();
  renderTasks();
  switchView('tasks');
}

// ============================================================
// SECTION F: MODIFY renderTasks()
// ============================================================

/**
 * MODIFIED VERSION: Render task list with attempt counter
 * 
 * Changes:
 * - Display [X/maxAttempts] badge
 * - Disable button if no attempts left
 * - Show "Hết lượt hôm nay" instead of "Đã nhận thưởng"
 */
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;
  
  const admin = isAdminUnlocked();
  const cur = getCurrentUser();
  const visibleTasks = admin ? tasks : tasks.filter(t => t.active !== false);
  
  document.getElementById('taskCountLabel').textContent = visibleTasks.length;
  
  if (visibleTasks.length === 0) {
    list.innerHTML = `<div class="empty-state">${admin ? 'Chưa có nhiệm vụ nào. Nhấn "+ Thêm nhiệm vụ" để bắt đầu.' : 'Hiện chưa có nhiệm vụ nào, quay lại sau nhé.'}</div>`;
    return;
  }
  
  list.innerHTML = visibleTasks.map(t => {
    const isStarted = startedTasks.has(t.id);
    
    // Get remaining attempts
    const remaining = admin ? -1 : getRemainingAttempts(
      cur?.username || '',
      t.id,
      t.maxAttempts || 1
    );
    
    // Check if user can still do this task
    const canDoTask = admin || remaining > 0 || !t.maxAttempts || t.maxAttempts === 0;
    
    // Get attempts display string
    const attemptsLabel = admin
      ? `[Limit: ${t.maxAttempts || 0 === 0 ? 'Vô hạn' : t.maxAttempts}]`
      : getAttemptsDisplay(cur?.username || '', t.id, t.maxAttempts || 1);
    
    let actionsHtml = '';
    
    if (admin) {
      actionsHtml = '';
    } else if (!isUserLoggedIn()) {
      actionsHtml = `<button class="stamp-btn" onclick="openUserAuthModal('login')">Đăng nhập để làm nhiệm vụ</button>`;
    } else if (!canDoTask) {
      // No attempts left
      actionsHtml = `<button class="stamp-btn" disabled style="opacity:.5;cursor:not-allowed;">⏳ Hết lượt hôm nay</button>`;
    } else if (isStarted) {
      // Task already started, show completion options
      actionsHtml = `
        <button class="ghost-btn" onclick="startTask('${t.id}')">🔗 Mở lại link</button>
        <button class="stamp-btn" onclick="confirmTaskDone('${t.id}')">✅ Tôi đã hoàn thành</button>
      `;
    } else {
      // Normal state - can start task
      actionsHtml = `<button class="stamp-btn" onclick="startTask('${t.id}')">🔗 Vượt link nhận thưởng</button>`;
    }
    
    return `
    <div class="task-card ${!canDoTask ? 'out-of-attempts' : ''}">
      <div class="task-card-top">
        <div class="task-reward-badge">💰 ${t.reward || 0} V-coin</div>
        ${!admin && t.maxAttempts ? `<div class="task-attempts-badge">${attemptsLabel}</div>` : ''}
        ${admin && t.maxAttempts ? `<div class="task-attempts-badge" style="font-size:12px;opacity:0.7;">Limit: ${t.maxAttempts || 'Vô hạn'}</div>` : ''}
        ${admin && t.active === false ? `<div class="task-inactive-badge">Đang tắt</div>` : ''}
      </div>
      <h3>${escapeHtml(t.title)}</h3>
      <div class="task-desc">${linkify(t.desc || '')}</div>
      ${admin ? `
      <div class="task-return-url">
        <span class="label" style="margin:0 0 6px;">LINK QUAY VỀ (đặt làm đích đến trên trang rút gọn)</span>
        <div class="task-return-url-row">
          <input type="text" readonly value="${buildTaskReturnUrl(t.id)}" onclick="this.select()">
          <button class="mini-btn" onclick="copyTaskReturnUrl('${t.id}')">Copy</button>
        </div>
      </div>` : ''}
      <div class="task-actions">${actionsHtml}</div>
      ${admin ? `
      <div class="card-admin-row" style="opacity:1;margin-top:12px;">
        <button class="mini-btn" onclick="startEditTask('${t.id}')">Sửa</button>
        <button class="mini-btn" onclick="deleteTaskAdmin('${t.id}')">Xoá</button>
        <button class="pin-btn ${t.active !== false ? 'pinned' : ''}" onclick="toggleTaskActive('${t.id}')">${t.active !== false ? '★ Đang bật' : '☆ Đang tắt'}</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

// ============================================================
// SECTION G: MODIFY saveTaskBtn event listener
// ============================================================

/**
 * MODIFIED VERSION: Save task form
 * 
 * Changes:
 * - Removed Link4m auto-shorten feature
 * - Added maxAttempts field
 * - Changed tLink placeholder to "Link gốc"
 * 
 * Note: Update the HTML form first to add tMaxAttempts input
 */

// REPLACE the existing saveTaskBtn listener with this:

document.getElementById('saveTaskBtn').addEventListener('click', async () => {
  if (!checkAdmin()) return;
  
  const title = document.getElementById('tTitle').value.trim();
  const desc = document.getElementById('tDesc').value.trim();
  const link = document.getElementById('tLink').value.trim();
  const rewardRaw = document.getElementById('tReward').value.trim();
  const maxAttemptsRaw = document.getElementById('tMaxAttempts').value.trim();
  
  const reward = rewardRaw ? Math.max(0, parseInt(rewardRaw, 10) || 0) : 0;
  const maxAttempts = maxAttemptsRaw ? Math.max(0, parseInt(maxAttemptsRaw, 10) || 0) : 1;
  const active = document.getElementById('tActive').checked;
  
  if (!title) {
    showToast('Vui lòng nhập tên nhiệm vụ.');
    return;
  }
  if (!link) {
    showToast('Vui lòng nhập link gốc.');
    return;
  }
  if (reward <= 0) {
    showToast('Vui lòng nhập số V-coin thưởng lớn hơn 0.');
    return;
  }
  
  if (active && appSettings.maxActiveTasks > 0 && countActiveTasks(editingTaskId) >= appSettings.maxActiveTasks) {
    showToast(`Đã đạt giới hạn ${appSettings.maxActiveTasks} nhiệm vụ đang hoạt động. Hãy tắt bớt nhiệm vụ khác, hoặc bỏ chọn "Đang hoạt động", hoặc tăng giới hạn trong Cài đặt.`);
    return;
  }
  
  const saveBtn = document.getElementById('saveTaskBtn');
  saveBtn.disabled = true;
  
  let taskToSave;
  if (editingTaskId) {
    const t = tasks.find(x => x.id === editingTaskId);
    t.title = title;
    t.desc = desc;
    t.link = link;
    t.reward = reward;
    t.maxAttempts = maxAttempts;
    t.active = active;
    taskToSave = t;
  } else {
    taskToSave = {
      id: currentFormTaskId || ('t' + Date.now()),
      title,
      desc,
      link,
      reward,
      maxAttempts,
      active,
      createdAt: Date.now()
    };
    tasks.push(taskToSave);
  }
  
  const ok = await saveTaskDoc(taskToSave);
  saveBtn.disabled = false;
  if (!ok) return;
  
  renderTasks();
  switchView('tasks');
  showToast('Đã lưu nhiệm vụ!');
});

// ============================================================
// SECTION H: UPDATE startEditTask()
// ============================================================

/**
 * MODIFIED VERSION: Load task into edit form
 * 
 * Changes:
 * - Load maxAttempts value from task
 * - Hide/remove Link4m auto-shorten button
 */

window.startEditTask = function(id) {
  if (!checkAdmin()) return;
  
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  
  editingTaskId = id;
  currentFormTaskId = id;
  
  document.getElementById('taskFormTitle').textContent = 'Sửa nhiệm vụ';
  document.getElementById('tTitle').value = t.title || '';
  document.getElementById('tDesc').value = t.desc || '';
  document.getElementById('tLink').value = t.link || '';
  document.getElementById('tReward').value = t.reward ? String(t.reward) : '';
  document.getElementById('tMaxAttempts').value = t.maxAttempts ? String(t.maxAttempts) : '1';
  document.getElementById('tActive').checked = t.active !== false;
  document.getElementById('tReturnUrlPreview').value = buildTaskReturnUrl(currentFormTaskId);
  
  switchView('task-form');
};

// ============================================================
// SECTION I: UPDATE USER CREATION & LOGIN
// ============================================================

/**
 * When creating a new user, initialize with new structure
 */
function createNewUser(username, displayName) {
  return {
    username,
    displayName,
    vcoin: 0,
    completedTasks: {}  // NEW: Changed from completedTaskIds: []
  };
}

/**
 * MIGRATION: When loading existing user, convert old structure to new
 * This ensures backward compatibility with old data
 */
async function loadUserDocWithMigration(username) {
  if (!db) return null;
  
  try {
    const snap = await getDoc(doc(db, 'users', username));
    if (!snap.exists()) return null;
    
    const doc_data = snap.data();
    
    // MIGRATION: Convert old completedTaskIds to new completedTasks structure
    if (doc_data.completedTaskIds && !doc_data.completedTasks) {
      const today = getTodayString();
      doc_data.completedTasks = {};
      
      for (const taskId of doc_data.completedTaskIds) {
        doc_data.completedTasks[taskId] = {
          count: 1,
          lastResetDate: today
        };
      }
      
      // Optional: Save migrated data back to DB
      // await saveUserDoc(doc_data);
    }
    
    // Ensure completedTasks exists
    if (!doc_data.completedTasks) {
      doc_data.completedTasks = {};
    }
    
    return doc_data;
  } catch (e) {
    console.error('Error loading user:', e);
    return null;
  }
}

// ============================================================
// SECTION J: ADD CSS STYLES
// ============================================================

/**
 * Add these CSS rules to your style.css file:
 * 
 * .task-attempts-badge {
 *   display: inline-block;
 *   background-color: rgba(100, 150, 255, 0.15);
 *   color: var(--primary-color, #2563eb);
 *   padding: 4px 8px;
 *   border-radius: 4px;
 *   font-size: 12px;
 *   font-weight: 600;
 *   margin-left: 8px;
 * }
 * 
 * .task-card.out-of-attempts {
 *   opacity: 0.6;
 * }
 * 
 * .task-card.out-of-attempts button:not(.mini-btn) {
 *   cursor: not-allowed;
 * }
 */

// ============================================================
// NOTES FOR INTEGRATION
// ============================================================

/**
 * STEPS TO INTEGRATE:
 * 
 * 1. UPDATE HTML (index.html):
 *    a) In view-task-form, add this field after tReward:
 *       <label>Giới hạn lượt làm/ngày (0 = vô hạn lượt)</label>
 *       <input type="text" id="tMaxAttempts" placeholder="VD: 2, 5, 100, 0" inputmode="numeric">
 *    
 *    b) In task form, change label from "Link vượt (shortlink)" to "Link gốc"
 *    
 *    c) Hide/remove the autoShortenBtn (tự động tạo Link4m button):
 *       <button type="button" class="mini-btn" id="autoShortenBtn" style="display:none;">...
 * 
 * 2. REPLACE FUNCTIONS in app.js:
 *    a) Add all functions from SECTION A (helper functions)
 *    b) Replace grantTaskReward() with SECTION B
 *    c) Replace window.startTask with SECTION C
 *    d) Replace window.confirmTaskDone with SECTION D
 *    e) Replace autoClaimTaskFromReturn() with SECTION E
 *    f) Replace renderTasks() with SECTION F
 *    g) Replace saveTaskBtn listener with SECTION G
 *    h) Replace startEditTask() with SECTION H
 * 
 * 3. UPDATE USER HANDLING:
 *    a) Use createNewUser() function for new user creation
 *    b) Replace loadUserDoc() calls with loadUserDocWithMigration()
 *       (or add migration logic inside loadUserDoc)
 *    c) Update setCurrentUser() calls to use completedTasks structure
 * 
 * 4. ADD CSS:
 *    a) Add styles from SECTION J to style.css
 * 
 * 5. TEST:
 *    a) Test new task creation with maxAttempts
 *    b) Test attempting task multiple times
 *    c) Test daily reset
 *    d) Test Link4m dynamic generation
 *    e) Test user migration from old data structure
 */

