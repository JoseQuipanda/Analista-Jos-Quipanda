// Função da Vercel: /api/noticias
// Lê notícias recentes de saúde em Angola (em português) e devolve apenas as últimas 48 horas.
const FEEDS = [
  'https://news.google.com/rss/search?q=sa%C3%BAde+Angola+when:2d&hl=pt-419&gl=AO&ceid=AO:pt-419',
  'https://news.google.com/rss/search?q=OMS+Angola+vacina%C3%A7%C3%A3o+OR+mal%C3%A1ria+OR+c%C3%B3lera+when:2d&hl=pt-419&gl=AO&ceid=AO:pt-419'
];
const decode = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (x, t) => { const m = x.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? decode(m[1]) : ''; };
function parse(xml) {
  return (xml.match(/<item>[\s\S]*?<\/item>/g) || []).map((it) => {
    let title = tag(it, 'title'); const source = tag(it, 'source');
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    const d = new Date(tag(it, 'pubDate'));
    return { title, link: tag(it, 'link'), source, date: isNaN(d) ? null : d.toISOString() };
  }).filter((i) => i.title && i.link && i.date);
}
module.exports = async (req, res) => {
  try {
    const results = await Promise.allSettled(FEEDS.map((u) => fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })));
    const limit = Date.now() - 48 * 3600 * 1000; const seen = new Set(); let items = [];
    results.forEach((r) => { if (r.status === 'fulfilled') items.push(...parse(r.value)); });
    items = items.filter((i) => new Date(i.date).getTime() >= limit && !seen.has(i.title) && seen.add(i.title))
      .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=600');
    res.status(200).json({ items, updatedAt: new Date().toISOString() });
  } catch (e) { res.status(200).json({ items: [], error: 'indisponivel' }); }
};
