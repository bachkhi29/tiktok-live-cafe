import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
const xml = text => String(text).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
// Edge's voice list publishes both ShortName and Name. Vietnamese synthesis needs Name.
// Keep stable ShortName values in settings/cache, expand only on the wire.
const VOICE_NAMES = {
  'vi-VN-HoaiMyNeural': 'Microsoft Server Speech Text to Speech Voice (vi-VN, HoaiMyNeural)',
  'vi-VN-NamMinhNeural': 'Microsoft Server Speech Text to Speech Voice (vi-VN, NamMinhNeural)',
};
export async function synthesizeSpeech(job, options = {}) {
  const createClient = options.createClient || (() => new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 15000 }));
  const attempts = options.attempts ?? 2, timeoutMs = options.timeoutMs ?? 20000;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const client = createClient(); let timer, abort;
    try {
      if (options.signal?.aborted) throw Object.assign(new Error('Đã dừng đọc.'), { name: 'AbortError' });
      const audio = await Promise.race([
        (async () => {
          await client.setMetadata(VOICE_NAMES[job.voice] || job.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
          const { audioStream } = client.toStream(xml(job.text), { pitch: `${job.pitch >= 0 ? '+' : ''}${job.pitch}Hz`, rate: `${job.rate >= 0 ? '+' : ''}${job.rate}%` });
          return await new Promise((resolve, reject) => { const chunks = []; audioStream.on('data', chunk => chunks.push(chunk)); audioStream.once('end', () => resolve(Buffer.concat(chunks))); audioStream.once('error', reject); });
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Dịch vụ giọng đọc quá thời gian 20 giây.')), timeoutMs); }),
        new Promise((_, reject) => { abort = () => reject(Object.assign(new Error('Đã dừng đọc.'), { name: 'AbortError' })); options.signal?.addEventListener('abort', abort, { once: true }); }),
      ]);
      if (!audio.length) throw new Error('Dịch vụ trả về âm thanh rỗng.');
      return audio;
    } catch (error) {
      if (error.name === 'AbortError' || attempt === attempts - 1) throw error;
      options.onRetry?.(error);
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); try { client.close(); } catch {} }
  }
}
