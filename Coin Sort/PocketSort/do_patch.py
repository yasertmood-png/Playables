import shutil

src = r"c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSort/PocketSort.html"
shutil.copy(src, src + ".bak3")

with open(src, "r", encoding="utf-8-sig") as f:
    content = f.read()

results = []
