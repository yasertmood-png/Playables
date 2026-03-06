import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

files = [
    'c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSort/PocketSort.html',
    'c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSortV4/PocketSort-60Sec.html',
    'c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSortV4/PocketSort-30Sec.html',
]

# 1. Remove playSoundThrottled('drop') from onTransferComplete
old_transfer = """      var completedTransfers = 0;
      function onTransferComplete() {
        completedTransfers++;
        playSoundThrottled('drop');
        checkFillThreshold();"""

new_transfer = """      var completedTransfers = 0;
      function onTransferComplete() {
        completedTransfers++;
        checkFillThreshold();"""

# 2. Add _dropScheduled flag + scheduling in animateCoinArc onUpdate
old_update = """          coin.rotation.y = spinY;
        })
        .onComplete(function () {
          coin.userData.activeTween = null;"""

new_update = """          coin.rotation.y = spinY;
          if (!_dropScheduled && t >= 0.8) {
            _dropScheduled = true;
            var remainingSec = CoinTransferDuration * (1 - t) / 1000;
            scheduleDropSound(remainingSec);
          }
        })
        .onComplete(function () {
          coin.userData.activeTween = null;"""

# 3. Add the _dropScheduled variable declaration before the tween
old_tween = """      coin.userData.activeTween = new TWEEN.Tween({ t: 0 })
        .to({ t: 1 }, CoinTransferDuration)"""

new_tween = """      var _dropScheduled = false;
      coin.userData.activeTween = new TWEEN.Tween({ t: 0 })
        .to({ t: 1 }, CoinTransferDuration)"""

replacements = [
    (old_transfer, new_transfer, 'remove playSoundThrottled from onTransferComplete'),
    (old_update,   new_update,   'add drop scheduling in onUpdate'),
    (old_tween,    new_tween,    'add _dropScheduled flag'),
]

for path in files:
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    fname = path.split('/')[-1]
    errors = []

    for old, new, label in replacements:
        c = content.count(old)
        if c == 1:
            content = content.replace(old, new)
        else:
            errors.append(f'{label}: {c} matches')

    if not errors:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'OK: {fname}')
    else:
        print(f'ERROR {fname}: {errors}')
