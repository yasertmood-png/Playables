const fs = require('fs');
const html = fs.readFileSync('c:/MoodGames/Playable Ads/Playables/Coin Sort/Original Gameplay/OriginalGameplay-60Sec-min.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
  console.log('Script', ++i, '| attrs:', m[1].trim() || '(none)', '| length:', m[2].length);
}
