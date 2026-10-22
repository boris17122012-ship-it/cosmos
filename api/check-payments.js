// api/check-payment.js — Vercel Serverless Function
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, invoiceId, expectedTon, telegramId, username, collectionSlug } = req.body;
    const RECEIVER = "UQBYFdivQebVdF1Q2moiL42d_zPtjXrMiuj9HmmzCPTuZy8m";

    // Действие 1: Проверка оплаты
    if (action === 'check_payment') {
        try {
            const r = await fetch(`https://tonapi.io/v2/accounts/${RECEIVER}/events?limit=20`);
            const data = await r.json();
            const events = data.events || [];

            for (const ev of events) {
                for (const actionItem of ev.actions || []) {
                    if (actionItem.type !== 'TonTransfer') continue;
                    const t = actionItem.TonTransfer;
                    if ((t.recipient?.address || '').toUpperCase() !== RECEIVER.toUpperCase()) continue;
                    if ((t.comment || '').trim() !== invoiceId) continue;
                    const amount = Number(t.amount) / 1e9;
                    if (amount + 0.01 < Number(expectedTon)) continue;
                    return res.status(200).json({ paid: true, tx: ev.event_id });
                }
            }
            return res.status(200).json({ paid: false });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // Действие 2: Запись выигрыша в базу (для Python-сервера)
    if (action === 'record_win') {
        if (!telegramId || !collectionSlug) {
            return res.status(400).json({ error: 'Missing telegramId or collectionSlug' });
        }
        try {
            // Отправляем запрос в Supabase REST API (без библиотеки)
            const supabaseUrl = 'https://oawmltaiiryankxvtzrc.supabase.co';
            const supabaseKey = 'sb_publishable_ITLPWUq4nnEEe1VGmEmuJw_dLjOvozA';
            
            const r = await fetch(`${supabaseUrl}/rest/v1/pending_deliveries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    username: username || null,
                    collection_slug: collectionSlug,
                    status: 'pending'
                })
            });
            
            if (!r.ok) {
                const err = await r.text();
                return res.status(500).json({ error: err });
            }
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(400).json({ error: 'Unknown action' });
}
