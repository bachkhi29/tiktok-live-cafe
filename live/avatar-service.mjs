import { createHash } from 'node:crypto';

const CDN = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tiktokv.com', 'ibyteimg.com', 'ibytedtos.com', 'byteoversea.com', 'muscdn.com'];
export function safeAvatarUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !CDN.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) return '';
    return url.href;
  } catch { return ''; }
}
export function avatarCandidates(data = {}) {
  const user = data.user || data;
  return [user.avatarThumb, user.avatarMedium, user.avatarLarge, user.avatarLarger, user.profilePictureUrl, data.profilePictureUrl]
    .flatMap(value => typeof value === 'string' ? [value] : value?.urlList || value?.url_list || []);
}
export class AvatarStore {
  constructor(fetchImage = fetch) { this.fetch = fetchImage; this.records = new Map(); }
  register(data) {
    const url = avatarCandidates(data).map(safeAvatarUrl).find(Boolean); if (!url) return '';
    const key = createHash('sha256').update(url).digest('hex').slice(0, 32);
    const previous = this.records.get(key); this.records.delete(key); this.records.set(key, previous || { url });
    if (this.records.size > 512) this.records.delete(this.records.keys().next().value);
    return `/live/avatar/${key}.img`;
  }
  async load(key) {
    const record = this.records.get(key); if (!record) return null;
    if (record.image) return record.image;
    if (record.failedUntil > Date.now()) return null;
    if (record.pending) return record.pending;
    record.pending = this.download(record.url).then(image => { record.image = image; return image; }).catch(() => { record.failedUntil = Date.now() + 30000; return null; }).finally(() => { record.pending = null; });
    return record.pending;
  }
  async download(input) {
    let url = safeAvatarUrl(input); if (!url) throw new Error('Avatar host rejected');
    const signal = AbortSignal.timeout(6000);
    for (let hop = 0; hop < 4; hop++) {
      const response = await this.fetch(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        url = safeAvatarUrl(new URL(response.headers.get('location'), url).href); if (!url) throw new Error('Avatar redirect rejected'); continue;
      }
      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!response.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(type) || Number(response.headers.get('content-length')) > 512 * 1024) { await response.body?.cancel(); throw new Error('Avatar response rejected'); }
      let size = 0; const chunks = [];
      for await (const chunk of response.body) { size += chunk.length; if (size > 512 * 1024) { throw new Error('Avatar too large'); } chunks.push(chunk); }
      if (!size) throw new Error('Empty avatar');
      return { type, bytes: Buffer.concat(chunks) };
    }
    throw new Error('Too many avatar redirects');
  }
}
