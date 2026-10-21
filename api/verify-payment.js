// api/verify-payment.js — Vercel Serverless Function
// Проверяет: приходила ли TON-транзакция с нужным comment на ваш адрес

const RECEIVER = "UQBYFdivQebVdF1Q2moiL42d_zPtjXrMiuj9HmmzCPTuZy8m";
const TON_API = "https://tonapi.io/v2";

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    const { invoiceId, expectedTon } = req.body || {};
    if (!invoiceId || !expectedTon) {
        return res.status(400).json({ error: 'missing params' });
    }

    try {
        // Получаем последние события по кошельку получателя
        const r = await fetch(
            `${TON_API}/accounts/${RECEIVER}/events?limit=30`,
            {
                headers: process.env.TON_API_KEY
                    ? { Authorization: `Bearer ${process.env.TON_API_KEY}` }
                    : {}
            }
        );
        if (!r.ok) return res.status(502).json({ error: 'tonapi fail' });
        const data = await r.json();
        const events = data.events || [];

        for (const ev of events) {
            for (const action of ev.actions || []) {
                if (action.type !== 'TonTransfer') continue;
                const t = action.TonTransfer;

                // 1) получатель = наш кошелёк?
                const recipient = (t.recipient?.address || '').toUpperCase();
                if (recipient !== RECEIVER.toUpperCase()) continue;

                // 2) комментарий = invoiceId?
                const comment = (t.comment || '').trim();
                if (comment !== invoiceId) continue;

                // 3) сумма достаточна? (в нанотонах / 1e9 = TON)
                const amount = Number(t.amount) / 1e9;
                if (amount + 0.01 < Number(expectedTon)) continue;

                // 4) транзакция не старше 30 минут? (защита от старых)
                const ts = ev.timestamp || 0; // unix
                if (ts && Date.now() / 1000 - ts > 1800) continue;

                // ✅ ОПЛАТА ПОДТВЕРЖДЕНА
                return res.status(200).json({
                    paid: true,
                    amount,
                    txHash: ev.event_id || ev.lt || null,
                    comment
                });
            }
        }
        return res.status(200).json({ paid: false });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
