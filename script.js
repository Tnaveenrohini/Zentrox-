/* ═══════════════════════════════════════════════════════
   ZENTROX — Frontend JavaScript
   Handles: Downloads, ZPoints, Store, Study Hub, UI
═══════════════════════════════════════════════════════ */
'use strict';

const API_BASE = 'http://localhost:3000';

/* ─── ZPoints constants ─── */
const ZP_PER_DOWNLOAD    = 50;
const ZP_DAILY_BONUS     = 100;
const ZP_ARTICLE_READ    = 25;
const ZP_ZP_TO_INR       = 0.1; // 1 ZP ≈ ₹0.10
const STORAGE_KEY_POINTS  = 'zentrox_zpoints';
const STORAGE_KEY_HISTORY = 'zentrox_zp_history';
const STORAGE_KEY_DL_HIST = 'zentrox_dl_history';
const STORAGE_KEY_DAILY   = 'zentrox_daily_claimed';
const STORAGE_KEY_STREAK  = 'zentrox_streak';

/* ═══════════════════════════════════════════════════════
   ZPOINTS STORAGE
═══════════════════════════════════════════════════════ */
function getPoints() { return parseInt(localStorage.getItem(STORAGE_KEY_POINTS) || '0', 10); }
function setPoints(n) { localStorage.setItem(STORAGE_KEY_POINTS, Math.max(0, n)); }

function getHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]'); }
  catch { return []; }
}
function addHistory(label, pts) {
  const h = getHistory();
  h.unshift({ label, pts, time: Date.now() });
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(h.slice(0, 50)));
}

function addPoints(amount, label) {
  const newTotal = getPoints() + amount;
  setPoints(newTotal);
  addHistory(label, amount);
  refreshPointsUI();
  return newTotal;
}
function spendPoints(amount, label) {
  const current = getPoints();
  if (current < amount) return false;
  setPoints(current - amount);
  addHistory(label, -amount);
  refreshPointsUI();
  return true;
}

/* ─── Refresh all points UI ─── */
function refreshPointsUI() {
  const pts = getPoints();
  const fmt = pts.toLocaleString();

  // Nav pill
  document.getElementById('navPtVal').textContent = fmt;

  // Hero ring counter
  document.getElementById('heroZP').textContent = fmt;

  // Dashboard
  document.getElementById('ptsBal').textContent = fmt;
  document.getElementById('ptsEqVal').textContent = '₹' + (pts * ZP_ZP_TO_INR).toFixed(0);

  // History list
  renderPointsHistory();

  // Refresh store buttons (disable if not enough)
  renderStore(currentStoreFilter);
}

function renderPointsHistory() {
  const list = document.getElementById('ptsHistory');
  const h    = getHistory();
  if (!h.length) { list.innerHTML = '<div class="pts-empty">No activity yet. Download a reel to get started!</div>'; return; }
  list.innerHTML = h.slice(0, 10).map(e => `
    <div class="pts-entry">
      <span class="pts-entry-label">${escHtml(e.label)}</span>
      <span class="pts-entry-pts ${e.pts > 0 ? 'pos' : 'neg'}">${e.pts > 0 ? '+' : ''}${e.pts} ZP</span>
      <span class="pts-entry-time">${timeAgo(e.time)}</span>
    </div>
  `).join('');
}

/* ─── Daily bonus ─── */
document.getElementById('claimDailyBtn').addEventListener('click', () => {
  const today   = new Date().toDateString();
  const claimed = localStorage.getItem(STORAGE_KEY_DAILY);
  if (claimed === today) {
    showToast('🎁 Already claimed today! Come back tomorrow.'); return;
  }
  localStorage.setItem(STORAGE_KEY_DAILY, today);
  addPoints(ZP_DAILY_BONUS, '🎁 Daily bonus');
  showToast(`🎉 Daily bonus claimed! +${ZP_DAILY_BONUS} ZPoints!`);
});

/* ═══════════════════════════════════════════════════════
   DOWNLOADER
═══════════════════════════════════════════════════════ */
const urlInput    = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const pasteBtn    = document.getElementById('pasteBtn');
const copyBtn     = document.getElementById('copyBtn');
const clearBtn    = document.getElementById('clearBtn');
const progressWrap  = document.getElementById('progressWrap');
const progFill      = document.getElementById('progFill');
const progLabel     = document.getElementById('progLabel');
const resultArea    = document.getElementById('resultArea');
const errorArea     = document.getElementById('errorArea');
const errorMsg      = document.getElementById('errorMsg');
const thumbImg      = document.getElementById('thumbImg');
const dlLink        = document.getElementById('dlLink');
const dlLinkSD      = document.getElementById('dlLinkSD');
const qualityBadge  = document.getElementById('qualityBadge');
const resultTitle   = document.getElementById('resultTitle');
const resultAuthor  = document.getElementById('resultAuthor');
const pointsEarned  = document.getElementById('pointsEarned');
const ptsTotalInline = document.getElementById('ptsTotalInline');

function isValidIG(url) {
  try {
    const u = new URL(url.trim());
    const h = u.hostname.replace('www.', '');
    return h === 'instagram.com' && /^\/(reel|p|tv)\//i.test(u.pathname);
  } catch { return false; }
}

let progressInterval = null;
function startProgress(label) {
  progressWrap.style.display = 'block'; progFill.style.width = '0%'; progLabel.textContent = label;
  clearInterval(progressInterval); let pct = 0;
  progressInterval = setInterval(() => { pct += (84 - pct) * 0.07; progFill.style.width = Math.min(pct, 83).toFixed(1) + '%'; }, 150);
}
function finishProgress() {
  clearInterval(progressInterval); progFill.style.width = '100%';
  setTimeout(() => { progressWrap.style.display = 'none'; progFill.style.width = '0%'; }, 400);
}

function showResult(data) {
  resultArea.style.display = 'block'; errorArea.style.display = 'none';
  if (data.thumbnail) { thumbImg.src = data.thumbnail; thumbImg.onerror = () => { thumbImg.style.display = 'none'; }; }
  qualityBadge.textContent = data.quality || 'HD';
  resultTitle.textContent  = data.title || 'Instagram Video';
  resultAuthor.textContent = data.author ? `@${data.author}` : '';
  dlLink.href = `/proxy-download?url=${encodeURIComponent(data.download)}&filename=zentrox_${Date.now()}.mp4`;
  if (data.downloadSD) { dlLinkSD.href = `/proxy-download?url=${encodeURIComponent(data.downloadSD)}&filename=zentrox_sd_${Date.now()}.mp4`; dlLinkSD.style.display = 'inline-flex'; }
  else dlLinkSD.style.display = 'none';
}
function showError(msg) { errorArea.style.display = 'flex'; resultArea.style.display = 'none'; errorMsg.textContent = msg; pointsEarned.style.display = 'none'; }
function clearResult() { resultArea.style.display = 'none'; errorArea.style.display = 'none'; pointsEarned.style.display = 'none'; }

async function fetchDownload() {
  const url = urlInput.value.trim();
  if (!url) { showToast('⚠️ Please paste an Instagram URL first'); urlInput.focus(); return; }
  if (!isValidIG(url)) { showError('Invalid URL. Use a public Instagram reel/post/tv link, e.g. https://www.instagram.com/reel/ABC123/'); return; }
  clearResult(); downloadBtn.disabled = true; startProgress('Fetching video info...');
  try {
    const res  = await fetch(`${API_BASE}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const data = await res.json();
    finishProgress();
    if (!res.ok || !data.status) {
      showError(data.message || 'Could not extract video. Make sure the post is public.');
      showToast('❌ ' + (data.message || 'Extraction failed'));
    } else {
      showResult(data);
      // Award ZPoints
      const newTotal = addPoints(ZP_PER_DOWNLOAD, '📥 Reel downloaded');
      pointsEarned.style.display = 'block';
      ptsTotalInline.textContent = `Total: ${newTotal.toLocaleString()} ZP`;
      showToast(`✅ Done! +${ZP_PER_DOWNLOAD} ZPoints earned 🎉`);
      saveDLHistory(url, data);
      // Animate hero ring
      animateHeroRing();
    }
  } catch (err) {
    finishProgress();
    const msg = err.message.includes('fetch') || err.message.includes('Failed')
      ? 'Cannot connect to server. Run: node server.js'
      : 'Unexpected error. Please try again.';
    showError(msg); showToast('❌ Connection failed');
  } finally { downloadBtn.disabled = false; }
}

function animateHeroRing() {
  const ring = document.querySelector('.zp-ring circle:nth-child(2)');
  if (!ring) return;
  ring.style.transition = 'stroke-dashoffset 0.8s ease';
  const pts = getPoints(), max = 5000;
  const pct = Math.min(pts / max, 1);
  const circ = 2 * Math.PI * 34;
  ring.setAttribute('stroke-dashoffset', circ * (1 - pct));
}

/* ─── Clipboard ─── */
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text?.startsWith('http')) { urlInput.value = text; clearBtn.style.display = ''; clearResult(); showToast('📋 Pasted!'); if (isValidIG(text)) fetchDownload(); }
    else showToast('⚠️ Clipboard doesn\'t contain a URL');
  } catch { showToast('⚠️ Clipboard access denied — paste manually'); urlInput.focus(); }
});

urlInput.addEventListener('focus', async () => {
  if (urlInput.value) return;
  try { const t = await navigator.clipboard.readText(); if (t && isValidIG(t)) { urlInput.value = t; clearBtn.style.display = ''; showToast('📋 Instagram link detected!'); } } catch {}
});

copyBtn.addEventListener('click', () => {
  if (!urlInput.value.trim()) { showToast('⚠️ Nothing to copy'); return; }
  navigator.clipboard.writeText(urlInput.value.trim()).then(() => showToast('🔗 Link copied!')).catch(() => showToast('⚠️ Copy failed'));
});

clearBtn.addEventListener('click', () => { urlInput.value = ''; clearBtn.style.display = 'none'; clearResult(); urlInput.focus(); });
urlInput.addEventListener('input', () => { clearBtn.style.display = urlInput.value ? '' : 'none'; if (!urlInput.value) clearResult(); });
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchDownload(); });
downloadBtn.addEventListener('click', fetchDownload);

/* ─── DL History (localStorage) ─── */
function saveDLHistory(url, data) {
  try {
    const h = JSON.parse(localStorage.getItem(STORAGE_KEY_DL_HIST) || '[]');
    const idx = h.findIndex(x => x.url === url); if (idx > -1) h.splice(idx, 1);
    h.unshift({ url, title: data.title || 'Instagram Video', quality: data.quality || 'HD', date: Date.now() });
    localStorage.setItem(STORAGE_KEY_DL_HIST, JSON.stringify(h.slice(0, 30)));
  } catch {}
}

/* ═══════════════════════════════════════════════════════
   STORE DATA
═══════════════════════════════════════════════════════ */
const STORE_ITEMS = [
  { id:'s1',  cat:'stationery', emoji:'✏️',  name:'Premium Pencil Set',          desc:'Set of 12 HB graphite pencils, perfect for notes and sketches.',             pts:200  },
  { id:'s2',  cat:'stationery', emoji:'🖊️',  name:'Gel Pen Pack (10 pcs)',        desc:'Smooth-writing blue/black/red gel pens for everyday use.',                   pts:300  },
  { id:'s3',  cat:'stationery', emoji:'📓',  name:'A5 Ruled Notebook',           desc:'80-page spiral notebook with thick lined pages.',                             pts:400  },
  { id:'s4',  cat:'stationery', emoji:'🗂️',  name:'Index Card Bundle',           desc:'200 ruled index cards for flashcard study techniques.',                       pts:250  },
  { id:'s5',  cat:'stationery', emoji:'📐',  name:'Geometry Box',                desc:'Complete geometry set: compass, protractor, set squares, ruler.',             pts:500  },
  { id:'s6',  cat:'stationery', emoji:'🖍️',  name:'Highlighter Set (6 colours)', desc:'Chisel-tip highlighters for colour-coded note taking.',                       pts:350  },
  { id:'s7',  cat:'books',      emoji:'📖',  name:'NCERT Science Class 10',      desc:'Full NCERT Science textbook for Class 10 board preparation.',                 pts:800  },
  { id:'s8',  cat:'books',      emoji:'📗',  name:'Mathematics Practice Book',   desc:'500+ solved problems covering Algebra, Geometry & Calculus.',                 pts:900  },
  { id:'s9',  cat:'books',      emoji:'📙',  name:'English Grammar Guide',       desc:'Comprehensive grammar and essay writing reference.',                          pts:600  },
  { id:'s10', cat:'books',      emoji:'📘',  name:'GK & Current Affairs 2025',   desc:'Updated general knowledge almanac for competitive exams.',                    pts:700  },
  { id:'s11', cat:'books',      emoji:'📚',  name:'Study Kit Bundle',            desc:'Notebook + pen set + highlighters — complete study combo.',                   pts:1200 },
  { id:'s12', cat:'digital',    emoji:'💻',  name:'1-Month Coursera Access',     desc:'Full access to thousands of online courses for 30 days.',                    pts:2000 },
  { id:'s13', cat:'digital',    emoji:'📱',  name:'Khan Academy Pro (30 days)',  desc:'Ad-free access and progress tracking on Khan Academy.',                       pts:1500 },
  { id:'s14', cat:'digital',    emoji:'🎧',  name:'Audible Audiobook Credit',    desc:'One free audiobook credit on Audible — any title you choose.',               pts:1800 },
  { id:'s15', cat:'digital',    emoji:'☁️',  name:'Google Drive 100GB (1 month)',desc:'Extra cloud storage for assignments, notes and projects.',                   pts:1000 },
  { id:'s16', cat:'science',    emoji:'🔬',  name:'Mini Science Lab Kit',        desc:'Safe home experiment kit: chemicals, test tubes, safety goggles.',           pts:1500 },
  { id:'s17', cat:'science',    emoji:'🧲',  name:'Magnet & Circuits Kit',       desc:'Build simple circuits and explore magnetism hands-on.',                       pts:1200 },
  { id:'s18', cat:'science',    emoji:'🌍',  name:'Globe (Political, 8 inch)',   desc:'Desk globe with country labels, capitals and ocean markers.',                 pts:1600 },
  { id:'s19', cat:'science',    emoji:'📡',  name:'Astronomy Poster Set',        desc:'Set of 4 A2 solar system + constellation posters for your wall.',            pts:450  },
  { id:'s20', cat:'stationery', emoji:'📏',  name:'Whiteboard Marker Set',       desc:'8-colour dry-erase markers for mini whiteboards and glass.',                 pts:280  },
];

let currentStoreFilter = 'all';
let claimTarget = null;

function renderStore(filter = 'all') {
  currentStoreFilter = filter;
  const grid   = document.getElementById('storeGrid');
  const pts    = getPoints();
  const items  = filter === 'all' ? STORE_ITEMS : STORE_ITEMS.filter(i => i.cat === filter);
  grid.innerHTML = items.map(item => `
    <div class="store-item ${pts < item.pts ? '' : ''}" data-id="${item.id}">
      <div class="store-item-img">${item.emoji}</div>
      <div class="store-item-body">
        <div class="store-item-cat">${item.cat}</div>
        <div class="store-item-name">${escHtml(item.name)}</div>
        <div class="store-item-desc">${escHtml(item.desc)}</div>
        <div class="store-item-footer">
          <div class="store-item-pts">${item.pts.toLocaleString()} <small>ZP</small></div>
          <button class="btn-claim" onclick="openClaimModal('${item.id}')" ${pts < item.pts ? 'disabled title="Not enough ZPoints"' : ''}>
            ${pts < item.pts ? `Need ${(item.pts - pts).toLocaleString()} more` : 'Claim'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

/* Filter buttons */
document.querySelectorAll('.sf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderStore(btn.dataset.cat);
  });
});

/* ─── Claim Modal ─── */
function openClaimModal(itemId) {
  const item = STORE_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  if (getPoints() < item.pts) { showToast('❌ Not enough ZPoints!'); return; }
  claimTarget = item;
  const det = document.getElementById('claimItemDetails');
  det.innerHTML = `<div class="cid-emoji">${item.emoji}</div><div class="cid-info"><strong>${escHtml(item.name)}</strong><span>−${item.pts.toLocaleString()} ZPoints</span></div>`;
  document.getElementById('claimName').value = '';
  document.getElementById('claimContact').value = '';
  document.getElementById('claimAddress').value = '';
  document.getElementById('claimModalError').style.display = 'none';
  document.getElementById('claimModal').style.display = 'flex';
}
window.openClaimModal = openClaimModal;

document.getElementById('closeClaimModal').addEventListener('click', () => { document.getElementById('claimModal').style.display = 'none'; claimTarget = null; });
document.getElementById('claimModal').addEventListener('click', e => { if (e.target === document.getElementById('claimModal')) { document.getElementById('claimModal').style.display = 'none'; claimTarget = null; } });

document.getElementById('confirmClaimBtn').addEventListener('click', () => {
  if (!claimTarget) return;
  const name    = document.getElementById('claimName').value.trim();
  const contact = document.getElementById('claimContact').value.trim();
  const address = document.getElementById('claimAddress').value.trim();
  const errEl   = document.getElementById('claimModalError');

  if (!name || !contact || !address) {
    errEl.textContent = 'Please fill in all fields before confirming.'; errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';

  const success = spendPoints(claimTarget.pts, `🛍️ Redeemed: ${claimTarget.name}`);
  if (!success) { errEl.textContent = 'Insufficient ZPoints.'; errEl.style.display = 'block'; return; }

  document.getElementById('claimModal').style.display = 'none';
  showToast(`🎉 Claimed ${claimTarget.name}! We'll contact you at ${contact}.`);
  renderStore(currentStoreFilter);
  claimTarget = null;
});

/* ═══════════════════════════════════════════════════════
   STUDY HUB DATA
═══════════════════════════════════════════════════════ */
const ARTICLES = [
  { emoji:'🧮', subject:'Mathematics', title:'How to Solve Quadratic Equations', excerpt:'Master three methods: factoring, completing the square, and the quadratic formula — with worked examples.', pts:25, time:'5 min read', link:'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations' },
  { emoji:'⚛️', subject:'Physics',     title:'Newton\'s Laws of Motion Explained', excerpt:'A clear visual breakdown of all three laws with real-world applications and exam tips.', pts:25, time:'6 min read', link:'https://www.khanacademy.org/science/physics/forces-newtons-laws' },
  { emoji:'🧬', subject:'Biology',     title:'Cell Division: Mitosis vs Meiosis', excerpt:'Understand the stages, differences, and importance of each type of cell division with diagrams.', pts:25, time:'7 min read', link:'https://www.khanacademy.org/science/ap-biology/cell-communication-and-cell-cycle' },
  { emoji:'🌍', subject:'Geography',   title:'Plate Tectonics & Natural Disasters', excerpt:'How moving tectonic plates cause earthquakes, volcanoes, and tsunamis — and where risk zones are.', pts:25, time:'5 min read', link:'https://www.nationalgeographic.org/encyclopedia/plate-tectonics/' },
  { emoji:'✍️', subject:'English',     title:'Essay Writing: Structure & Style', excerpt:'Step-by-step guide to writing a high-scoring essay: thesis, body paragraphs, and conclusion.', pts:25, time:'8 min read', link:'https://owl.purdue.edu/owl/general_writing/academic_writing/essay_writing/' },
  { emoji:'⚗️', subject:'Chemistry',   title:'Periodic Table: Groups & Trends', excerpt:'Navigate the periodic table with confidence — groups, periods, reactivity trends and valence electrons.', pts:25, time:'6 min read', link:'https://www.khanacademy.org/science/chemistry/electronic-structure-of-atoms' },
  { emoji:'🏛️', subject:'History',     title:'World War II: Causes & Consequences', excerpt:'A concise timeline of WWII — from the Treaty of Versailles to the Cold War aftermath.', pts:25, time:'9 min read', link:'https://www.history.com/topics/world-war-ii/world-war-ii-history' },
  { emoji:'💻', subject:'Computer Sc.', title:'Introduction to Algorithms & Big O', excerpt:'Understand time complexity, Big O notation and why efficient code matters in programming.', pts:25, time:'7 min read', link:'https://www.khanacademy.org/computing/computer-science/algorithms' },
  { emoji:'📊', subject:'Statistics',  title:'Mean, Median, Mode & Standard Deviation', excerpt:'The foundational statistics every student needs — explained with examples and when to use each.', pts:25, time:'5 min read', link:'https://www.khanacademy.org/math/statistics-probability' },
];

const TOOLS = [
  { icon:'🧮', name:'Desmos Graphing Calculator', desc:'Plot functions, conic sections, and data. The best free graphing tool for mathematics students.', link:'https://www.desmos.com/calculator', label:'Open Calculator' },
  { icon:'📝', name:'Quizlet — Flashcard Study', desc:'Create digital flashcards, study sets and play learning games to memorise anything faster.', link:'https://quizlet.com/', label:'Open Quizlet' },
  { icon:'📅', name:'Google Classroom', desc:'Access your class assignments, submit work, and collaborate with teachers and classmates.', link:'https://classroom.google.com/', label:'Open Classroom' },
  { icon:'📖', name:'Khan Academy', desc:'Free world-class education — videos and practice exercises for every subject, every level.', link:'https://www.khanacademy.org/', label:'Start Learning' },
  { icon:'🌐', name:'Wikipedia — Reference', desc:'Reliable encyclopedia for research and fact-checking. Start any topic exploration here.', link:'https://www.wikipedia.org/', label:'Open Wikipedia' },
  { icon:'🔬', name:'PhET Simulations', desc:'Interactive science and maths simulations from University of Colorado — physics, chemistry, biology and more.', link:'https://phet.colorado.edu/', label:'Run Simulations' },
  { icon:'🎨', name:'Canva — Study Posters', desc:'Design beautiful study notes, mind maps, and posters with Canva\'s free student templates.', link:'https://www.canva.com/', label:'Open Canva' },
  { icon:'⏱️', name:'Pomofocus — Pomodoro Timer', desc:'Focus-time timer using the Pomodoro technique: 25 min work + 5 min break cycles.', link:'https://pomofocus.io/', label:'Start Timer' },
  { icon:'🧠', name:'Wolfram Alpha', desc:'Computational intelligence for maths problems, science queries, and data analysis.', link:'https://www.wolframalpha.com/', label:'Open Wolfram' },
];

const SUBJECTS = [
  { icon:'📐', name:'Mathematics',  count:'12 resources', topics:['Algebra','Geometry','Calculus','Statistics'] },
  { icon:'⚗️', name:'Chemistry',    count:'9 resources',  topics:['Organic','Inorganic','Physical','Periodic Table'] },
  { icon:'⚛️', name:'Physics',      count:'11 resources', topics:['Mechanics','Waves','Electricity','Optics'] },
  { icon:'🧬', name:'Biology',      count:'10 resources', topics:['Cell Biology','Genetics','Ecology','Evolution'] },
  { icon:'🌍', name:'Geography',    count:'7 resources',  topics:['Physical Geo','Human Geo','Maps','Climate'] },
  { icon:'🏛️', name:'History',      count:'8 resources',  topics:['Ancient','Medieval','Modern','WW1 & WW2'] },
  { icon:'✍️', name:'English',      count:'9 resources',  topics:['Grammar','Essay','Literature','Poetry'] },
  { icon:'💻', name:'Computer Sc.', count:'6 resources',  topics:['Python','Algorithms','HTML/CSS','Databases'] },
];

function buildStudyHub() {
  // Articles
  document.getElementById('articlesGrid').innerHTML = ARTICLES.map(a => `
    <div class="article-card" onclick="readArticle(this, '${escAttr(a.link)}')">
      <div class="art-emoji">${a.emoji}</div>
      <div class="art-subject">${a.subject}</div>
      <div class="art-title">${escHtml(a.title)}</div>
      <div class="art-excerpt">${escHtml(a.excerpt)}</div>
      <div class="art-footer">
        <span class="art-pts">+${a.pts} ZP on read</span>
        <span class="art-time">${a.time}</span>
      </div>
    </div>
  `).join('');

  // Tools
  document.getElementById('toolsGrid').innerHTML = TOOLS.map(t => `
    <div class="tool-card">
      <div class="tool-icon">${t.icon}</div>
      <div class="tool-name">${escHtml(t.name)}</div>
      <div class="tool-desc">${escHtml(t.desc)}</div>
      <a href="${escAttr(t.link)}" target="_blank" rel="noopener" class="tool-link">${escHtml(t.label)} →</a>
    </div>
  `).join('');

  // Subjects
  document.getElementById('subjectsGrid').innerHTML = SUBJECTS.map(s => `
    <div class="subject-card">
      <div class="subj-icon">${s.icon}</div>
      <div class="subj-name">${escHtml(s.name)}</div>
      <div class="subj-count">${s.count}</div>
      <div class="subj-topics">${s.topics.map(t => `<span class="subj-tag">${escHtml(t)}</span>`).join('')}</div>
    </div>
  `).join('');
}

/* Track article reads to earn ZP */
const readArticles = new Set(JSON.parse(localStorage.getItem('zentrox_read_arts') || '[]'));

window.readArticle = function(el, link) {
  // Give points once per article per session
  const key = link;
  if (!readArticles.has(key)) {
    readArticles.add(key);
    localStorage.setItem('zentrox_read_arts', JSON.stringify([...readArticles]));
    addPoints(ZP_ARTICLE_READ, '📰 Article read');
    showToast(`📰 +${ZP_ARTICLE_READ} ZPoints for reading! Opening article...`);
  } else {
    showToast('Opening article...');
  }
  setTimeout(() => window.open(link, '_blank', 'noopener'), 400);
};

/* Study tab switching */
document.querySelectorAll('.stab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.study-panel').forEach(p => p.classList.add('hidden'));
    const tab = btn.dataset.tab;
    const panelMap = { articles: 'studyArticles', tools: 'studyTools', subjects: 'studySubjects' };
    document.getElementById(panelMap[tab]).classList.remove('hidden');
  });
});

/* ═══════════════════════════════════════════════════════
   FAQ DATA
═══════════════════════════════════════════════════════ */
const FAQS = [
  { q:'What is Zentrox?', a:'Zentrox is a free platform for students that lets you download Instagram reels and videos in HD, while earning ZPoints rewards redeemable for real study supplies like pens, books, and more.' },
  { q:'How do I earn ZPoints?', a:'You earn ZPoints by: downloading reels (+50 ZP each), daily login bonuses (+100 ZP), reading study articles (+25 ZP), and completing quizzes (+75 ZP). There\'s no limit to how many you can earn!' },
  { q:'What can I redeem ZPoints for?', a:'You can redeem ZPoints in the Zentrox Store for stationery (pens, pencils, notebooks), books (NCERT, practice books), digital subscriptions (Coursera, Khan Academy Pro), and science kits.' },
  { q:'How does the download work?', a:'Paste any public Instagram reel, post, or IGTV URL into the downloader. The backend fetches the HD video via RapidAPI and returns a direct download link. No watermarks, no account needed.' },
  { q:'Is Zentrox completely free?', a:'Yes! Zentrox is 100% free. No subscriptions, no hidden fees, no account required for downloads. ZPoints and the store system are also free to use.' },
  { q:'Can I download from private Instagram accounts?', a:'No. Zentrox can only access publicly visible posts. Private accounts require the creator\'s permission. Always respect content creators\' rights.' },
  { q:'How do I claim a reward from the store?', a:'Click "Claim" on any item in the Store, fill in your name, contact, and delivery address, and confirm. We\'ll reach out to you via the contact details provided to arrange delivery.' },
  { q:'Do my ZPoints expire?', a:'Currently ZPoints do not expire and are stored in your browser\'s local storage. They persist across sessions as long as you use the same browser and don\'t clear site data.' },
  { q:'Is Zentrox affiliated with Instagram or Meta?', a:'No. Zentrox is an independent student platform. We use the Instagram downloader API to extract publicly available video content for personal use only.' },
];

function buildFAQ() {
  document.getElementById('faqList').innerHTML = FAQS.map((f, i) => `
    <div class="faq-item" id="faqItem${i}">
      <button class="faq-q" onclick="toggleFAQ(${i})">
        ${escHtml(f.q)}
        <svg class="faq-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a"><div class="faq-a-inner">${escHtml(f.a)}</div></div>
    </div>
  `).join('');
}

window.toggleFAQ = function(i) {
  const item = document.getElementById(`faqItem${i}`);
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(e => e.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
};

/* ═══════════════════════════════════════════════════════
   NAVBAR & SCROLL
═══════════════════════════════════════════════════════ */
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobMenu').classList.toggle('open');
});
document.querySelectorAll('.mob-menu a').forEach(a => a.addEventListener('click', () => document.getElementById('mobMenu').classList.remove('open')));

const scrollTopBtn = document.getElementById('scrollTop');
window.addEventListener('scroll', () => {
  scrollTopBtn.classList.toggle('show', window.scrollY > 500);
  // Highlight active nav link
  const secs = ['downloader','earn','store','study','faq'];
  const y = window.scrollY + 80;
  secs.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const link = document.querySelector(`.nl[href="#${id}"]`); if (!link) return;
    link.classList.toggle('active', el.offsetTop <= y && el.offsetTop + el.offsetHeight > y);
  });
}, { passive: true });

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }); }
  });
});

/* ═══════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════ */
let toastTimer;
const toastEl = document.getElementById('toast');
function showToast(msg, dur = 3200) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

/* ═══════════════════════════════════════════════════════
   HERO COUNTER ANIMATION
═══════════════════════════════════════════════════════ */
let dlCount  = 14821;
let ptsCount = 386000;
setInterval(() => {
  dlCount  += Math.floor(Math.random() * 4 + 1);
  ptsCount += Math.floor(Math.random() * 50 + 25);
  const dlEl = document.getElementById('hcDl');
  const ptEl = document.getElementById('hcPts');
  if (dlEl) dlEl.textContent = dlCount.toLocaleString();
  if (ptEl) ptEl.textContent = (ptsCount / 1000).toFixed(1) + 'K';
}, 5000);

/* ═══════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════ */
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function timeAgo(ts) {
  const d = Date.now() - ts, m = Math.floor(d/60000), hr = Math.floor(d/3600000), day = Math.floor(d/86400000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; if (hr < 24) return `${hr}h ago`; return `${day}d ago`;
}

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
(function init() {
  refreshPointsUI();
  renderStore('all');
  buildStudyHub();
  buildFAQ();
  animateHeroRing();
})();
