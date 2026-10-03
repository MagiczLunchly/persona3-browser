'use strict';
const GAME_URL = 'https://github.com/MagiczLunchly/persona3-browser/releases/download/game-v1/Shin%20Megami%20Tensei%20-%20Persona%203%20Portable%20%28USA%29.iso';
const SIZE = 1321861120;
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  const start = Number(req.query.start), end = Number(req.query.end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= SIZE || end-start+1 > 4*1024*1024) {
    return res.status(400).send('Invalid game range');
  }
  try {
    const upstream = await fetch(GAME_URL, {
      headers: {'Range': `bytes=${start}-${end}`, 'Accept-Encoding':'identity'},
      signal: AbortSignal.timeout(45000)
    });
    if (upstream.status !== 206 || upstream.headers.get('content-range') !== `bytes ${start}-${end}/${SIZE}`) {
      if (upstream.body) await upstream.body.cancel();
      return res.status(502).send('Game download not ready');
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length !== end-start+1) return res.status(502).send('Incomplete game range');
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('Content-Length',buffer.length);
    return res.status(200).send(buffer);
  } catch (error) { return res.status(502).send('Could not download game'); }
};
