# HTML Modifications for Multi-Attempt Tasks

## Changes Required in `index.html`

### 1. Task Form Section (view-task-form)

**Location:** Lines 158-188 (the task form)

#### CHANGE 1: Update Link Label

**BEFORE:**
```html
<label>Link vượt (shortlink)</label>
<div class="task-return-url-row">
  <input type="url" id="tLink" placeholder="https://...">
  <button type="button" class="mini-btn" id="autoShortenBtn">🔗 Tự động tạo (Link4m)</button>
</div>
```

**AFTER:**
```html
<label>Link gốc (không cần rút gọn, app sẽ tự động tạo qua Link4m)</label>
<div class="task-return-url-row">
  <input type="url" id="tLink" placeholder="https://trang-của-bạn.com/page">
  <!-- Button autoShortenBtn removed - no longer needed -->
</div>
```

#### CHANGE 2: Add Max Attempts Field

**ADD THIS** after the "Thưởng (V-coin)" field and before "Đang hoạt động" checkbox:

```html
<label>Giới hạn lượt làm/ngày (0 = vô hạn)</label>
<input type="text" id="tMaxAttempts" placeholder="VD: 2, 5, 100, 0 (vô hạn)" inputmode="numeric" value="1">
<p style="color:var(--muted);font-size:12px;margin-top:4px;">
  Người dùng có thể làm lại nhiệm vụ này bao nhiêu lần trong 1 ngày. 
  Ngày hôm sau sẽ tự động reset. Để 0 để cho phép vô hạn lượt.
</p>
```

#### CHANGE 3: Complete Modified Section

Here's the complete modified task form:

```html
<!-- ADD/EDIT TASK -->
<section class="view" id="view-task-form">
  <div class="form-card">
    <h2 id="taskFormTitle" style="font-size:22px;">Thêm nhiệm vụ mới</h2>
    
    <label>Tên nhiệm vụ</label>
    <input type="text" id="tTitle" placeholder="VD: Xem trang giới thiệu nhận 50 V-coin">
    
    <label>Mô tả</label>
    <textarea id="tDesc" placeholder="Hướng dẫn ngắn cho nhiệm vụ..."></textarea>
    
    <label>Link gốc (không cần rút gọn, app sẽ tự động tạo qua Link4m)</label>
    <div class="task-return-url-row">
      <input type="url" id="tLink" placeholder="https://trang-của-bạn.com/page">
      <!-- REMOVED: <button type="button" class="mini-btn" id="autoShortenBtn">...</button> -->
    </div>
    
    <div class="task-return-url" style="margin-top:6px;">
      <span class="label" style="margin:0 0 6px;">Link quay về (đích để rút gọn qua Link4m)</span>
      <div class="task-return-url-row">
        <input type="text" id="tReturnUrlPreview" readonly value="" onclick="this.select()">
        <button type="button" class="mini-btn" id="copyFormReturnUrlBtn">Copy</button>
      </div>
    </div>
    
    <label>Thưởng (V-coin)</label>
    <input type="text" id="tReward" placeholder="VD: 50" inputmode="numeric">
    
    <!-- NEW FIELD -->
    <label>Giới hạn lượt làm/ngày (0 = vô hạn)</label>
    <input type="text" id="tMaxAttempts" placeholder="VD: 2, 5, 100, 0 (vô hạn)" inputmode="numeric" value="1">
    <p style="color:var(--muted);font-size:12px;margin-top:4px;">
      Người dùng có thể làm lại nhiệm vụ này bao nhiêu lần trong 1 ngày. 
      Ngày hôm sau sẽ tự động reset. Để 0 để cho phép vô hạn lượt.
    </p>
    
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
      <input type="checkbox" id="tActive" style="width:auto;" checked>
      <span style="margin:0;">Đang hoạt động (hiện cho người dùng)</span>
    </label>
    
    <div class="form-actions">
      <button class="primary-btn" id="saveTaskBtn">Lưu nhiệm vụ</button>
      <button class="ghost-btn" id="cancelTaskFormBtn">Huỷ</button>
    </div>
  </div>
</section>
```

---

### 2. Settings Card Updates (Optional - Just UI Polish)

**Location:** Lines 144-153 (task settings card)

You can add more information about how attempts work:

```html
<div class="form-card admin-only" id="taskSettingsCard" style="margin-bottom:22px;">
  <h2 style="font-size:17px;">⚙️ Cài đặt Link4m &amp; Giới hạn</h2>
  <label>API Key Link4m (lấy tại my.link4m.com)</label>
  <input type="text" id="stLink4mApiKey" placeholder="Dán API Key Link4m vào đây">
  <p style="color:var(--muted);font-size:12px;margin-top:4px;">
    API Key được sử dụng để tự động tạo link rút gọn khi user bấm "Vượt link nhận thưởng". 
    Link được tạo mới mỗi lần để tránh trùng lặp.
  </p>
  
  <label style="margin-top:12px;">Giới hạn số nhiệm vụ đang hoạt động cùng lúc</label>
  <input type="text" id="stMaxActiveTasks" placeholder="0 = không giới hạn" inputmode="numeric">
  <p style="color:var(--muted);font-size:12px;margin-top:4px;">
    Giới hạn số lượng nhiệm vụ bạn có thể bật cùng một lúc. 
    Để 0 để không giới hạn.
  </p>
  
  <div class="form-actions">
    <button class="primary-btn" id="saveTaskSettingsBtn">Lưu cài đặt</button>
  </div>
</div>
```

---

## Summary of Changes

| Element | Before | After | Why |
|---------|--------|-------|-----|
| `tLink` label | "Link vượt (shortlink)" | "Link gốc (không cần rút gọn...)" | Clarify that we need the original link, not a shortened one |
| `autoShortenBtn` | Visible | REMOVED | No longer needed - Link4m is created dynamically on-demand |
| New field: `tMaxAttempts` | N/A | Added | Track how many times per day user can complete this task |
| Form explanation | N/A | Added | Help admin understand the new system |

---

## Visual Changes in Task Card

When rendered, users will see:

### Before (One-time only):
```
┌────────────────────────────┐
│ Xem trang giới thiệu        │
│ 💰 50 V-coin               │
│                            │
│ 🔗 Vượt link nhận thưởng   │
│ ✅ Tôi đã hoàn thành       │
└────────────────────────────┘
```

### After (With attempt counter):
```
┌────────────────────────────┐
│ Xem trang giới thiệu        │
│ 💰 50 V-coin | [0/2]        │  ← Shows "0/2" (done 0 of 2)
│                            │
│ 🔗 Vượt link nhận thưởng   │  ← Now generates new Link4m
│ ✅ Tôi đã hoàn thành       │
└────────────────────────────┘

┌────────────────────────────┐  After doing once:
│ Xem trang giới thiệu        │
│ 💰 50 V-coin | [1/2]        │  ← Shows "1/2" (done 1 of 2)
│                            │
│ 🔗 Vượt link nhận thưởng   │  ← Generate new link again
│ ✅ Tôi đã hoàn thành       │
└────────────────────────────┘

┌────────────────────────────┐  After doing twice:
│ Xem trang giới thiệu        │
│ 💰 50 V-coin | [2/2]        │  ← Shows "2/2" (done 2 of 2)
│                            │
│ ⏳ Hết lượt hôm nay         │  ← Button disabled/greyed out
└────────────────────────────┘
```

---

## Step-by-Step Implementation

1. **Open `index.html`**

2. **Find the `<section class="view" id="view-task-form">` section (around line 158)**

3. **Make these changes:**

   a. Find the line `<label>Link vượt (shortlink)</label>`
      - Change to: `<label>Link gốc (không cần rút gọn, app sẽ tự động tạo qua Link4m)</label>`
      - Change placeholder: `https://trang-của-bạn.com/page`
   
   b. REMOVE or hide this button:
      ```html
      <button type="button" class="mini-btn" id="autoShortenBtn">🔗 Tự động tạo (Link4m)</button>
      ```
   
   c. ADD this field after `tReward` input and before `tActive` checkbox:
      ```html
      <label>Giới hạn lượt làm/ngày (0 = vô hạn)</label>
      <input type="text" id="tMaxAttempts" placeholder="VD: 2, 5, 100, 0 (vô hạn)" inputmode="numeric" value="1">
      <p style="color:var(--muted);font-size:12px;margin-top:4px;">
        Người dùng có thể làm lại nhiệm vụ này bao nhiêu lần trong 1 ngày. 
        Ngày hôm sau sẽ tự động reset. Để 0 để cho phép vô hạn lượt.
      </p>
      ```

4. **Save the file**

5. **Update the JavaScript** (see `app.js.MODIFICATIONS.js`)

6. **Add CSS styles** (see next section)

---

## CSS Additions

Add these styles to your `style.css` file:

```css
/* Task attempt badge */
.task-attempts-badge {
  display: inline-block;
  background-color: rgba(100, 150, 255, 0.15);
  color: #2563eb;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 8px;
  white-space: nowrap;
}

/* Task card when out of attempts */
.task-card.out-of-attempts {
  opacity: 0.6;
  pointer-events: none;
}

.task-card.out-of-attempts .stamp-btn {
  cursor: not-allowed;
  opacity: 0.5;
}

/* When creating Link4m link, show loading state */
button.stamp-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
```

---

## Verification Checklist

After making changes, verify:

- [ ] Task form has "Giới hạn lượt làm/ngày" field
- [ ] "Tự động tạo (Link4m)" button is removed/hidden
- [ ] Link field says "Link gốc" instead of "Link vượt"
- [ ] New tasks can be created with maxAttempts value
- [ ] Editing existing task shows maxAttempts field
- [ ] Task card displays [X/maxAttempts] badge for users
- [ ] Button disables when attempts are exhausted
- [ ] CSS styles are applied correctly

