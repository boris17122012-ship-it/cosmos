from collections import deque
import os
from PIL import Image

base = os.path.join(os.path.dirname(__file__), "img")
files = [
    "cosmos_standard.png",
    "cosmos_premium.png",
    "cosmos_elite.png",
    "cosmos_gift.png",
]


def knock(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    vis = [[False] * w for _ in range(h)]
    q = deque()

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r >= 232 and g >= 232 and b >= 232

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y):
                vis[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y) and not vis[y][x]:
                vis[y][x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not vis[ny][nx] and is_bg(nx, ny):
                vis[ny][nx] = True
                q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            near = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    near = True
                    break
            if near and r >= 210 and g >= 210 and b >= 210:
                wh = (r + g + b) / 3
                alpha = int(max(0, min(255, (250 - wh) * 6)))
                px[x, y] = (r, g, b, alpha)
    im.save(path)
    print("ok", os.path.basename(path), w, h)


if __name__ == "__main__":
    for name in files:
        knock(os.path.join(base, name))
