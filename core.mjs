export function terms(text) {
  return (String(text).toLowerCase().match(/[\p{Script=Han}]{2,}|[a-z0-9]{3,}/gu) || []).flatMap(token =>
    /[\p{Script=Han}]/u.test(token) && token.length > 3
      ? [token, ...Array.from({ length: token.length - 1 }, (_, i) => token.slice(i, i + 2))]
      : [token]
  );
}

export function suggestGroup(card, groups) {
  const cardTerms = new Set(terms(`${card.text} ${card.memo} ${card.tags.join(' ')}`));
  let best = { id: null, score: 0 };
  for (const group of groups) {
    const groupTerms = new Set(terms(`${group.name} ${group.description || ''}`));
    const common = [...cardTerms].filter(term => groupTerms.has(term)).length;
    const score = common / Math.max(1, Math.sqrt(cardTerms.size * groupTerms.size));
    if (score > best.score) best = { id: group.id, score };
  }
  return best.score >= 0.12 ? best.id : null;
}

export function inferIntent(memo) {
  const value = String(memo).trim();
  if (!value) return '尚未说明想怎样使用这条素材';
  if (/以后|未来|下次|备用|另一个选题/.test(value)) return '用户希望将这条素材保留，供未来选题使用';
  if (/开头|引入|钩子/.test(value)) return '用户考虑将这条素材用于脚本开头';
  if (/例子|案例|举例/.test(value)) return '用户考虑将这条素材作为例子';
  if (/论据|证明|支持|数据/.test(value)) return '用户考虑将这条素材作为观点的依据';
  return `用户的使用意图：${value}`;
}

export function relevantCards(question, cards, groups) {
  const query = new Set(terms(question));
  const groupNames = Object.fromEntries(groups.map(group => [group.id, group.name]));
  return cards.map(card => {
    const haystack = new Set(terms(`${card.text} ${card.memo} ${card.intent} ${card.tags.join(' ')} ${groupNames[card.groupId] || ''}`));
    const overlap = [...query].filter(term => haystack.has(term)).length;
    return { ...card, score: overlap + (card.status === 'current' ? 0.25 : 0) };
  }).filter(card => card.status === 'current').sort((a, b) => b.score - a.score).slice(0, 6);
}
