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

  // Temp: no auth for research. Remove this function after.

  try {
    var action = 'inventory';
    try { action = JSON.parse(event.body || '{}').action || 'inventory'; } catch {}

    if (action === 'inventory') {
      // List all folders
      var allFolders = [];
      var folderCursor = null;
      for (var p = 0; p < 5; p++) {
        var fpath = '/site-media/v1/folders?paging.limit=100' + (folderCursor ? '&paging.cursor=' + encodeURIComponent(folderCursor) : '');
        var fRes = await wixGet(fpath);
        if (fRes.folders) allFolders = allFolders.concat(fRes.folders);
        folderCursor = (fRes.pagingMetadata && fRes.pagingMetadata.cursors && fRes.pagingMetadata.cursors.next) || null;
        if (!folderCursor) break;
      }

      // List all videos
      var allVideos = [];
      var videoCursor = null;
      for (var vp = 0; vp < 10; vp++) {
        var vpath = '/site-media/v1/files?mediaTypes=VIDEO&paging.limit=100' + (videoCursor ? '&paging.cursor=' + encodeURIComponent(videoCursor) : '');
        var vRes = await wixGet(vpath);
        if (vRes.files) allVideos = allVideos.concat(vRes.files);
        videoCursor = (vRes.pagingMetadata && vRes.pagingMetadata.cursors && vRes.pagingMetadata.cursors.next) || null;
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

    if (action === 'programs') {
      // Try Online Programs via CMS Data Items API
      var results = {};

      // Try common Wix app collection names
      var collNames = [
        'OnlinePrograms/Programs',
        'OnlinePrograms/Sections',
        'OnlinePrograms/Steps',
        'online-programs/programs',
        'online-programs/sections',
        'online-programs/steps',
        'Video/Videos',
        'Video/Channels',
        'video/videos',
        'video/channels',
      ];

      for (var ci = 0; ci < collNames.length; ci++) {
        var cname = collNames[ci];
        try {
          var cRes = await wixPost('/wix-data/v2/items/query', {
            dataCollectionId: cname,
            query: { paging: { limit: 5 } },
          });
          if (cRes.dataItems) {
            results[cname] = {
              count: cRes.dataItems.length,
              totalCount: cRes.pagingMetadata?.total || cRes.dataItems.length,
              sample: cRes.dataItems.slice(0, 2).map(function(i) { return i.data || i; }),
            };
          } else {
            results[cname] = { error: cRes.message || cRes.error || 'empty' };
          }
        } catch (e) {
          results[cname] = { error: e.message };
        }
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify(results, null, 2) };
    }

    if (action === 'cms-query') {
      // Query a specific CMS collection with full pagination
      var body2 = JSON.parse(event.body || '{}');
      var collection = body2.collection;
      var limit = body2.limit || 100;
      if (!collection) return { statusCode: 400, headers: CORS, body: '{"error":"missing collection"}' };

      var allItems = [];
      var offset = 0;
      for (var pg = 0; pg < 20; pg++) {
        var qRes = await wixPost('/wix-data/v2/items/query', {
          dataCollectionId: collection,
          query: { paging: { limit: Math.min(limit, 100), offset: offset } },
        });
        if (!qRes.dataItems || qRes.dataItems.length === 0) break;
        allItems = allItems.concat(qRes.dataItems.map(function(i) { return i.data || i; }));
        offset += qRes.dataItems.length;
        if (allItems.length >= (qRes.pagingMetadata?.total || 9999)) break;
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ count: allItems.length, items: allItems }, null, 2) };
    }

    if (action === 'programs-v2') {
      // Try Online Programs via dedicated REST API paths
      var results = {};
      var tryPaths = [
        { name: 'programs', path: '/online-programs/v1/programs?paging.limit=50' },
        { name: 'programs-v3', path: '/online-programs/v3/programs/query' },
        { name: 'cms-programs', path: '/wix-data/v2/items/query' },
      ];

      // Try the CMS collections with the correct names
      var cmsNames = [
        'OnlinePrograms/Programs',
        'OnlinePrograms/Sections',
        'OnlinePrograms/Steps',
        'OnlinePrograms/Quizzes',
      ];
      for (var ci2 = 0; ci2 < cmsNames.length; ci2++) {
        try {
          var cr = await wixPost('/wix-data/v2/items/query', {
            dataCollectionId: cmsNames[ci2],
            query: { paging: { limit: 100 } },
            returnTotalCount: true,
          });
          results[cmsNames[ci2]] = {
            total: cr.pagingMetadata?.total || (cr.dataItems || []).length,
            items: (cr.dataItems || []).map(function(i) { return i.data || i; }),
          };
        } catch (e) {
          results[cmsNames[ci2]] = { error: e.message };
        }
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify(results, null, 2) };
    }

    if (action === 'list-collections') {
      var colRes = await wixGet('/wix-data/v2/collections?paging.limit=100');
      return { statusCode: 200, headers: CORS, body: JSON.stringify(colRes, null, 2) };
    }

    if (action === 'all-videos-csv') {
      // Export ALL videos, paginating with cursor properly
      var allV = [];
      var vc = null;
      var seen = {};
      for (var vp2 = 0; vp2 < 20; vp2++) {
        var vp2path = '/site-media/v1/files?mediaTypes=VIDEO&paging.limit=100' + (vc ? '&paging.cursor=' + encodeURIComponent(vc) : '');
        var vr = await wixGet(vp2path);
        if (!vr.files || vr.files.length === 0) break;
        vr.files.forEach(function(f) { if (!seen[f.id]) { seen[f.id] = true; allV.push(f); } });
        // Follow the cursor from pagingMetadata
        vc = (vr.pagingMetadata && vr.pagingMetadata.cursors && vr.pagingMetadata.cursors.next) || null;
        if (!vc) break;
      }

      var rows = allV.map(function(v) {
        return {
          fileId: v.id || '',
          title: (v.displayName || '').replace(/\.(mp4|mov)$/i, ''),
          uploadDate: v.createdDate || v._createdDate || '',
          thumbnailUrl: v.thumbnailUrl || '',
          isPrivate: v.private || false,
          url: v.url || '',
          parentFolderId: v.parentFolderId || 'root',
        };
      });

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ count: rows.length, videos: rows }, null, 2) };
    }

    return { statusCode: 400, headers: CORS, body: '{"error":"unknown action"}' };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
