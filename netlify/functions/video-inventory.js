// TEMPORARY: inventory all videos and folders in the Wix Media Manager
// Secured with ADMIN_PASSWORD. Remove after research.

const https = require('https');
const TIMEOUT_MS = 9000;

async function wixGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'www.wixapis.com', path,
      headers: {
        Authorization: process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID,
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: d.slice(0, 300) }); } });
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function wixPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'www.wixapis.com', path, method: 'POST',
      headers: {
        Authorization: process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID,
        'Content-Type': 'application/json',
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: d.slice(0, 300) }); } });
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd || event.headers['x-admin-password'] !== pwd) {
    return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };
  }

  try {
    var action = 'inventory';
    try { action = JSON.parse(event.body || '{}').action || 'inventory'; } catch {}

    if (action === 'inventory') {
      // List all folders
      var allFolders = [];
      var folderCursor = null;
      for (var p = 0; p < 5; p++) {
        var fpath = '/site-media/v1/folders?paging.limit=100' + (folderCursor ? '&paging.cursor=' + folderCursor : '');
        var fRes = await wixGet(fpath);
        if (fRes.folders) allFolders = allFolders.concat(fRes.folders);
        folderCursor = fRes.nextCursor || null;
        if (!folderCursor) break;
      }

      // List all videos
      var allVideos = [];
      var videoCursor = null;
      for (var vp = 0; vp < 10; vp++) {
        var vpath = '/site-media/v1/files?mediaTypes=VIDEO&paging.limit=100' + (videoCursor ? '&paging.cursor=' + videoCursor : '');
        var vRes = await wixGet(vpath);
        if (vRes.files) allVideos = allVideos.concat(vRes.files);
        videoCursor = vRes.nextCursor || null;
        if (!videoCursor) break;
      }

      // Build folder lookup
      var folderMap = {};
      allFolders.forEach(function(f) { folderMap[f.id] = f.displayName; });

      // Group videos by folder
      var byFolder = {};
      allVideos.forEach(function(v) {
        var folder = folderMap[v.parentFolderId] || v.parentFolderId || 'root';
        if (!byFolder[folder]) byFolder[folder] = [];
        byFolder[folder].push({
          id: v.id,
          name: v.displayName,
          private: v.private || false,
          url: v.url || null,
          thumbnailUrl: v.thumbnailUrl || null,
        });
      });

      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({
          totalFolders: allFolders.length,
          totalVideos: allVideos.length,
          folders: allFolders.map(function(f) { return { id: f.id, name: f.displayName, parent: f.parentFolderId }; }),
          videosByFolder: byFolder,
        }, null, 2),
      };
    }

    if (action === 'stream') {
      // Generate a streaming URL for a specific video
      var fileId = JSON.parse(event.body || '{}').fileId;
      if (!fileId) return { statusCode: 400, headers: CORS, body: '{"error":"missing fileId"}' };

      var streamRes = await wixPost('/site-media/v1/files/generate-video-stream-url', {
        fileId: fileId,
        format: 'HLS',
        expirationInMinutes: 60,
      });

      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify(streamRes, null, 2),
      };
    }

    return { statusCode: 400, headers: CORS, body: '{"error":"unknown action"}' };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
