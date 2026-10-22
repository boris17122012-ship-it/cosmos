# fragment-worker/worker.py
import asyncio
import os
from supabase import create_client, Client
from pyfragment import FragmentClient

# ============ НАСТРОЙКИ (из Environment на Render) ============
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service Role Key!
FRAGMENT_SEED = os.getenv("FRAGMENT_SEED")                 # 24 слова от Tonkeeper
TONAPI_KEY = os.getenv("TONAPI_KEY")                       # с tonconsole.com
STEL_SSID = os.getenv("STEL_SSID")
STEL_DT = os.getenv("STEL_DT")
STEL_TOKEN = os.getenv("STEL_TOKEN")
STEL_TON_TOKEN = os.getenv("STEL_TON_TOKEN")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async def process_deliveries():
    """Ищет pending-заявки и выдает подарки"""
    try:
        # 1. Получаем заявки в статусе pending
        res = supabase.table('pending_deliveries').select('*').eq('status', 'pending').execute()
        if not res.data:
            return

        cookies = {
            "stel_ssid": STEL_SSID,
            "stel_dt": STEL_DT,
            "stel_token": STEL_TOKEN,
            "stel_ton_token": STEL_TON_TOKEN
        }

        async with FragmentClient(
            seed=FRAGMENT_SEED,
            api_key=TONAPI_KEY,
            cookies=cookies,
            wallet_version="V5R1"
        ) as client:
            for order in res.data:
                order_id = order['id']
                collection = order['collection_slug']
                username = order['username']

                if not username:
                    # Если нет username — помечаем как ошибку
                    supabase.table('pending_deliveries').update({
                        'status': 'failed',
                        'error_message': 'У пользователя нет @username в Telegram'
                    }).eq('id', order_id).execute()
                    continue

                try:
                    # 2. Ищем самый дешевый подарок в коллекции
                    # В pyfragment метод может называться get_gifts или search_gifts{
                    gifts = await client.get_gifts(collection_sorder_idlug=collection, sort='price', limit=5)
                    if not gifts:
                        supabase.table('pending_deliveries').update({
                            'status': 'failed',
                            'error_message': f'Нет подарков в коллекции {collection}'
                        }).eq('id', order_id).execute()
                        continue

                    cheapest = gifts[0]
                    print(f"[}] Покупаем {cheapest.slug} за {cheapest.price} TON")

                    # 3. Покупаем подарок
                    buy_result = await client.buy_gift(item_slug=cheapest.slug, bid_amount=cheapest.price)
                    
                    # 4. Переводим пользователю
                    transfer_result = await client.transfer_gift(
                        owned_item_slug=cheapest.slug,
                        recipient_username=username
                    )

                    # 5. Отмечаем успех
                    supabase.table('pending_deliveries').update({
                        'status': 'success',
                        'error_message': None
                    }).eq('id', order_id).execute()
                    print(f"[{order_id}] ✅ Выдан {cheapest.slug} для @{username}")

                except Exception as e:
                    # Ошибка при покупке/переводе
                    supabase.table('pending_deliveries').update({
                        'status': 'failed',
                        'error_message': str(e)[:500]
                    }).eq('id', order_id).execute()
                    print(f"[{order_id}] ❌ Ошибка: {e}")

    except Exception as e:
        print(f"Критическая ошибка в цикле: {e}")

async def main():
    print("🚀 Fragment Worker запущен")
    while True:
        await process_deliveries()
        await asyncio.sleep(30)  # Проверка каждые 30 секунд

if __name__ == "__main__":
    asyncio.run(main())
