// Серверный прокси для OpenRouter (Vercel Function). Ключ живёт только в переменных окружения сервера.
const MODELS = (process.env.AI_MODEL || 'google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-ultra-550b-a55b:free,cohere/north-mini-code:free').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Только POST' } });
    const key = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!key) return res.status(500).json({ error: { message: 'На сервере не задан OPENROUTER_API_KEY' } });

    const { messages, response_format } = req.body || {};
    // защита от злоупотреблений: ограничиваем форму и размер запроса, модель выбирает сервер
    const ok = Array.isArray(messages) && messages.length >= 1 && messages.length <= 3
        && messages.every((m) => ['system', 'user'].includes(m?.role) && typeof m.content === 'string')
        && messages.reduce((n, m) => n + m.content.length, 0) < 30000
        && messages.filter((m) => m.role === 'user').every((m) => m.content.length <= 500);
    if (!ok) return res.status(400).json({ error: { message: 'Некорректный запрос' } });

    try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'AI NodeGen Studio' },
            body: JSON.stringify({
                // список бесплатных моделей через запятую: если первая недоступна, OpenRouter пробует следующую
                ...(MODELS.length > 1 ? { models: MODELS } : { model: MODELS[0] }),
                temperature: 0.4, max_tokens: 6000, messages,
                ...(response_format?.type === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
            }),
        });
        const data = await r.json().catch(() => ({}));
        return res.status(r.status).json(data);
    } catch {
        return res.status(502).json({ error: { message: 'Не удалось связаться с OpenRouter' } });
    }
}