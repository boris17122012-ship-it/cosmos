// api/check-payment.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { invoiceId, expectedTon } = req.body;
    const RECEIVER = "UQBYFdivQebVdF1Q2moiL42d_zPtjXrMiuj9HmmzCPTuZy8m";

    try {
        // Стучимся в блокчейн TON и смотрим входящие транзакции на твой кошелек
        const r = await fetch(`https://tonapi.io/v2/accounts/${RECEIVER}/events?limit=20`);
        const data = await r.json();
        const events = data.events || [];

        for (const ev of events) {
            for (const action of ev.actions || []) {
                if (action.type !== 'TonTransfer') continue;
                const t = action.TonTransfer;
                
                // Проверяем, что отправили ИМЕННО НАМ и с нашим комментарием
                if ((t.recipient?.address || '').toUpperCase() !== RECEIVER.toUpperCase()) continue;
                if ((t.comment || '').trim() !== invoiceId) continue;
                
                // Проверяем, что сумма достаточная
                const amount = Number(t.amount) / 1e9;
                if (amount + 0.01 < Number(expectedTon)) continue;

                // Если всё совпало - ОПЛАТА НАЙДЕНА
                return res.status(200).json({ paid: true, tx: ev.event_id });
            }
        }
        // Если не нашли - значит пользователь еще не перевел или перевел с ошибкой
        return res.status(200).json({ paid: false });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
