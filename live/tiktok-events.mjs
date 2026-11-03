export function liveUser(data = {}) {
  const user = data.user || {};
  const rawId = user.id || user.userId || user.uniqueId || data.userId || data.uniqueId;
  const id = String(rawId || '').trim();
  return {
    id: id ? `live:${id}` : '',
    name: user.nickname || user.displayId || data.nickname || user.uniqueId || 'Khách',
  };
}

export function liveChatText(data = {}) {
  return data.content || data.comment || '';
}
