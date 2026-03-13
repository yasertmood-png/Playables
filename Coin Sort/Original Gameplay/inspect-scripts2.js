const fs = require('fs');
const html = fs.readFileSync('c:/MoodGames/Playable Ads/Playables/Coin Sort/Original Gameplay/OriginalGameplay-60Sec-min.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
  i++;
  if (i === 1 || i === 3) {
    console.log('\n--- Script', i, '---');
    console.log(m[2].substring(0, 300));
  }
}
