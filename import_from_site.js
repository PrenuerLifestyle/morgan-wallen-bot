/**
 * import_from_site.js
 *
 * Usage:
 *  - put items to import in items.json (array of {title, slug, date, author, excerpt, content, image, tags})
 *  - set .env variables (see README-import.md)
 *  - run: node import_from_site.js
 *
 * Changes from prior version:
 *  - Uses a single pooled DB connection (pg Pool) created once.
 *  - Performs batch inserts (configurable via BATCH_SIZE).
 *  - API payload allows merging extra fields from ADMIN_API_EXTRA_FIELDS (JSON string).
 *
 * Notes:
 *  - If your DB is not Postgres, change the importViaDbBatch() implementation to match your DB client.
 *  - If your admin API requires a different payload shape, either:
 *      * set ADMIN_API_EXTRA_FIELDS (JSON) to add extra fields to the body,
 *      * or paste the API contract and I'll adjust importViaApi() precisely.
 */

require('dotenv').config();
// If Node < 18, install node-fetch and uncomment:
// const fetch = require('node-fetch');

const fs = require('fs').promises;
const path = require('path');

const MODE = (process.env.IMPORT_MODE || 'api').toLowerCase();

// DB settings
const DB_BATCH_SIZE = parseInt(process.env.DB_BATCH_SIZE || '50', 10); // number of rows per INSERT
const TABLE_NAME = process.env.TABLE_NAME || 'tours'; // change to your target table

// API settings
const API_CONCURRENCY = parseInt(process.env.API_CONCURRENCY || '5', 10); // parallel requests for API mode
// ADMIN_API_EXTRA_FIELDS: JSON string to merge into each request body, e.g. '{"status":"published","source":"legacy"}'

/* -------------------------
   API import helper
   ------------------------- */
async function importViaApi(items) {
  const url = process.env.ADMIN_API_URL;
  const token = process.env.ADMIN_API_TOKEN;
  if (!url || !token) throw new Error('ADMIN_API_URL and ADMIN_API_TOKEN must be set for API mode');

  // Authorization header name + scheme are configurable:
  const authHeaderName = process.env.ADMIN_API_AUTH_HEADER || 'Authorization'; // e.g., "Authorization" or "x-api-key"
  const authScheme = process.env.ADMIN_API_AUTH_SCHEME || 'Bearer'; // e.g., "Bearer" or "" for raw API key

  // Optional: extra fields to merge into each payload (stringified JSON in env)
  let extraFields = {};
  if (process.env.ADMIN_API_EXTRA_FIELDS) {
    try {
      extraFields = JSON.parse(process.env.ADMIN_API_EXTRA_FIELDS);
    } catch (err) {
      console.warn('ADMIN_API_EXTRA_FIELDS is not valid JSON — ignoring.');
    }
  }

  // Default body mapping. Adjust this function if your API expects different keys.
  const makeBody = (item) => {
    return {
      title: item.title,
      slug: item.slug,
      date: item.date,
      author: item.author,
      excerpt: item.excerpt,
      content: item.content,
      image: item.image,
      tags: item.tags,
      ...extraFields
    };
  };

  // Simple concurrency control: process items in chunks
  const chunks = [];
  for (let i = 0; i < items.length; i += API_CONCURRENCY) {
    chunks.push(items.slice(i, i + API_CONCURRENCY));
  }

  const results = [];
  for (const chunk of chunks) {
    const promises = chunk.map(async (item) => {
      const body = makeBody(item);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [authHeaderName]: authScheme ? `${authScheme} ${token}` : token
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API import failed for "${item.title}": ${res.status} ${res.statusText} - ${txt}`);
      }
      return res.json();
    });

    // wait for the chunk to complete (failures will be caught by caller)
    const settled = await Promise.allSettled(promises);
    for (const s of settled) {
      results.push(s);
    }
  }

  return results;
}

/* -------------------------
   DB batch insert helper (Postgres)
   ------------------------- */
async function importViaDbBatch(pool, itemsBatch) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set for DB mode');

  // Columns expected - change to match your table schema
  const columns = ['title', 'slug', 'date', 'author', 'excerpt', 'content', 'image', 'tags'];

  // Build parameterized multi-row INSERT
  const values = [];
  const rowsSql = itemsBatch.map((item, i) => {
    const baseIndex = i * columns.length;
    values.push(
      item.title ?? null,
      item.slug ?? null,
      item.date ?? null,
      item.author ?? null,
      item.excerpt ?? null,
      item.content ?? null,
      item.image ?? null,
      JSON.stringify(item.tags ?? [])
    );
    // ($1,$2,$3,...,$8)
    const placeholders = columns.map((_, colIdx) => `$${baseIndex + colIdx + 1}`);
    return `(${placeholders.join(',')})`;
  });

  const text = `INSERT INTO ${TABLE_NAME} (${columns.join(',')}) VALUES ${rowsSql.join(',')} RETURNING id;`;

  const result = await pool.query(text, values);
  return result.rows;
}

/* -------------------------
   Runner
   ------------------------- */
async function run() {
  const itemsFile = process.env.ITEMS_FILE || 'items.json';
  const filePath = path.resolve(itemsFile);
  const raw = await fs.readFile(filePath, 'utf8');
  const items = JSON.parse(raw);

  if (!Array.isArray(items)) throw new Error(`${itemsFile} must contain an array of items`);

  console.log(`Import mode: ${MODE}. Found ${items.length} items in ${itemsFile}.`);

  if (MODE === 'api') {
    console.log(`Running API import to ${process.env.ADMIN_API_URL} with concurrency ${API_CONCURRENCY}`);
    const results = await importViaApi(items);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const title = items[i].title;
      if (r.status === 'fulfilled') {
        console.log(`[API] Imported "${title}" -> success`);
      } else {
        console.error(`[API] Failed to import "${title}":`, r.reason && r.reason.message ? r.reason.message : r.reason);
      }
    }
  } else if (MODE === 'db') {
    // Use a single Pool across the entire run.
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
      // Process items in batches
      for (let i = 0; i < items.length; i += DB_BATCH_SIZE) {
        const batch = items.slice(i, i + DB_BATCH_SIZE);
        try {
          const rows = await importViaDbBatch(pool, batch);
          console.log(`[DB] Inserted batch ${Math.floor(i / DB_BATCH_SIZE) + 1}: ${rows.length} rows`);
        } catch (err) {
          console.error(`[DB] Failed to insert batch starting at index ${i}:`, err.message);
          // continue on error — change to throw if you prefer to abort
        }
      }
    } finally {
      await pool.end();
    }
  } else {
    throw new Error(`Unknown IMPORT_MODE "${MODE}". Use "api" or "db".`);
  }

  console.log('Import complete.');
}

if (require.main === module) {
  // Node 18+ has global fetch; ensure it's available
  if (typeof fetch === 'undefined') {
    console.warn('Global fetch missing. If using Node <18, install node-fetch and uncomment the require in this script.');
  }

  run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
