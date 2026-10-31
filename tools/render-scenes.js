// 배경 × 시간대 스크린샷 → tools/out/scene_<배경>_<시간대>.png (서버 필요)
//   BGS=city,lighthouse TODS=dusk node tools/render-scenes.js
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const bgs = (process.env.BGS || 'neon,city,lighthouse,aurora').split(','), tods = (process.env.TODS || 'dawn,morning,dusk,night').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=d3d11'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; p.on('pageerror', x => errs.push(x.message));
  for (const bg of bgs) for (const t of tods) {
    await p.goto(`http://localhost:8766/?bg=${bg}&time=${t}`); await p.waitForTimeout(500);
    await p.evaluate(() => document.body.classList.add('hideui'));
    await p.waitForTimeout(1800);
    await p.screenshot({ path: path.join(OUT, `scene_${bg}_${t}.png`) });
  }
  console.log('fps', Math.round(await p.evaluate(() => RK.fps)), 'errors', JSON.stringify(errs)); await b.close();
})();
