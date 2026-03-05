import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

files = [
    'c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSortV4/PocketSort-60Sec.html',
    'c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSortV4/PocketSort-30Sec.html',
    'c:/MoodGames/Playable Ads/Playables/Coin Sort/PocketSort/PocketSort.html',
]

old_throttle = """    var _soundThrottleMs = { pickup: 0, place: 0, merge: 0, complete: 0 };
    // Stores last played timestamp per key for playSoundThrottled
    var _lastThrottledMs = {};

    // Plays a sound only if enough time has passed since the same key was last played
    function playSoundThrottled(key) {
      var now = performance.now();
      var minInterval = _soundThrottleMs[key] || 0;
      if (minInterval > 0 && _lastThrottledMs[key] && now - _lastThrottledMs[key] < minInterval) return;
      _lastThrottledMs[key] = now;
      playSound(key);
    }

    // Drop sound — guaranteed no simultaneous overlapping playback.
    // Uses onended so the flag clears exactly when the sound finishes,
    // regardless of how many coins land at the same time.
    var _dropBusy = false;
    function playDropSound() {
      if (_dropBusy || audioMuted || !isFocused || !_audioCtx || !_audioBuffers['drop']) return;
      _dropBusy = true;
      var src = _makeSourceNode('drop');
      if (!src) { _dropBusy = false; return; }
      src.onended = function() { _dropBusy = false; };
      try {
        src.start(_audioCtx.currentTime);
      } catch(e) { _dropBusy = false; }
    }"""

new_throttle = """    // drop throttle: long enough to cover the sound duration so simultaneous
    // landings from multiple slots never overlap the same sound.
    var _soundThrottleMs = { drop: 200, pickup: 0, place: 0, merge: 0, complete: 0 };
    // Stores last played timestamp per key for playSoundThrottled
    var _lastThrottledMs = {};

    // Single entry point for all sounds — skips if called again before delay has passed.
    function playSoundThrottled(key) {
      var now = performance.now();
      var minInterval = _soundThrottleMs[key] || 0;
      if (minInterval > 0 && _lastThrottledMs[key] && now - _lastThrottledMs[key] < minInterval) return;
      _lastThrottledMs[key] = now;
      playSound(key);
    }"""

# Call site replacements
replacements = [
    # deal coin landing
    ("                playDropSound();",              "                playSoundThrottled('drop');"),
    # transfer complete
    ("        playDropSound();\n        checkFillThreshold();",
     "        playSoundThrottled('drop');\n        checkFillThreshold();"),
    # merge landing
    ("          playDropSound();\n",                 "          playSoundThrottled('drop');\n"),
]

for path in files:
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    fname = path.split('/')[-1]
    errors = []

    c = content.count(old_throttle)
    if c == 1:
        content = content.replace(old_throttle, new_throttle)
    else:
        errors.append(f'throttle block: {c} matches')

    for old, new in replacements:
        c = content.count(old)
        if c == 1:
            content = content.replace(old, new)
        else:
            errors.append(f'{repr(old[:40])}: {c} matches')

    if not errors:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'OK: {fname}')
    else:
        print(f'ERROR {fname}: {errors}')
