// ═══════════════════════════════════════════════════════
//   Unacademy Gwalior LMS — app.js
// ═══════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════╗
// ║          ⚙️  CONFIGURATION — EDIT THESE ONLY            ║
// ╚══════════════════════════════════════════════════════════╝
const CONFIG = {
  ADMIN: {
    email    : 'admin@unacademygwalior.com',
    password : 'Admin@123',
    name     : 'Admin',
  },
};

// ╔══════════════════════════════════════════════════════════╗
// ║                    APP STATE                            ║
// ╚══════════════════════════════════════════════════════════╝
let STATE = {
  user     : null,
  batches  : [],
  students : [],
  lectures : [],
  section  : '',
  trash    : { batches:[], students:[], lectures:[] },
  // activeOverrides: { [studentId]: 'true'|'false' }
  // Admin changes here survive refresh even if sheet write is slow
  activeOverrides: {},
};

// ╔══════════════════════════════════════════════════════════╗
// ║                   DEMO DATA (fallback)                  ║
// ╚══════════════════════════════════════════════════════════╝
const DEMO = {
  batches: [
    {id:'B1', name:'JEE 2025 Batch A'},
    {id:'B2', name:'NEET 2025 Morning'},
    {id:'B3', name:'Class 12 Science'},
  ],
  students: [
    {id:'S1', name:'Rahul Sharma', email:'rahul@gmail.com', batchId:'B1', active:'true',  password:'demo123'},
    {id:'S2', name:'Priya Verma',  email:'priya@gmail.com', batchId:'B2', active:'true',  password:'demo123'},
    {id:'S3', name:'Amit Singh',   email:'amit@gmail.com',  batchId:'B1', active:'true',  password:'demo123'},
    {id:'S4', name:'Neha Gupta',   email:'neha@gmail.com',  batchId:'B3', active:'false', password:'demo123'},
  ],
  lectures: [
    {id:'L1', title:"Newton's Laws Part 1",   batchId:'B1', ytId:'kKKM8Y-u7ds', subject:'Physics',   date:'2024-03-10'},
    {id:'L2', title:'Limits & Derivatives',    batchId:'B1', ytId:'WsQQvHm4lSw', subject:'Maths',     date:'2024-03-11'},
    {id:'L3', title:'Digestive System',        batchId:'B2', ytId:'Ae4MadKPJhg', subject:'Biology',   date:'2024-03-12'},
    {id:'L4', title:'Electrochemistry Basics', batchId:'B3', ytId:'gRKJMHwlMtE', subject:'Chemistry', date:'2024-03-13'},
    {id:'L5', title:'Calculus Integration',    batchId:'B1', ytId:'rfG8ce4nNh0', subject:'Maths',     date:'2024-03-14'},
  ],
};

const usingDemo = () => false; // data.js is always the source

// ╔══════════════════════════════════════════════════════════╗
// ║              HELPERS                                    ║
// ╚══════════════════════════════════════════════════════════╝
const esc       = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const batchName = id => (STATE.batches.find(b=>b.id===id)||{name:'—'}).name;
const ytThumb   = id => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
const ytEmbed   = id => `https://www.youtube.com/embed/${id}?autoplay=1`;
const today     = () => new Date().toISOString().slice(0,10);
const uid       = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const setMain   = html => document.getElementById('mainArea').innerHTML = html;

// ── KEY FIX: normalize active field — Sheets stores TRUE/FALSE uppercase ──
// This is what caused "all students showing inactive after refresh"
const isActive  = s => String(s.active).toLowerCase() === 'true';

// ╔══════════════════════════════════════════════════════════╗
// ║              GOOGLE SHEETS — CSV FETCH                  ║
// ╚══════════════════════════════════════════════════════════╝
function parseCSV(text) {
  const rows = [];
  const lines = text.trim().split('\n');
  for (const line of lines) {
    const row = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        row.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

async function fetchSheet(url) {
  try {
    const r = await fetch(url + '&cb=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    const rows = parseCSV(text);
    if (rows.length < 1) return [];
    const headers = rows[0];
    return rows.slice(1)
      .filter(row => row.some(c => c !== ''))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i] || '');
        // ── NORMALIZE active field here ──
        if ('active' in obj) {
          obj.active = String(obj.active).toLowerCase() === 'true' ? 'true' : 'false';
        }
        return obj;
      });
  } catch (e) {
    console.error('Sheet fetch error:', e);
    return [];
  }
}

async function loadAllData() {
  // Load from data.js (DB global) — always fresh, no network needed
  STATE.batches  = (DB.batches  || []).map(b => ({...b}));
  STATE.students = (DB.students || []).map(s => ({...s}));
  STATE.lectures = (DB.lectures || []).map(l => ({...l}));
}

// writeToSheet is a no-op — data lives in data.js on GitHub
// Use Admin Panel → "💾 Export data.js" to get updated file, then paste on GitHub
async function writeToSheet(action, data) {
  return { success: true };
}

// ╔══════════════════════════════════════════════════════════╗
// ║                      TOAST                              ║
// ╚══════════════════════════════════════════════════════════╝
function toast(msg, type = 'i') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => el.className = 'toast', 3200);
}

// ╔══════════════════════════════════════════════════════════╗
// ║             MOBILE HAMBURGER MENU                       ║
// ╚══════════════════════════════════════════════════════════╝
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
  hamburger.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
  document.getElementById('hamburger').classList.remove('open');
}

// ╔══════════════════════════════════════════════════════════╗
// ║                       AUTH                              ║
// ╚══════════════════════════════════════════════════════════╝
function showStep(id) {
  ['stepEmail','stepAdmin'].forEach(s =>
    document.getElementById(s).classList.add('hidden')
  );
  document.getElementById(id).classList.remove('hidden');
}

async function studentLogin() {
  const emailVal = document.getElementById('emailInput').value.trim().toLowerCase();
  const password = document.getElementById('passInput').value.trim();
  const btn      = document.getElementById('studentLoginBtn');

  if (!emailVal || !password) { toast('Enter email and password', 'e'); return; }
  btn.disabled = true; btn.textContent = 'Logging in...';

  await loadAllData();
  const student = STATE.students.find(s => (s.email||'').toLowerCase() === emailVal);

  if (!student) {
    toast('No account found with that email', 'e');
    btn.disabled = false; btn.textContent = 'Login →'; return;
  }
  if (String(student.password).trim() !== password) {
    toast('Incorrect password', 'e');
    btn.disabled = false; btn.textContent = 'Login →'; return;
  }
  if (!isActive(student)) {
    toast('Your account is inactive. Contact admin.', 'e');
    btn.disabled = false; btn.textContent = 'Login →'; return;
  }

  STATE.user = { name: student.name, email: emailVal, role: 'student', batchId: student.batchId };
  localStorage.setItem('userSession', JSON.stringify(STATE.user));
  btn.disabled = false; btn.textContent = 'Login →';
  launchApp();
}

async function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('adminPass').value;
  const btn   = document.getElementById('adminBtn');

  if (email === CONFIG.ADMIN.email.toLowerCase() && pass === CONFIG.ADMIN.password) {
    btn.disabled = true; btn.textContent = 'Logging in...';
    await loadAllData();
    STATE.user = { name: CONFIG.ADMIN.name, email, role: 'admin' };
    localStorage.setItem('userSession', JSON.stringify(STATE.user));
    btn.disabled = false; btn.textContent = 'Login as Admin →';
    launchApp();
  } else {
    toast('Wrong credentials', 'e');
  }
}

function logout() {
  STATE.user = null;
  localStorage.removeItem('userSession');
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  showStep('stepEmail');
  document.getElementById('emailInput').value = '';
  document.getElementById('passInput').value  = '';
  document.getElementById('adminPass').value  = '';
}

// ╔══════════════════════════════════════════════════════════╗
// ║                  AUTO-LOGIN FROM STORAGE                ║
// ╚══════════════════════════════════════════════════════════╝
async function checkStoredLogin() {
  const stored = localStorage.getItem('userSession');
  if (stored) {
    try {
      STATE.user = JSON.parse(stored);
      await loadAllData();
      launchApp();
    } catch(e) {
      localStorage.removeItem('userSession');
    }
  }
}

// ╔══════════════════════════════════════════════════════════╗
// ║                    APP LAUNCH                           ║
// ╚══════════════════════════════════════════════════════════╝
function launchApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  const u = STATE.user;
  document.getElementById('navName').textContent = u.name;
  const pill = document.getElementById('navPill');
  if (u.role === 'admin') { pill.textContent = 'Admin';   pill.className = 'nav-pill admin';   }
  else                    { pill.textContent = 'Student'; pill.className = 'nav-pill student'; }

  buildSidebar();
  navigate(u.role === 'admin' ? 'dashboard' : 'myLectures');

  if (usingDemo()) {
    setTimeout(() => toast('📋 Running in DEMO mode. Configure Google Sheets to go live.', 'i'), 800);
  }
}

// ╔══════════════════════════════════════════════════════════╗
// ║                     SIDEBAR                             ║
// ╚══════════════════════════════════════════════════════════╝
function buildSidebar() {
  const isAdmin = STATE.user.role === 'admin';
  const items = isAdmin ? [
    { section: 'Overview' },
    { id:'dashboard',  icon:'📊', label:'Dashboard'   },
    { section: 'Manage' },
    { id:'batches',    icon:'🗂️', label:'Batches'     },
    { id:'students',   icon:'👤', label:'Students'    },
    { id:'lectures',   icon:'▶️', label:'Lectures'    },
    { section: 'Other' },
    { id:'recycleBin', icon:'🗑️', label:'Recycle Bin' },
    { id:'exportData',  icon:'💾', label:'Export data.js' },
  ] : [
    { section: 'Learning' },
    { id:'myLectures', icon:'▶️', label:'My Lectures' },
  ];

  document.getElementById('sidebar').innerHTML = items.map(item =>
    item.section
      ? `<div class="sidebar-section">${item.section}</div>`
      : `<div class="sidebar-item" id="nav-${item.id}" onclick="navigate('${item.id}');closeSidebar()">
           <span class="sidebar-icon">${item.icon}</span>${item.label}
         </div>`
  ).join('');
}

function navigate(sec) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('nav-' + sec);
  if (el) el.classList.add('active');
  STATE.section = sec;
  const views = { dashboard, batches, students, lectures, myLectures, recycleBin, exportData };
  if (views[sec]) views[sec]();
}

// ╔══════════════════════════════════════════════════════════╗
// ║                  VIDEO MODAL                            ║
// ╚══════════════════════════════════════════════════════════╝
function openVideo(ytId, title, subject, batch, date) {
  document.getElementById('vModalTitle').textContent = title;
  document.getElementById('vModalMeta').textContent  = `${subject} · ${batch} · ${date}`;
  document.getElementById('vFrame').src = ytEmbed(ytId);
  document.getElementById('vModal').classList.remove('hidden');
}
function closeVideo() {
  document.getElementById('vModal').classList.add('hidden');
  document.getElementById('vFrame').src = '';
}

// ╔══════════════════════════════════════════════════════════╗
// ║               STUDENT: MY LECTURES                      ║
// ╚══════════════════════════════════════════════════════════╝
function myLectures() {
  const u = STATE.user;
  // ── Always get the freshest batchId from STATE.students (admin may have changed it) ──
  const liveStudent = STATE.students.find(s => s.email.toLowerCase() === u.email.toLowerCase());
  const currentBatchId = liveStudent ? liveStudent.batchId : u.batchId;
  // Sync STATE.user.batchId so it stays current
  if (liveStudent && liveStudent.batchId !== u.batchId) {
    u.batchId = liveStudent.batchId;
    localStorage.setItem('userSession', JSON.stringify(u));
  }
  const lecs = STATE.lectures.filter(l => l.batchId === currentBatchId);
  const bn   = batchName(currentBatchId);

  setMain(`
    <div class="page-header">
      <div class="page-title">My Lectures</div>
      <div class="page-sub">Batch: <strong>${esc(bn)}</strong> · ${lecs.length} video${lecs.length!==1?'s':''} available</div>
    </div>
    ${!lecs.length
      ? `<div class="empty"><div class="empty-ico">📹</div><div class="empty-t">No lectures yet</div><div class="empty-s">Your teacher will upload videos soon</div></div>`
      : `<div class="video-grid">
          ${lecs.map(l=>`
            <div class="vcard" onclick="openVideo('${esc(l.ytId)}','${esc(l.title)}','${esc(l.subject)}','${esc(bn)}','${esc(l.date)}')">
              <div class="vthumb">
                <img src="${ytThumb(l.ytId)}" alt="${esc(l.title)}" loading="lazy"
                  onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 9%22><rect fill=%22%230f172a%22 width=%2216%22 height=%229%22/></svg>'">
                <div class="play-btn"><div class="play-tri"></div></div>
              </div>
              <div class="vinfo">
                <div class="vtitle">${esc(l.title)}</div>
                <div class="vmeta"><span class="vsubject">${esc(l.subject)}</span><span>${esc(l.date)}</span></div>
              </div>
            </div>`).join('')}
        </div>`}
  `);
}

// ╔══════════════════════════════════════════════════════════╗
// ║               ADMIN: DASHBOARD                          ║
// ╚══════════════════════════════════════════════════════════╝
function dashboard() {
  const B      = STATE.batches.length;
  const S      = STATE.students.length;
  const L      = STATE.lectures.length;
  const recent = [...STATE.lectures].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);

  setMain(`
    <div class="page-header">
      <div class="page-title">Dashboard</div>
      <div class="page-sub">Welcome back, ${esc(STATE.user.name)}!</div>
    </div>
    <div class="stats-grid">
      <div class="stat"><div class="stat-label">Batches</div><div class="stat-val blue">${B}</div></div>
      <div class="stat"><div class="stat-label">Students</div><div class="stat-val green">${S}</div></div>
      <div class="stat"><div class="stat-label">Lectures</div><div class="stat-val orange">${L}</div></div>
    </div>
    <div class="card">
      <div class="card-title">📊 Lectures per Batch</div>
      ${STATE.batches.map(b=>{
        const c   = STATE.lectures.filter(l=>l.batchId===b.id).length;
        const pct = L ? Math.round(c/L*100) : 0;
        return `<div style="margin-bottom:14px;">
          <div class="flex-between" style="margin-bottom:5px;flex-wrap:nowrap;">
            <span style="font-size:13px;font-weight:600;">${esc(b.name)}</span>
            <span style="font-size:13px;color:var(--muted);white-space:nowrap;">${c} lecture${c!==1?'s':''}</span>
          </div>
          <div class="progress-bg"><div class="progress-fill" style="width:${Math.max(pct,2)}%;"></div></div>
        </div>`;
      }).join('')}
    </div>
    <div class="card">
      <div class="card-title">🕒 Recent Lectures</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Subject</th><th>Batch</th><th>Date</th></tr></thead>
          <tbody>
            ${recent.map(l=>`<tr>
              <td style="font-weight:600;">${esc(l.title)}</td>
              <td><span class="badge badge-blue">${esc(l.subject)}</span></td>
              <td>${esc(batchName(l.batchId))}</td>
              <td style="color:var(--muted);">${esc(l.date)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

// ╔══════════════════════════════════════════════════════════╗
// ║               ADMIN: BATCHES                            ║
// ╚══════════════════════════════════════════════════════════╝
function batches() {
  setMain(`
    <div class="page-header">
      <div class="page-title">Batches</div>
      <div class="page-sub">Create and manage your student batches</div>
    </div>
    <div class="card">
      <div class="card-title">➕ Create New Batch</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Batch Name</label>
          <input class="form-input" id="bName" placeholder="e.g. JEE 2026 Morning Batch"
            onkeydown="if(event.key==='Enter')addBatch()">
        </div>
        <div style="padding-top:22px;"><button class="btn btn-primary" onclick="addBatch()">Add Batch</button></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🗂️ All Batches (${STATE.batches.length})</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Batch Name</th><th>Students</th><th>Lectures</th><th>Actions</th></tr></thead>
          <tbody id="batchTbody">${batchRows()}</tbody>
        </table>
      </div>
    </div>
  `);
}
function batchRows() {
  if (!STATE.batches.length)
    return '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px;">No batches yet</td></tr>';
  return STATE.batches.map((b,i)=>`<tr id="brow-${b.id}">
    <td style="color:var(--muted);font-family:'JetBrains Mono',monospace;">${i+1}</td>
    <td style="font-weight:700;" id="bname-${b.id}">${esc(b.name)}</td>
    <td>${STATE.students.filter(s=>s.batchId===b.id).length}</td>
    <td>${STATE.lectures.filter(l=>l.batchId===b.id).length}</td>
    <td class="td-actions">
      <button class="btn btn-ghost btn-sm" onclick="editBatchInline('${b.id}')">✏️ Edit</button>
      <button class="btn-trash" title="Move to Recycle Bin" onclick="trashBatch('${b.id}')">🗑️</button>
    </td>
  </tr>`).join('');
}
function editBatchInline(id) {
  const b = STATE.batches.find(b=>b.id===id);
  if (!b) return;
  const row = document.getElementById('brow-'+id);
  row.innerHTML = `
    <td style="color:var(--muted);">✏️</td>
    <td colspan="3">
      <input class="form-input" id="bedit-${id}" value="${esc(b.name)}"
        style="padding:7px 12px;font-size:13px;"
        onkeydown="if(event.key==='Enter')saveBatchEdit('${id}');if(event.key==='Escape')batches()">
    </td>
    <td class="td-actions">
      <button class="btn btn-success btn-sm" onclick="saveBatchEdit('${id}')">Save</button>
      <button class="btn btn-ghost btn-sm" onclick="batches()">Cancel</button>
    </td>`;
  document.getElementById('bedit-'+id).focus();
  document.getElementById('bedit-'+id).select();
}
async function saveBatchEdit(id) {
  const b    = STATE.batches.find(b=>b.id===id);
  const name = document.getElementById('bedit-'+id).value.trim();
  if (!name) { toast('Enter batch name','e'); return; }
  b.name = name;
  toast('Batch updated!','s');
  await writeToSheet('updateBatch', b);
  batches();
}
async function addBatch() {
  const name = document.getElementById('bName').value.trim();
  if (!name) { toast('Enter batch name', 'e'); return; }
  const newB = { id: uid(), name };
  STATE.batches.push(newB);
  document.getElementById('bName').value = '';
  document.getElementById('batchTbody').innerHTML = batchRows();
  toast('Batch created!', 's');
  await writeToSheet('addBatch', newB);
}
async function trashBatch(id) {
  const b = STATE.batches.find(b=>b.id===id);
  if (!confirm(`Move "${b.name}" to Recycle Bin?`)) return;
  STATE.trash.batches.unshift({ ...b, deletedAt: new Date().toLocaleString() });
  STATE.batches = STATE.batches.filter(b=>b.id!==id);
  document.getElementById('batchTbody').innerHTML = batchRows();
  toast('Moved to Recycle Bin 🗑️');
  await writeToSheet('deleteBatch', { id });
}

// ╔══════════════════════════════════════════════════════════╗
// ║               ADMIN: STUDENTS                           ║
// ╚══════════════════════════════════════════════════════════╝
function students() {
  const bOpts = STATE.batches.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  setMain(`
    <div class="page-header">
      <div class="page-title">Students</div>
      <div class="page-sub">Add and manage student accounts</div>
    </div>
    <div class="card">
      <div class="card-title">➕ Add Student</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="sName" placeholder="Student's full name"></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="sEmail" type="email" placeholder="student@gmail.com"></div>
        <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="sPassword" type="password" placeholder="Set student password"></div>
        <div class="form-group"><label class="form-label">Batch</label>
          <select class="form-select" id="sBatch">${bOpts||'<option value="">Create a batch first</option>'}</select>
        </div>
        <div style="padding-top:22px;"><button class="btn btn-primary" onclick="addStudent()">Add</button></div>
      </div>
    </div>
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px;">
        <div class="card-title" style="margin:0;">👤 All Students (${STATE.students.length})</div>
        <input class="search-box" placeholder="Search name or email…" oninput="filterStudents(this.value)">
      </div>
      <!-- Desktop table (hidden on mobile via CSS) -->
      <div class="table-wrap mobile-hide">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Batch</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="sTbody">${studentRows(STATE.students)}</tbody>
        </table>
      </div>
      <!-- Mobile cards (shown on mobile via CSS) -->
      <div class="student-cards" id="sCards">${studentMobileCards(STATE.students)}</div>
    </div>
  `);
  window._ss = STATE.students;
}

function studentRows(list) {
  if (!list.length)
    return '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:28px;">No students found</td></tr>';
  return list.map((s,i)=>`<tr>
    <td style="color:var(--muted);font-family:'JetBrains Mono',monospace;">${i+1}</td>
    <td style="font-weight:700;">${esc(s.name)}</td>
    <td style="color:var(--muted);">${esc(s.email)}</td>
    <td><span class="badge badge-blue">${esc(batchName(s.batchId))}</span></td>
    <td><span class="badge ${isActive(s)?'badge-green':'badge-red'}">${isActive(s)?'Active':'Inactive'}</span></td>
    <td class="td-actions">
      <button class="btn btn-ghost btn-sm" onclick="editStudent('${s.id}')">✏️ Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="toggleStudent('${s.id}')">${isActive(s)?'Deactivate':'Activate'}</button>
      <button class="btn-trash" title="Move to Recycle Bin" onclick="trashStudent('${s.id}')">🗑️</button>
    </td>
  </tr>`).join('');
}

function studentMobileCards(list) {
  if (!list.length)
    return '<div style="text-align:center;color:var(--muted);padding:28px;">No students found</div>';
  return list.map(s=>`
    <div class="student-card">
      <div class="sc-row">
        <div class="sc-name">${esc(s.name)}</div>
        <span class="badge ${isActive(s)?'badge-green':'badge-red'}">${isActive(s)?'Active':'Inactive'}</span>
      </div>
      <div class="sc-meta">
        📧 ${esc(s.email)}<br>
        🗂️ ${esc(batchName(s.batchId))}
      </div>
      <div class="sc-actions">
        <button class="btn btn-ghost btn-sm" onclick="editStudent('${s.id}')">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleStudent('${s.id}')">${isActive(s)?'Deactivate':'Activate'}</button>
        <button class="btn-trash" onclick="trashStudent('${s.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

function filterStudents(q) {
  const f = (window._ss||STATE.students).filter(s=>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.email.toLowerCase().includes(q.toLowerCase())
  );
  const tbody = document.getElementById('sTbody');
  const cards = document.getElementById('sCards');
  if (tbody) tbody.innerHTML = studentRows(f);
  if (cards) cards.innerHTML = studentMobileCards(f);
}

async function addStudent() {
  const name     = document.getElementById('sName').value.trim();
  const email    = document.getElementById('sEmail').value.trim().toLowerCase();
  const password = document.getElementById('sPassword').value.trim();
  const batchId  = document.getElementById('sBatch').value;
  if (!name||!email||!password||!batchId) { toast('Fill all fields', 'e'); return; }
  if (STATE.students.some(s=>s.email===email)) { toast('Email already registered', 'e'); return; }
  const newS = { id:uid(), name, email, batchId, active:'true', password };
  STATE.students.push(newS);
  window._ss = STATE.students;
  document.getElementById('sName').value = '';
  document.getElementById('sEmail').value = '';
  document.getElementById('sPassword').value = '';
  document.getElementById('sTbody').innerHTML = studentRows(STATE.students);
  document.getElementById('sCards').innerHTML = studentMobileCards(STATE.students);
  toast(`${name} added!`, 's');
  await writeToSheet('addStudent', newS);
}

async function toggleStudent(id) {
  const s = STATE.students.find(s=>s.id===id);
  if (!s) return;

  // Flip in memory
  const nowActive = !isActive(s);
  s.active = nowActive ? 'true' : 'false';

  // ── Save override to localStorage so it survives refresh ──
  // This is the KEY fix — sheet writes are async and unreliable (no-cors),
  // so we persist the admin's intent locally immediately
  STATE.activeOverrides[id] = s.active;
  try { localStorage.setItem('activeOverrides', JSON.stringify(STATE.activeOverrides)); } catch(e) {}

  window._ss = STATE.students;

  // ── Kill the student's session if they are currently logged in ──
  try {
    const session = localStorage.getItem('userSession');
    if (session) {
      const u = JSON.parse(session);
      if (u.role === 'student' && u.email && u.email.toLowerCase() === s.email.toLowerCase()) {
        if (!nowActive) {
          localStorage.removeItem('userSession');
        } else {
          u.batchId = s.batchId;
          localStorage.setItem('userSession', JSON.stringify(u));
        }
      }
    }
  } catch(e) {}

  // Refresh admin table
  const tbody = document.getElementById('sTbody');
  const cards = document.getElementById('sCards');
  if (tbody) tbody.innerHTML = studentRows(STATE.students);
  if (cards) cards.innerHTML = studentMobileCards(STATE.students);
  toast(`${s.name} ${nowActive ? 'activated ✅' : 'deactivated 🔒'}`);

  // Also send to sheet (best-effort, no-cors so may be slow)
  await writeToSheet('toggleStudent', { id, active: s.active });
}

async function trashStudent(id) {
  const s = STATE.students.find(s=>s.id===id);
  if (!confirm(`Move "${s.name}" to Recycle Bin?`)) return;
  STATE.trash.students.unshift({ ...s, deletedAt: new Date().toLocaleString() });
  STATE.students = STATE.students.filter(s=>s.id!==id);
  // Clear any stored override for this student
  delete STATE.activeOverrides[id];
  try { localStorage.setItem('activeOverrides', JSON.stringify(STATE.activeOverrides)); } catch(e) {}
  window._ss = STATE.students;
  const tbody = document.getElementById('sTbody');
  const cards = document.getElementById('sCards');
  if (tbody) tbody.innerHTML = studentRows(STATE.students);
  if (cards) cards.innerHTML = studentMobileCards(STATE.students);
  toast('Moved to Recycle Bin 🗑️');
  await writeToSheet('deleteStudent', { id });
}

function editStudent(id) {
  const s = STATE.students.find(s=>s.id===id);
  if (!s) return;
  const bOpts = STATE.batches.map(b=>`<option value="${b.id}" ${b.id===s.batchId?'selected':''}>${esc(b.name)}</option>`).join('');
  setMain(`
    <div class="page-header">
      <div class="page-title">Edit Student</div>
      <div class="page-sub">Update student details</div>
    </div>
    <div class="card" style="max-width:500px;">
      <div class="form-group"><label class="form-label">Full Name</label>
        <input class="form-input" id="editName" value="${esc(s.name)}"></div>
      <div class="form-group"><label class="form-label">Email</label>
        <input class="form-input" id="editEmail" type="email" value="${esc(s.email)}"></div>
      <div class="form-group"><label class="form-label">Student ID (read-only)</label>
        <input class="form-input" value="${esc(s.id)}" disabled style="background:#f1f5f9;"></div>
      <div class="form-group"><label class="form-label">Password</label>
        <input class="form-input" id="editPassword" type="password" placeholder="Leave blank to keep current"></div>
      <div class="form-group"><label class="form-label">Batch</label>
        <select class="form-select" id="editBatch">${bOpts}</select></div>
      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
        <button class="btn btn-success" onclick="saveStudentEdit('${s.id}')">Save Changes</button>
        <button class="btn btn-ghost" onclick="students()">Cancel</button>
      </div>
    </div>
  `);
}

async function saveStudentEdit(id) {
  const s        = STATE.students.find(s=>s.id===id);
  const name     = document.getElementById('editName').value.trim();
  const email    = document.getElementById('editEmail').value.trim().toLowerCase();
  const password = document.getElementById('editPassword').value;
  const batchId  = document.getElementById('editBatch').value;

  if (!name || !email || !batchId) { toast('Fill all fields', 'e'); return; }
  if (STATE.students.some(st=>st.email===email && st.id!==id)) {
    toast('Email already in use', 'e'); return;
  }

  s.name    = name;
  s.email   = email;
  s.batchId = batchId;
  if (password) s.password = password;

  // ── CRITICAL: if this student is currently logged in, update their live session ──
  // This makes batch change and name change take effect immediately
  try {
    const session = localStorage.getItem('userSession');
    if (session) {
      const u = JSON.parse(session);
      // Match by original email (before edit) OR new email
      if (u.role === 'student' && (
          u.email.toLowerCase() === email ||
          u.email.toLowerCase() === id   // fallback: unlikely but safe
      )) {
        u.name    = name;
        u.email   = email;
        u.batchId = batchId;
        localStorage.setItem('userSession', JSON.stringify(u));
        // Also update STATE.user if this admin is also the student (edge case)
        if (STATE.user && STATE.user.role === 'student') {
          STATE.user.name    = name;
          STATE.user.email   = email;
          STATE.user.batchId = batchId;
        }
      }
    }
  } catch(e) {}

  window._ss = STATE.students;
  toast(`${name} updated! ✅`, 's');
  await writeToSheet('updateStudent', s);
  students();
}

// ╔══════════════════════════════════════════════════════════╗
// ║               ADMIN: LECTURES                           ║
// ╚══════════════════════════════════════════════════════════╝
function lectures() {
  const bOpts = STATE.batches.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const fOpts = STATE.batches.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  setMain(`
    <div class="page-header">
      <div class="page-title">Lectures</div>
      <div class="page-sub">Add YouTube videos for each batch</div>
    </div>
    <div class="card">
      <div class="card-title">➕ Add Lecture</div>
      <div class="form-row">
        <div class="form-group" style="flex:2;"><label class="form-label">Title</label>
          <input class="form-input" id="lTitle" placeholder="e.g. Thermodynamics Part 1"></div>
        <div class="form-group"><label class="form-label">Subject</label>
          <input class="form-input" id="lSubject" placeholder="Physics"></div>
        <div class="form-group"><label class="form-label">YouTube Video ID</label>
          <input class="form-input" id="lYtId" placeholder="kKKM8Y-u7ds"></div>
        <div class="form-group"><label class="form-label">Batch</label>
          <select class="form-select" id="lBatch">${bOpts}</select></div>
        <div style="padding-top:22px;"><button class="btn btn-success" onclick="addLecture()">Add</button></div>
      </div>
      <div class="hint">💡 YouTube ID: from youtube.com/watch?v=<strong>THIS_PART</strong></div>
    </div>
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px;">
        <div class="card-title" style="margin:0;">▶️ All Lectures (${STATE.lectures.length})</div>
        <select class="form-select" style="width:180px;" onchange="filterLectures(this.value)">
          <option value="">All Batches</option>${fOpts}
        </select>
      </div>
      <div class="video-grid" id="lGrid">${lectureCards(STATE.lectures)}</div>
    </div>
  `);
}
function lectureCards(list) {
  if (!list.length)
    return `<div class="empty" style="grid-column:1/-1;"><div class="empty-ico">📹</div><div class="empty-t">No lectures yet</div></div>`;
  return list.map(l=>`
    <div class="vcard">
      <div class="vthumb" onclick="openVideo('${esc(l.ytId)}','${esc(l.title)}','${esc(l.subject)}','${esc(batchName(l.batchId))}','${esc(l.date)}')">
        <img src="${ytThumb(l.ytId)}" alt="${esc(l.title)}" loading="lazy"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 9%22><rect fill=%22%230f172a%22 width=%2216%22 height=%229%22/></svg>'">
        <div class="play-btn"><div class="play-tri"></div></div>
      </div>
      <div class="vinfo">
        <div class="vtitle">${esc(l.title)}</div>
        <div class="vmeta" style="margin-bottom:10px;">
          <span class="vsubject">${esc(l.subject)}</span>
          <span class="badge badge-gray">${esc(batchName(l.batchId))}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="editLecture('${l.id}')">✏️ Edit</button>
          <button class="btn-trash" title="Recycle Bin" onclick="trashLecture('${l.id}')">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}
function filterLectures(batchId) {
  const f = batchId ? STATE.lectures.filter(l=>l.batchId===batchId) : STATE.lectures;
  document.getElementById('lGrid').innerHTML = lectureCards(f);
}
async function addLecture() {
  const title   = document.getElementById('lTitle').value.trim();
  const subject = document.getElementById('lSubject').value.trim();
  const ytId    = document.getElementById('lYtId').value.trim().replace(/.*v=/,'').replace(/&.*/,'');
  const batchId = document.getElementById('lBatch').value;
  if (!title||!subject||!ytId||!batchId) { toast('Fill all fields', 'e'); return; }
  const newL = { id:uid(), title, subject, ytId, batchId, date: today() };
  STATE.lectures.unshift(newL);
  ['lTitle','lSubject','lYtId'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('lGrid').innerHTML = lectureCards(STATE.lectures);
  toast(`"${title}" added!`, 's');
  await writeToSheet('addLecture', newL);
}
function editLecture(id) {
  const l = STATE.lectures.find(l=>l.id===id);
  if (!l) return;
  const bOpts = STATE.batches.map(b=>`<option value="${b.id}" ${b.id===l.batchId?'selected':''}>${esc(b.name)}</option>`).join('');
  setMain(`
    <div class="page-header">
      <div class="page-title">Edit Lecture</div>
      <div class="page-sub">Update lecture details</div>
    </div>
    <div class="card" style="max-width:560px;">
      <div class="form-group"><label class="form-label">Title</label>
        <input class="form-input" id="leTitle" value="${esc(l.title)}"></div>
      <div class="form-group"><label class="form-label">Subject</label>
        <input class="form-input" id="leSubject" value="${esc(l.subject)}"></div>
      <div class="form-group"><label class="form-label">YouTube Video ID</label>
        <input class="form-input" id="leYtId" value="${esc(l.ytId)}" placeholder="kKKM8Y-u7ds"></div>
      <div class="form-group"><label class="form-label">Batch</label>
        <select class="form-select" id="leBatch">${bOpts}</select></div>
      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
        <button class="btn btn-success" onclick="saveLectureEdit('${l.id}')">Save Changes</button>
        <button class="btn btn-ghost" onclick="lectures()">Cancel</button>
      </div>
    </div>
  `);
}
async function saveLectureEdit(id) {
  const l       = STATE.lectures.find(l=>l.id===id);
  const title   = document.getElementById('leTitle').value.trim();
  const subject = document.getElementById('leSubject').value.trim();
  const ytId    = document.getElementById('leYtId').value.trim().replace(/.*v=/,'').replace(/&.*/,'');
  const batchId = document.getElementById('leBatch').value;
  if (!title||!subject||!ytId||!batchId) { toast('Fill all fields','e'); return; }
  l.title=title; l.subject=subject; l.ytId=ytId; l.batchId=batchId;
  toast('Lecture updated!','s');
  await writeToSheet('updateLecture', l);
  lectures();
}
async function trashLecture(id) {
  const l = STATE.lectures.find(l=>l.id===id);
  if (!confirm(`Move "${l.title}" to Recycle Bin?`)) return;
  STATE.trash.lectures.unshift({ ...l, deletedAt: new Date().toLocaleString() });
  STATE.lectures = STATE.lectures.filter(l=>l.id!==id);
  document.getElementById('lGrid').innerHTML = lectureCards(STATE.lectures);
  toast('Moved to Recycle Bin 🗑️');
  await writeToSheet('deleteLecture', { id });
}

// ╔══════════════════════════════════════════════════════════╗
// ║               ADMIN: RECYCLE BIN                        ║
// ╚══════════════════════════════════════════════════════════╝
let _binTab = 'students';
function recycleBin(tab) {
  if (tab) _binTab = tab;
  const tabs = [
    { key:'students', label:'👤 Students', count: STATE.trash.students.length },
    { key:'batches',  label:'🗂️ Batches',  count: STATE.trash.batches.length  },
    { key:'lectures', label:'▶️ Lectures', count: STATE.trash.lectures.length },
  ];
  const tabHtml = tabs.map(t=>`
    <button class="bin-tab ${_binTab===t.key?'active':''}" onclick="recycleBin('${t.key}')">
      ${t.label}${t.count?` <span style="background:rgba(255,255,255,0.3);border-radius:10px;padding:1px 7px;">${t.count}</span>`:''}
    </button>`).join('');

  let itemsHtml = '';
  if (_binTab === 'students') {
    itemsHtml = STATE.trash.students.length
      ? STATE.trash.students.map(s=>`
          <div class="bin-item">
            <div class="bin-item-info">
              <div class="bin-item-name">${esc(s.name)}</div>
              <div class="bin-item-meta">${esc(s.email)} · ${esc(batchName(s.batchId))} · ${esc(s.deletedAt)}</div>
            </div>
            <div class="bin-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="restoreStudent('${s.id}')">↩️ Restore</button>
              <button class="btn btn-danger btn-sm" onclick="permDeleteStudent('${s.id}')">Delete Forever</button>
            </div>
          </div>`).join('')
      : `<div class="bin-empty"><div class="bin-empty-ico">🗑️</div><div style="font-weight:700;color:#94a3b8;">No deleted students</div></div>`;
  } else if (_binTab === 'batches') {
    itemsHtml = STATE.trash.batches.length
      ? STATE.trash.batches.map(b=>`
          <div class="bin-item">
            <div class="bin-item-info">
              <div class="bin-item-name">${esc(b.name)}</div>
              <div class="bin-item-meta">Deleted ${esc(b.deletedAt)}</div>
            </div>
            <div class="bin-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="restoreBatch('${b.id}')">↩️ Restore</button>
              <button class="btn btn-danger btn-sm" onclick="permDeleteBatch('${b.id}')">Delete Forever</button>
            </div>
          </div>`).join('')
      : `<div class="bin-empty"><div class="bin-empty-ico">🗑️</div><div style="font-weight:700;color:#94a3b8;">No deleted batches</div></div>`;
  } else {
    itemsHtml = STATE.trash.lectures.length
      ? STATE.trash.lectures.map(l=>`
          <div class="bin-item">
            <div class="bin-item-info">
              <div class="bin-item-name">${esc(l.title)}</div>
              <div class="bin-item-meta">${esc(l.subject)} · ${esc(batchName(l.batchId))} · ${esc(l.deletedAt)}</div>
            </div>
            <div class="bin-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="restoreLecture('${l.id}')">↩️ Restore</button>
              <button class="btn btn-danger btn-sm" onclick="permDeleteLecture('${l.id}')">Delete Forever</button>
            </div>
          </div>`).join('')
      : `<div class="bin-empty"><div class="bin-empty-ico">🗑️</div><div style="font-weight:700;color:#94a3b8;">No deleted lectures</div></div>`;
  }

  const total = STATE.trash.students.length + STATE.trash.batches.length + STATE.trash.lectures.length;
  setMain(`
    <div class="page-header">
      <div class="page-title">🗑️ Recycle Bin</div>
      <div class="page-sub">Restore or permanently delete items · ${total} item${total!==1?'s':''}</div>
    </div>
    <div class="card">
      <div class="bin-tabs">${tabHtml}</div>
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">${itemsHtml}</div>
    </div>
  `);
}

function restoreStudent(id) {
  const s = STATE.trash.students.find(s=>s.id===id);
  STATE.students.push(s);
  STATE.trash.students = STATE.trash.students.filter(s=>s.id!==id);
  // Clear any stored override so sheet value takes precedence after restore
  delete STATE.activeOverrides[s.id];
  try { localStorage.setItem('activeOverrides', JSON.stringify(STATE.activeOverrides)); } catch(e) {}
  toast(`${s.name} restored ✅`,'s');
  writeToSheet('addStudent', s);
  recycleBin();
}
function restoreBatch(id) {
  const b = STATE.trash.batches.find(b=>b.id===id);
  STATE.batches.push(b);
  STATE.trash.batches = STATE.trash.batches.filter(b=>b.id!==id);
  toast(`${b.name} restored ✅`,'s');
  writeToSheet('addBatch', b);
  recycleBin();
}
function restoreLecture(id) {
  const l = STATE.trash.lectures.find(l=>l.id===id);
  STATE.lectures.push(l);
  STATE.trash.lectures = STATE.trash.lectures.filter(l=>l.id!==id);
  toast(`${l.title} restored ✅`,'s');
  writeToSheet('addLecture', l);
  recycleBin();
}
function permDeleteStudent(id) {
  if (!confirm('Permanently delete? Cannot be undone.')) return;
  STATE.trash.students = STATE.trash.students.filter(s=>s.id!==id);
  toast('Permanently deleted'); recycleBin();
}
function permDeleteBatch(id) {
  if (!confirm('Permanently delete? Cannot be undone.')) return;
  STATE.trash.batches = STATE.trash.batches.filter(b=>b.id!==id);
  toast('Permanently deleted'); recycleBin();
}
function permDeleteLecture(id) {
  if (!confirm('Permanently delete? Cannot be undone.')) return;
  STATE.trash.lectures = STATE.trash.lectures.filter(l=>l.id!==id);
  toast('Permanently deleted'); recycleBin();
}


// ╔══════════════════════════════════════════════════════════╗
// ║               ADMIN: EXPORT data.js                     ║
// ╚══════════════════════════════════════════════════════════╝
function exportData() {
  const output = `// ================================================================
//  data.js — Unacademy Gwalior Database
//  Generated: ${new Date().toLocaleString()}
//  Paste this entire file into data.js on GitHub and commit.
// ================================================================

const DB = {

  batches: ${JSON.stringify(STATE.batches, null, 4)},

  students: ${JSON.stringify(STATE.students, null, 4)},

  lectures: ${JSON.stringify(STATE.lectures, null, 4)},

};`;

  setMain(`
    <div class="page-header">
      <div class="page-title">💾 Export data.js</div>
      <div class="page-sub">Copy this and paste it into <strong>data.js</strong> on GitHub, then commit.</div>
    </div>
    <div class="card">
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="copyExport()">📋 Copy to Clipboard</button>
        <a class="btn btn-success" id="dlBtn" download="data.js">⬇️ Download data.js</a>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
        📌 Steps: Copy → Go to GitHub → Open data.js → Click ✏️ Edit → Select All → Paste → Commit
      </div>
      <textarea id="exportBox" style="width:100%;height:420px;font-family:'JetBrains Mono',monospace;font-size:12px;padding:14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:#0f172a;color:#e2e8f0;resize:vertical;line-height:1.6;"
        readonly></textarea>
    </div>
  `);

  const box = document.getElementById('exportBox');
  box.value = output;

  // Setup download link
  const blob = new Blob([output], { type: 'text/javascript' });
  document.getElementById('dlBtn').href = URL.createObjectURL(blob);
}

function copyExport() {
  const box = document.getElementById('exportBox');
  box.select();
  document.execCommand('copy');
  toast('Copied! Now paste into data.js on GitHub ✅', 's');
}

// ── Boot ──
window.addEventListener('load', checkStoredLogin);

// ── Password eye toggle ──
function toggleEye(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  // Swap icon: open eye vs eye-off
  btn.innerHTML = isHidden
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
