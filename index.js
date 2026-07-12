/**
 * Cloud Functions cho BuiVinhh HUB
 * ------------------------------------------------------------
 * 2 functions:
 *  1) shortenLink   : ai cũng gọi được (user thường bấm "Lấy link vượt" sẽ gọi hàm này).
 *                      Đọc cấu hình nhà cung cấp (URL mẫu + API key) từ Firestore
 *                      settings/providersPrivate, gọi API rút gọn PHÍA SERVER (không bị CORS),
 *                      trả về link rút gọn cho client. API key KHÔNG bao giờ lộ ra trình duyệt.
 *  2) manageProviders: chỉ admin gọi được (phải gửi kèm "adminSecret" đúng).
 *                      Dùng để thêm/sửa/xoá/liệt kê đầy đủ nhà cung cấp (kể cả API key)
 *                      và đồng bộ ra settings/providersPublic (KHÔNG có api key) để client hiển thị.
 *
 * TRIỂN KHAI (deploy):
 *   1) Cài Firebase CLI:  npm install -g firebase-tools
 *   2) Đăng nhập:         firebase login
 *   3) Trong thư mục gốc project (chứa thư mục "functions" này):
 *        firebase init functions   (chọn project vippro-3c3cb, ngôn ngữ JavaScript, KHÔNG ghi đè file có sẵn)
 *      Rồi copy 2 file index.js + package.json này đè vào thư mục functions/ vừa tạo.
 *   4) Đặt admin secret (PHẢI trùng với ADMIN_PASSWORD trong app.js, hoặc 1 chuỗi bí mật riêng bạn tự chọn):
 *        firebase functions:config:set admin.secret="hmm_0804"
 *   5) Cài dependency rồi deploy:
 *        cd functions && npm install && cd ..
 *        firebase deploy --only functions
 *   6) Yêu cầu gói Blaze (trả theo dùng) cho project Firebase — bắt buộc để dùng Cloud Functions
 *      + gọi ra internet (outbound network request).
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const ADMIN_SECRET = () => (functions.config().admin && functions.config().admin.secret) || "";

// Điền {API_KEY} và {URL} trong URL mẫu của nhà cung cấp bằng giá trị thật.
function buildApiUrl(template, apiKey, longUrl) {
  return template
    .split("{API_KEY}").join(encodeURIComponent(apiKey || ""))
    .split("{URL}").join(encodeURIComponent(longUrl || ""));
}

// Lấy giá trị lồng nhau trong JSON theo đường dẫn kiểu "data.shortUrl"
function getByPath(obj, path) {
  if (!path) return undefined;
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

async function callProviderApi(provider, longUrl) {
  const url = buildApiUrl(provider.apiUrlTemplate, provider.apiKey, longUrl);
  const res = await fetch(url, { method: provider.method || "GET" });
  const text = await res.text();
  if (!res.ok) {
    throw new functions.https.HttpsError("internal", `Nhà cung cấp trả lỗi HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  let shortUrl = text.trim();
  if (provider.responseType === "json") {
    let json;
    try { json = JSON.parse(text); }
    catch (e) { throw new functions.https.HttpsError("internal", `Không parse được JSON: ${text.slice(0, 300)}`); }
    shortUrl = getByPath(json, provider.jsonPath);
  }
  if (!shortUrl || typeof shortUrl !== "string" || !/^https?:\/\//i.test(shortUrl)) {
    throw new functions.https.HttpsError("internal", `Phản hồi không hợp lệ từ nhà cung cấp: ${text.slice(0, 300)}`);
  }
  return shortUrl;
}

// ---------------- shortenLink: ai cũng gọi được (dùng khi user bấm "Lấy link vượt") ----------------
exports.shortenLink = functions.https.onCall(async (data) => {
  const { providerId, longUrl } = data || {};
  if (!providerId || !longUrl) {
    throw new functions.https.HttpsError("invalid-argument", "Thiếu providerId hoặc longUrl.");
  }
  const snap = await db.doc("settings/providersPrivate").get();
  const list = snap.exists ? (snap.data().list || {}) : {};
  const provider = list[providerId];
  if (!provider || provider.enabled === false) {
    throw new functions.https.HttpsError("not-found", "Nhà cung cấp không tồn tại hoặc đang tắt.");
  }
  const shortUrl = await callProviderApi(provider, longUrl);
  return { shortUrl };
});

// ---------------- manageProviders: chỉ admin (phải gửi đúng adminSecret) ----------------
exports.manageProviders = functions.https.onCall(async (data) => {
  const { adminSecret, action, providerId, provider, testUrl } = data || {};
  const expected = ADMIN_SECRET();
  if (!expected || adminSecret !== expected) {
    throw new functions.https.HttpsError("permission-denied", "Sai admin secret.");
  }

  const ref = db.doc("settings/providersPrivate");
  const publicRef = db.doc("settings/providersPublic");

  async function syncPublic(list) {
    const publicList = {};
    for (const id in list) {
      publicList[id] = { name: list[id].name, enabled: list[id].enabled !== false };
    }
    await publicRef.set({ list: publicList });
  }

  if (action === "list") {
    const snap = await ref.get();
    return { list: snap.exists ? (snap.data().list || {}) : {} };
  }

  if (action === "save") {
    if (!provider || !provider.name || !provider.apiUrlTemplate) {
      throw new functions.https.HttpsError("invalid-argument", "Thiếu tên hoặc URL mẫu của nhà cung cấp.");
    }
    const snap = await ref.get();
    const list = snap.exists ? (snap.data().list || {}) : {};
    const id = providerId || ("p" + Date.now());
    list[id] = {
      name: provider.name,
      apiUrlTemplate: provider.apiUrlTemplate,
      apiKey: provider.apiKey || "",
      method: provider.method || "GET",
      responseType: provider.responseType || "text",
      jsonPath: provider.jsonPath || "",
      enabled: provider.enabled !== false
    };
    await ref.set({ list });
    await syncPublic(list);
    return { ok: true, id };
  }

  if (action === "delete") {
    if (!providerId) throw new functions.https.HttpsError("invalid-argument", "Thiếu providerId.");
    const snap = await ref.get();
    const list = snap.exists ? (snap.data().list || {}) : {};
    delete list[providerId];
    await ref.set({ list });
    await syncPublic(list);
    return { ok: true };
  }

  if (action === "test") {
    if (!providerId || !testUrl) throw new functions.https.HttpsError("invalid-argument", "Thiếu providerId hoặc testUrl.");
    const snap = await ref.get();
    const list = snap.exists ? (snap.data().list || {}) : {};
    const p = list[providerId];
    if (!p) throw new functions.https.HttpsError("not-found", "Không tìm thấy nhà cung cấp.");
    const shortUrl = await callProviderApi(p, testUrl);
    return { shortUrl };
  }

  throw new functions.https.HttpsError("invalid-argument", "action không hợp lệ.");
});
