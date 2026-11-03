import { synthesizeSpeech } from './speech-service.mjs';

const aborted = () => Object.assign(new Error('Đã dừng đọc.'), { name: 'AbortError' });
export function splitSpeech(text, limit = 180) {
  const chars = [...String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim()], result = [];
  while (chars.length) {
    let end = Math.min(limit, chars.length);
    if (end < chars.length) for (let i = end - 1; i > limit / 2; i--) if (/\s/.test(chars[i])) { end = i + 1; break; }
    const part = chars.splice(0, end).join('').trim(); if (part) result.push(part);
  }
  return result;
}
function isMp3(audio) {
  return audio.length > 64 && (audio.subarray(0, 3).toString() === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0));
}
export async function synthesizeGoogleVietnamese(text, options = {}) {
  const chunks = splitSpeech(text), audio = [], fetchAudio = options.fetch || fetch;
  if (!chunks.length) throw new Error('Lời đọc đang trống.');
  for (const [index, part] of chunks.entries()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (options.signal?.aborted) throw aborted();
      try {
        const url = new URL('https://translate.google.com/translate_tts');
        url.search = new URLSearchParams({ ie: 'UTF-8', client: 'tw-ob', tl: 'vi', q: part, total: String(chunks.length), idx: String(index), textlen: String([...part].length) });
        const timeout = AbortSignal.timeout(options.timeoutMs || 8000);
        const response = await fetchAudio(url, { signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' } });
        if (!response.ok || !/^audio\/(mpeg|mp3)(?:;|$)/i.test(response.headers.get('content-type') || '')) throw new Error(`Nguồn giọng Việt dự phòng trả phản hồi không phải âm thanh (HTTP ${response.status}).`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!isMp3(bytes)) throw new Error('Nguồn giọng Việt dự phòng chưa trả được MP3 hợp lệ.');
        audio.push(bytes); break;
      } catch (error) {
        if (options.signal?.aborted) throw aborted();
        if (attempt === 1) throw error;
      }
    }
  }
  return Buffer.concat(audio);
}
export async function synthesizeVietnameseSpeech(job, options = {}) {
  if (options.signal?.aborted) throw aborted();
  try {
    const audio = await (options.edge || synthesizeSpeech)(job, { signal: options.signal, attempts: 1, timeoutMs: 8000 });
    return { audio, source: 'edge', playbackRate: 1 };
  } catch (error) {
    if (options.signal?.aborted || error.name === 'AbortError') throw aborted();
    options.onFallback?.(error);
    const audio = await synthesizeGoogleVietnamese(job.text, options);
    if (options.signal?.aborted) throw aborted();
    const rate = Number.isFinite(job.rate) ? job.rate : 0;
    return { audio, source: 'google', playbackRate: Math.max(.5, Math.min(1.5, 1 + rate / 100)) };
  }
}
