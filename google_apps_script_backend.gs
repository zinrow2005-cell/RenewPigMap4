/**
 * PKG87_FIX36｜台灣豬隻畜牧場地圖 Google Sheet 同步後端
 *
 * 修正重點：
 * 1. 支援舊前端送出的 action=replaceAll，避免前端顯示已送出但後端未寫入。
 * 2. 支援 JSONP callback，讓 GitHub Pages / PWA 可以穩定用 GET 讀取 Apps Script。
 * 3. 新增「共用端送審」流程：共用端不直接覆蓋正式資料庫，而是寫入 shared_submissions。
 * 4. 管理者端可以讀取 shared_submissions，核對後套用到正式 pig_farm_map_data。
 * 5. FIX35：共用端送審改支援 JSONP GET 寫入，前端可確認是否真的寫入審核區。
 *
 * 建議設定：
 * - ADMIN_TOKEN：管理者端使用，可上傳正式資料庫、讀取/審核共用端送審資料。
 * - EDITOR_TOKEN：共用端使用，只能下載正式資料與送出待審地標。
 * - 若你還在使用舊版單一 Token，也可只填 SYNC_TOKEN 或 PIGFARM_SYNC_TOKEN。
 */

const SPREADSHEET_ID = ''; // 綁定試算表可留空；獨立 Apps Script 請填試算表 ID
const SHEET_NAME = 'pig_farm_map_data';
const META_SHEET_NAME = 'sync_meta';
const PENDING_SHEET_NAME = 'shared_submissions';

// 管理者 Token：建議放你的管理者端 URL 或管理者同步設定內
const ADMIN_TOKEN = '';

// 共用端 Token：可放在共用端 URL：index.html?mode=shared&token=你的EDITOR_TOKEN
const EDITOR_TOKEN = '';

// 舊版相容 Token：若只想用一組 Token，可填這裡；會視為管理者 Token
const SYNC_TOKEN = '';
const PIGFARM_SYNC_TOKEN = '';

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = normalizeAction_(p.action || 'ping');
    const token = String(p.token || '');
    const callback = String(p.callback || '').trim();

    if (action === 'ping') {
      const auth = checkToken_(token, 'viewer');
      if (!auth.ok) return json_(auth, callback);
      return json_({
        ok: true,
        action: 'ping',
        message: 'Apps Script Web App 已連線',
        supportedActions: ['ping', 'list', 'download', 'read', 'upload', 'replaceAll', 'submit', 'listPending', 'approvePending', 'rejectPending'],
        sheetName: SHEET_NAME,
        pendingSheetName: PENDING_SHEET_NAME,
        serverTime: new Date().toISOString(),
        role: auth.role
      }, callback);
    }

    if (action === 'list' || action === 'download' || action === 'read') {
      const auth = checkToken_(token, 'viewer');
      if (!auth.ok) return json_(auth, callback);
      const farms = readFarms_();
      return json_({
        ok: true,
        action: action,
        count: farms.length,
        farms: farms,
        data: farms,
        rows: farms,
        meta: readMeta_(),
        serverTime: new Date().toISOString(),
        role: auth.role
      }, callback);
    }

    if (action === 'pending' || action === 'listpending' || action === 'listsubmissions' || action === 'submissions') {
      const auth = checkToken_(token, 'admin');
      if (!auth.ok) return json_(auth, callback);
      const includeAll = String(p.includeAll || '').toLowerCase() === 'true' || String(p.includeAll || '') === '1';
      const rows = readPending_(includeAll);
      return json_({
        ok: true,
        action: 'listPending',
        count: rows.length,
        submissions: rows,
        rows: rows,
        serverTime: new Date().toISOString(),
        role: auth.role
      }, callback);
    }

    // FIX35：共用端送審使用 JSONP GET，避免 no-cors 造成「看似成功但後端拒收」無法判斷。
    if (action === 'submit' || action === 'sharedsubmit' || action === 'sharedupload' || action === 'submission') {
      const auth = checkToken_(token, 'editor');
      if (!auth.ok) return json_(auth, callback);
      const farm = parseFarmParam_(p);
      if (!farm) return json_({ ok: false, message: '沒有收到可送審的地標資料' }, callback);
      const ids = appendPending_([farm], {
        submittedBy: p.submittedBy || p.user || '',
        clientMode: p.clientMode || p.mode || 'shared',
        clientTime: p.clientTime || '',
        source: p.source || 'PKG87_FIX36_JSONP_SUBMIT',
        reason: p.reason || p.actionReason || 'sharedSubmit'
      }, auth.role);
      return json_({
        ok: true,
        action: 'submit',
        count: ids.length,
        submissionIds: ids,
        message: '共用端地標已送入管理者審核區',
        serverTime: new Date().toISOString(),
        role: auth.role
      }, callback);
    }

    // FIX35：管理端審核動作也支援 JSONP GET，讓前端可確認狀態是否更新成功。
    if (action === 'approvepending' || action === 'approve') {
      const auth = checkToken_(token, 'admin');
      if (!auth.ok) return json_(auth, callback);
      const id = String(p.submissionId || p.id || '').trim();
      if (!id) return json_({ ok: false, message: '缺少 submissionId' }, callback);
      updatePendingStatus_(id, '已核准', p.adminNote || '');
      return json_({ ok: true, action: 'approvePending', submissionId: id, message: '已標記為核准', serverTime: new Date().toISOString(), role: auth.role }, callback);
    }

    if (action === 'rejectpending' || action === 'reject') {
      const auth = checkToken_(token, 'admin');
      if (!auth.ok) return json_(auth, callback);
      const id = String(p.submissionId || p.id || '').trim();
      if (!id) return json_({ ok: false, message: '缺少 submissionId' }, callback);
      updatePendingStatus_(id, '已退回', p.adminNote || '');
      return json_({ ok: true, action: 'rejectPending', submissionId: id, message: '已標記為退回', serverTime: new Date().toISOString(), role: auth.role }, callback);
    }

    return json_({
      ok: false,
      message: '不支援的 action: ' + action,
      supportedActions: ['ping', 'list', 'download', 'read', 'upload', 'replaceAll', 'submit', 'listPending', 'approvePending', 'rejectPending']
    }, callback);
  } catch (err) {
    return json_({ ok: false, message: String(err && err.message ? err.message : err) }, (e && e.parameter && e.parameter.callback) || '');
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(body || '{}');
    const action = normalizeAction_(data.action || 'upload');
    const token = String(data.token || '');

    if (action === 'upload' || action === 'save') {
      const auth = checkToken_(token, 'admin');
      if (!auth.ok) return json_(auth);
      const farms = Array.isArray(data.farms) ? data.farms : [];
      writeFarms_(farms);
      writeMeta_({
        version: data.version || data.meta && data.meta.version || '',
        source: data.source || '',
        updatedAt: data.updatedAt || data.clientTime || new Date().toISOString(),
        count: farms.length,
        meta: data.meta || {}
      });
      return json_({
        ok: true,
        action: 'upload',
        count: farms.length,
        message: '正式牧場資料已寫入 Google Sheet',
        serverTime: new Date().toISOString(),
        role: auth.role
      });
    }

    if (action === 'submit' || action === 'sharedsubmit' || action === 'sharedupload' || action === 'submission') {
      const auth = checkToken_(token, 'editor');
      if (!auth.ok) return json_(auth);
      const farms = Array.isArray(data.farms) ? data.farms : (data.farm ? [data.farm] : []);
      if (!farms.length) return json_({ ok: false, message: '沒有收到可送審的地標資料' });
      const ids = appendPending_(farms, data, auth.role);
      return json_({
        ok: true,
        action: 'submit',
        count: ids.length,
        submissionIds: ids,
        message: '共用端地標已送入管理者審核區',
        serverTime: new Date().toISOString(),
        role: auth.role
      });
    }

    if (action === 'approvepending' || action === 'approve') {
      const auth = checkToken_(token, 'admin');
      if (!auth.ok) return json_(auth);
      const id = String(data.submissionId || data.id || '').trim();
      if (!id) return json_({ ok: false, message: '缺少 submissionId' });
      updatePendingStatus_(id, '已核准', data.adminNote || '');
      return json_({ ok: true, action: 'approvePending', submissionId: id, message: '已標記為核准', serverTime: new Date().toISOString() });
    }

    if (action === 'rejectpending' || action === 'reject') {
      const auth = checkToken_(token, 'admin');
      if (!auth.ok) return json_(auth);
      const id = String(data.submissionId || data.id || '').trim();
      if (!id) return json_({ ok: false, message: '缺少 submissionId' });
      updatePendingStatus_(id, '已退回', data.adminNote || '');
      return json_({ ok: true, action: 'rejectPending', submissionId: id, message: '已標記為退回', serverTime: new Date().toISOString() });
    }

    return json_({
      ok: false,
      message: '不支援的 action: ' + action,
      supportedActions: ['ping', 'list', 'download', 'read', 'upload', 'replaceAll', 'submit', 'listPending', 'approvePending', 'rejectPending']
    });
  } catch (err) {
    return json_({ ok: false, message: String(err && err.message ? err.message : err) });
  }
}

function normalizeAction_(action) {
  action = String(action || '').toLowerCase().trim();
  if (action === 'get' || action === 'fetch') return 'download';
  if (action === 'load') return 'list';
  if (action === 'write') return 'upload';
  if (action === 'replaceall' || action === 'replace_all' || action === 'replace-all') return 'upload';
  if (action === 'listpending' || action === 'list_pending' || action === 'list-submissions') return 'listpending';
  if (action === 'approvepending' || action === 'approve_pending') return 'approvepending';
  if (action === 'rejectpending' || action === 'reject_pending') return 'rejectpending';
  if (action === 'sharedsubmit' || action === 'shared_upload' || action === 'shared-upload') return 'submit';
  return action || 'ping';
}

function getBook_() {
  if (SPREADSHEET_ID && String(SPREADSHEET_ID).trim()) {
    return SpreadsheetApp.openById(String(SPREADSHEET_ID).trim());
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('找不到綁定的 Google Sheet。若使用獨立 Apps Script，請設定 SPREADSHEET_ID。');
  }
  return active;
}

function getSheet_(name) {
  const book = getBook_();
  let sh = book.getSheetByName(name);
  if (!sh) sh = book.insertSheet(name);
  return sh;
}

function tokenConfig_() {
  const admin = String(ADMIN_TOKEN || SYNC_TOKEN || PIGFARM_SYNC_TOKEN || '').trim();
  const editor = String(EDITOR_TOKEN || '').trim();
  return { admin: admin, editor: editor };
}

function checkToken_(token, requiredRole) {
  token = String(token || '').trim();
  const cfg = tokenConfig_();

  // 未設定任何 Token 時，維持舊版免 Token 行為，方便初次測試。
  if (!cfg.admin && !cfg.editor) return { ok: true, role: 'admin' };

  if (cfg.admin && token === cfg.admin) return { ok: true, role: 'admin' };
  if (cfg.editor && token === cfg.editor) {
    if (requiredRole === 'admin') return { ok: false, message: '管理者 Token 驗證失敗：共用端 Token 不能執行管理者動作' };
    return { ok: true, role: 'editor' };
  }

  if (requiredRole === 'admin') return { ok: false, message: '管理者 Token 驗證失敗' };
  if (requiredRole === 'editor') return { ok: false, message: '共用端 Token 驗證失敗' };
  return { ok: false, message: '同步 Token 不正確' };
}

function writeFarms_(farms) {
  const sh = getSheet_(SHEET_NAME);
  sh.clearContents();

  const keys = collectKeys_(farms);
  if (!keys.length) keys.push('id', 'name', 'county', 'town', 'village', 'address', 'lat', 'lng');

  sh.getRange(1, 1, 1, keys.length).setValues([keys]);

  if (farms.length) {
    const rows = farms.map(f => keys.map(k => valueToCell_(f[k])));
    sh.getRange(2, 1, rows.length, keys.length).setValues(rows);
  }

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, Math.min(keys.length, 26));
}

function readFarms_() {
  const sh = getSheet_(SHEET_NAME);
  const range = sh.getDataRange();
  const values = range ? range.getValues() : [];
  if (!values || values.length < 2) return [];

  const keys = values[0].map(v => String(v || '').trim());
  return values.slice(1)
    .filter(row => row.some(v => v !== '' && v !== null))
    .map(row => {
      const obj = {};
      keys.forEach((k, i) => {
        if (!k) return;
        obj[k] = cellToValue_(row[i]);
      });
      return obj;
    });
}

function collectKeys_(farms) {
  const preferred = [
    'id','name','county','town','village','address','status','auditStatus',
    'lat','lng','source','note','updatedAt','isMainFarm','marked','verified',
    'addressLevel','lastChecked','nameAddressReview','mapLocationReview','finalApproval',
    'reviewSource','reviewSubmissionId','reviewAppliedAt'
  ];
  const seen = {};
  const keys = [];
  preferred.forEach(k => { seen[k] = true; keys.push(k); });
  farms.forEach(f => Object.keys(f || {}).forEach(k => {
    if (!seen[k]) {
      seen[k] = true;
      keys.push(k);
    }
  }));
  return keys;
}

function valueToCell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function cellToValue_(v) {
  if (v === '') return '';
  if (typeof v === 'string') {
    const s = v.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try { return JSON.parse(s); } catch (e) {}
    }
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return v;
}

function writeMeta_(obj) {
  const sh = getSheet_(META_SHEET_NAME);
  sh.clearContents();
  const rows = [
    ['key', 'value'],
    ['updatedAt', obj.updatedAt || new Date().toISOString()],
    ['version', obj.version || ''],
    ['source', obj.source || ''],
    ['count', obj.count || 0],
    ['meta', JSON.stringify(obj.meta || {})]
  ];
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.setFrozenRows(1);
}

function readMeta_() {
  const sh = getSheet_(META_SHEET_NAME);
  const values = sh.getDataRange().getValues();
  const meta = {};
  values.slice(1).forEach(r => {
    if (r[0] !== '') meta[String(r[0])] = r[1];
  });
  return meta;
}

function parseFarmParam_(p) {
  p = p || {};
  const raw = String(p.farmJson || p.farm || p.payload || '').trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e1) {
      try {
        return JSON.parse(decodeURIComponent(raw));
      } catch (e2) {
        throw new Error('farmJson 格式錯誤，無法解析送審地標');
      }
    }
  }
  const farm = {
    id: p.farmId || p.id || '',
    name: p.name || '',
    county: p.county || '',
    town: p.town || '',
    village: p.village || '',
    address: p.address || '',
    lat: p.lat || '',
    lng: p.lng || '',
    note: p.note || ''
  };
  return (farm.name || farm.address || farm.lat || farm.lng) ? farm : null;
}

function pendingHeaders_() {
  return [
    'submissionId','status','createdAt','updatedAt','submittedRole','submittedBy','clientMode','clientTime','source','actionReason',
    'farmId','name','county','town','village','address','lat','lng','note','farmJson','adminNote'
  ];
}

function getPendingSheet_() {
  const sh = getSheet_(PENDING_SHEET_NAME);
  const headers = pendingHeaders_();
  const existing = sh.getLastRow() ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0].map(v => String(v || '').trim()) : [];
  const needsHeader = !existing.length || existing[0] !== 'submissionId';
  if (needsHeader) {
    sh.clearContents();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function appendPending_(farms, data, role) {
  const sh = getPendingSheet_();
  const headers = pendingHeaders_();
  const now = new Date().toISOString();
  const ids = [];
  const rows = farms.map((farm, i) => {
    farm = farm || {};
    const id = 'P' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 100000) + '-' + (i + 1);
    ids.push(id);
    const rowObj = {
      submissionId: id,
      status: '待審核',
      createdAt: now,
      updatedAt: now,
      submittedRole: role || '',
      submittedBy: data.submittedBy || data.user || '',
      clientMode: data.clientMode || data.mode || '',
      clientTime: data.clientTime || '',
      source: data.source || '',
      actionReason: data.reason || data.actionReason || '',
      farmId: farm.id || '',
      name: farm.name || '',
      county: farm.county || '',
      town: farm.town || '',
      village: farm.village || '',
      address: farm.address || '',
      lat: farm.lat || '',
      lng: farm.lng || '',
      note: farm.note || '',
      farmJson: JSON.stringify(farm || {}),
      adminNote: ''
    };
    return headers.map(h => rowObj[h] === undefined ? '' : rowObj[h]);
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  sh.autoResizeColumns(1, Math.min(headers.length, 12));
  return ids;
}

function readPending_(includeAll) {
  const sh = getPendingSheet_();
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  const headers = values[0].map(v => String(v || '').trim());
  return values.slice(1)
    .filter(row => row.some(v => v !== '' && v !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = cellToValue_(row[i]); });
      if (obj.farmJson) {
        try { obj.farm = JSON.parse(obj.farmJson); } catch (e) { obj.farm = {}; }
      } else {
        obj.farm = {};
      }
      if (obj.lat !== '' && obj.lat !== null && obj.lat !== undefined) obj.lat = Number(obj.lat);
      if (obj.lng !== '' && obj.lng !== null && obj.lng !== undefined) obj.lng = Number(obj.lng);
      if (obj.farm && obj.farm.lat !== '' && obj.farm.lat !== null && obj.farm.lat !== undefined) obj.farm.lat = Number(obj.farm.lat);
      if (obj.farm && obj.farm.lng !== '' && obj.farm.lng !== null && obj.farm.lng !== undefined) obj.farm.lng = Number(obj.farm.lng);
      return obj;
    })
    .filter(obj => includeAll || String(obj.status || '') === '待審核');
}

function updatePendingStatus_(submissionId, status, adminNote) {
  const sh = getPendingSheet_();
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) throw new Error('尚無待審資料');
  const headers = values[0].map(v => String(v || '').trim());
  const idCol = headers.indexOf('submissionId') + 1;
  const statusCol = headers.indexOf('status') + 1;
  const updatedCol = headers.indexOf('updatedAt') + 1;
  const noteCol = headers.indexOf('adminNote') + 1;
  if (!idCol || !statusCol) throw new Error('shared_submissions 欄位不完整');
  for (let r = 2; r <= values.length; r++) {
    if (String(values[r - 1][idCol - 1]) === submissionId) {
      sh.getRange(r, statusCol).setValue(status);
      if (updatedCol) sh.getRange(r, updatedCol).setValue(new Date().toISOString());
      if (noteCol) sh.getRange(r, noteCol).setValue(adminNote || '');
      return true;
    }
  }
  throw new Error('找不到 submissionId：' + submissionId);
}

function safeCallbackName_(callback) {
  callback = String(callback || '').trim();
  if (!callback) return '';
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback) ? callback : '';
}

function json_(obj, callback) {
  const cb = safeCallbackName_(callback || '');
  const text = JSON.stringify(obj);
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
