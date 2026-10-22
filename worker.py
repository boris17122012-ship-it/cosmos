import asyncio
import os
from supabase import create_client, Client
from pyfragment import FragmentClient

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
FRAGMENT_SEED = os.getenv("FRAGMENT_SEED")
TONAPI_KEY = os.getenv("TONAPI_KEY")
STEL_SSID = os.getenv("STEL_SSID")
STEL_DT = os.getenv("STEL_DT")
STEL_TOKEN = os.getenv("STEL_TOKEN")
STEL_TON_TOKEN = os.getenv("STEL_TON_TOKEN")

# Подключение к Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async def process_deliveries():
    try:
        # Ищем новые заявки
        res = supabase.table('pending_deliveries').select('*').eq('status', 'pending').execute()
        if not res.data:
            return

        cookies = {
            "stel_ssid": STEL_SSID,
            "stel_dt": STEL_DT,
            "stel_token": STEL_TOKEN,
            "stel_ton_token": STEL_TON_TOKEN
        }

        # Подключаемся к Fragment
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
                    supabase.table('pending_deliveries').update({'status': 'failed', 'error_message': 'Нет username'}).eq('id', order_id).execute()
                    continue

                try:
                    # Ищем подарки
                    gifts = await client.get_gifts(collection_slug=collection, sort='price', limit=5)
                    if not gifts:
                        supabase.table('pending_deliveries').update({'status': 'failed', 'error_message': f'Пустая коллекция {collection}'}).eq('id', order_id).execute()
                        continue

                    cheapest = gifts[0]
                    print(f"[{order_id}] Покупка {cheapest.slug} за {cheapest.price} TON")

                    # Покупка и перевод
                    await client.buy_gift(item_slug=cheapest.slug, bid_amount=cheapest.price)
                    await client.transfer_gift(owned_item_slug=cheapest.slug, recipient_username=username)

                    # Отмечаем успех
                    supabase.table('pending_deliveries').update({'status': 'success'}).eq('id', order_id).execute()
                    print(f"[{order_id}] УСПЕШНО ВЫДАНО @{username}")

                except Exception as e:
                    supabase.table('pending_deliveries').update({'status': 'failed', 'error_message': str(e)[:500]}).eq('id', order_id).execute()
                    print(f"[{order_id}] ОШИБКА: {e}")

    except Exception as e:
        print(f"КРИТИЧЕСКАЯ ОШИБКА: {e}")

async def main():
    print("🚀 Fragment Worker запущен")
    while True:
        await process_deliveries()
        await asyncio.sleep(30)

if __name__ == "__main__":
    asyncio.run(main())
