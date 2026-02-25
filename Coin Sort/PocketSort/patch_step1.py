import shutil

src = "c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSort/PocketSort.html"
shutil.copy(src, src + ".bak3")

with open(src, "r", encoding="utf-8-sig") as f:
    content = f.read()

results = []

# CHANGE 1
old1 = "    var   LockIconOffset      = { x: 0, y: 0.22, z: 0 }; // lock icon offset (debug-adjustable)"
new1 = ("    var   LockIconOffset      = { x: 0, y: 0.22, z: 0 }; // lock icon offset (debug-adjustable)
"
        "    var   LockIconScale       = { x: 1, y: 1 };           // lock icon scale X/Y (debug-adjustable)
"
        "    const ClosedSlotPreviewEnabled = true; // show preview on slot 0 to tune look; set false when done")
if old1 in content:
    content = content.replace(old1, new1, 1)
    results.append("CHANGE 1 OK: LockIconScale + ClosedSlotPreviewEnabled added")
else:
    results.append("CHANGE 1 FAIL: old text not found")
    print("DEBUG C1: snippet check:", repr(old1[:60]))
    idx = content.find("LockIconOffset")
    print("DEBUG C1: first LockIconOffset at index:", idx)
    if idx >= 0:
        print("DEBUG C1: context:", repr(content[idx-10:idx+100]))

print("Results so far:", results)
with open(src, "w", encoding="utf-8") as f:
    f.write(content)
