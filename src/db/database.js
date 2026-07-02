import { createRequire } from 'module';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Force sql.js to load as CJS to avoid Electron's ESM→CJS interop bug
const _require = createRequire(import.meta.url);
const initSqlJs = _require('sql.js');

// Use writable user-data dir in Electron, project root in CLI mode
const __dirname = dirname(fileURLToPath(import.meta.url));
function getDbDir() {
  if (process.env.ELECTRON_USER_DATA) return process.env.ELECTRON_USER_DATA;
  return join(__dirname, '..', '..', 'data');
}
const DB_DIR = getDbDir();
const DB_PATH = join(DB_DIR, 'luxroom.db');

let db;

function saveDb() {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

async function getDb() {
  if (db) return db;
  mkdirSync(DB_DIR, { recursive: true });
  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    db = new SQL.Database(readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  return db;
}

function run(sql, params = {}) {
  db.run(sql, params);
  saveDb();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export async function initDb() {
  await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      source TEXT,
      timestamp TEXT,
      listingTitle TEXT,
      location TEXT,
      insideLuxembourg INTEGER,
      rentTotal TEXT,
      availability TEXT,
      domiciliationFlag TEXT,
      furnished TEXT,
      smokingAllowed TEXT,
      genderPolicy TEXT,
      contactName TEXT,
      contactMethod TEXT,
      rawDescription TEXT,
      verdict TEXT,
      score REAL,
      estimatedCommute TEXT,
      corridor TEXT,
      pros TEXT DEFAULT '[]',
      cons TEXT DEFAULT '[]',
      dealbreakers TEXT DEFAULT '[]',
      topReason TEXT,
      housingScore REAL,
      opportunityScore REAL,
      competitionScore REAL,
      urgency TEXT,
      messageDrafts TEXT DEFAULT '[]',
      sentEvents TEXT DEFAULT '[]',
      htmlHash TEXT
    );

    CREATE TABLE IF NOT EXISTS listings_raw (
      url TEXT PRIMARY KEY,
      html TEXT,
      screenshot TEXT,
      timestamp TEXT,
      source TEXT,
      htmlHash TEXT
    );
  `);
  saveDb();
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function deserializeListing(row) {
  if (!row) return null;
  return {
    ...row,
    insideLuxembourg: row.insideLuxembourg != null ? Boolean(row.insideLuxembourg) : null,
    pros: parseJson(row.pros, []),
    cons: parseJson(row.cons, []),
    dealbreakers: parseJson(row.dealbreakers, []),
    messageDrafts: parseJson(row.messageDrafts, []),
    sentEvents: parseJson(row.sentEvents, []),
  };
}

export async function upsertRaw(record) {
  await getDb();
  const existing = get('SELECT htmlHash FROM listings_raw WHERE url = ?', [record.url]);
  if (existing && existing.htmlHash === record.htmlHash) return { inserted: false };
  db.run(
    `INSERT INTO listings_raw (url, html, screenshot, timestamp, source, htmlHash)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       html=excluded.html, screenshot=excluded.screenshot,
       timestamp=excluded.timestamp, source=excluded.source, htmlHash=excluded.htmlHash`,
    [record.url, record.html, record.screenshot ?? null, record.timestamp, record.source, record.htmlHash]
  );
  saveDb();
  return { inserted: true };
}

export async function upsertListing(record) {
  await getDb();
  const id = record.id ?? Date.now();
  db.run(
    `INSERT INTO listings (
      id, url, source, timestamp, listingTitle, location, insideLuxembourg,
      rentTotal, availability, domiciliationFlag, furnished, smokingAllowed,
      genderPolicy, contactName, contactMethod, rawDescription, verdict, score,
      estimatedCommute, corridor, pros, cons, dealbreakers, topReason,
      housingScore, opportunityScore, competitionScore, urgency,
      messageDrafts, sentEvents, htmlHash
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(url) DO UPDATE SET
      source=excluded.source, timestamp=excluded.timestamp,
      listingTitle=excluded.listingTitle, location=excluded.location,
      insideLuxembourg=excluded.insideLuxembourg, rentTotal=excluded.rentTotal,
      availability=excluded.availability, domiciliationFlag=excluded.domiciliationFlag,
      furnished=excluded.furnished, smokingAllowed=excluded.smokingAllowed,
      genderPolicy=excluded.genderPolicy, contactName=excluded.contactName,
      contactMethod=excluded.contactMethod, rawDescription=excluded.rawDescription,
      verdict=excluded.verdict, score=excluded.score,
      estimatedCommute=excluded.estimatedCommute, corridor=excluded.corridor,
      pros=excluded.pros, cons=excluded.cons, dealbreakers=excluded.dealbreakers,
      topReason=excluded.topReason, housingScore=excluded.housingScore,
      opportunityScore=excluded.opportunityScore, competitionScore=excluded.competitionScore,
      urgency=excluded.urgency,
      messageDrafts=COALESCE(excluded.messageDrafts, listings.messageDrafts),
      sentEvents=COALESCE(excluded.sentEvents, listings.sentEvents),
      htmlHash=excluded.htmlHash`,
    [
      id, record.url, record.source ?? null, record.timestamp ?? null,
      record.listingTitle ?? null, record.location ?? null,
      record.insideLuxembourg != null ? (record.insideLuxembourg ? 1 : 0) : null,
      record.rentTotal ?? null, record.availability ?? null,
      record.domiciliationFlag ?? null, record.furnished ?? null,
      record.smokingAllowed ?? null, record.genderPolicy ?? null,
      record.contactName ?? null, record.contactMethod ?? null,
      record.rawDescription ?? null, record.verdict ?? null, record.score ?? null,
      record.estimatedCommute ?? null, record.corridor ?? null,
      JSON.stringify(record.pros ?? []), JSON.stringify(record.cons ?? []),
      JSON.stringify(record.dealbreakers ?? []), record.topReason ?? null,
      record.housingScore ?? null, record.opportunityScore ?? null,
      record.competitionScore ?? null, record.urgency ?? null,
      JSON.stringify(record.messageDrafts ?? []),
      JSON.stringify(record.sentEvents ?? []), record.htmlHash ?? null,
    ]
  );
  saveDb();
}

export async function getListing(url) {
  await getDb();
  return deserializeListing(get('SELECT * FROM listings WHERE url = ?', [url]));
}

export async function getAllListings() {
  await getDb();
  return all('SELECT * FROM listings ORDER BY opportunityScore DESC').map(deserializeListing);
}

export async function updateListing(url, fields) {
  await getDb();
  const jsonFields = new Set(['pros', 'cons', 'dealbreakers', 'messageDrafts', 'sentEvents']);
  const setClauses = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'url' || key === 'id') continue;
    setClauses.push(`${key} = ?`);
    values.push(jsonFields.has(key) ? JSON.stringify(value) : value);
  }
  if (setClauses.length === 0) return;
  values.push(url);
  db.run(`UPDATE listings SET ${setClauses.join(', ')} WHERE url = ?`, values);
  saveDb();
}

export async function logSendEvent(listingUrl, event) {
  await getDb();
  const row = get('SELECT sentEvents FROM listings WHERE url = ?', [listingUrl]);
  if (!row) throw new Error(`Listing not found: ${listingUrl}`);
  const events = parseJson(row.sentEvents, []);
  events.push({ ...event, timestamp: event.timestamp ?? new Date().toISOString() });
  db.run('UPDATE listings SET sentEvents = ? WHERE url = ?', [JSON.stringify(events), listingUrl]);
  saveDb();
}

export async function saveDraft(listingUrl, draft) {
  await getDb();
  const row = get('SELECT messageDrafts FROM listings WHERE url = ?', [listingUrl]);
  if (!row) throw new Error(`Listing not found: ${listingUrl}`);
  const drafts = parseJson(row.messageDrafts, []);
  const newDraft = { id: draft.id ?? `draft_${Date.now()}`, createdAt: new Date().toISOString(), ...draft };
  drafts.push(newDraft);
  db.run('UPDATE listings SET messageDrafts = ? WHERE url = ?', [JSON.stringify(drafts), listingUrl]);
  saveDb();
  return newDraft;
}

export async function updateDraft(listingUrl, draftId, fields) {
  await getDb();
  const row = get('SELECT messageDrafts FROM listings WHERE url = ?', [listingUrl]);
  if (!row) throw new Error(`Listing not found: ${listingUrl}`);
  const drafts = parseJson(row.messageDrafts, []);
  const index = drafts.findIndex((d) => d.id === draftId);
  if (index === -1) throw new Error(`Draft not found: ${draftId}`);
  drafts[index] = { ...drafts[index], ...fields, id: draftId, updatedAt: new Date().toISOString() };
  db.run('UPDATE listings SET messageDrafts = ? WHERE url = ?', [JSON.stringify(drafts), listingUrl]);
  saveDb();
  return drafts[index];
}
