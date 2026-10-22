// fragment-deliver.js - работает как Vercel Serverless Function
export default async function handler(req, res) {
    // Разрешаем CORS для нашего сайта
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, giftName } = req.body;

    if (!username || !giftName) {
        return res.status(400).json({ error: 'Не передан username или подарок' });
    }

    try {
        // ВНИМАНИЕ: Здесь мы стучимся к публичному API Fragment
        // В реальности для автовыдачи нужен полноценный сервер, 
        // но для теста мы проверим, отвечает ли API.
        
        const response = await fetch('https://api.fragment.com/api/transferGift', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Сюда вставляем твои cookies от Fragment (зашифрованные в переменной Vercel)
                'Cookie': process.env.FRAGMENT_COOKIES || '' 
            },
            body: JSON.stringify({
                to_username: username,
                gift_name: giftName,
                // Дополнительные параметры зависят от структуры API Fragment
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Ошибка Fragment API');
        }

        return res.status(200).json({ 
            status: 'success', 
            message: `Подарок ${giftName} отправлен на @${username}`,
            tx: data.transaction_hash || 'pending'
        });

    } catch (error) {
        console.error('Ошибка выдачи:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Не удалось отправить подарок. Проверьте настройки.' 
        });
    }
}
