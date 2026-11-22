// Phase 0 recon: hit each data source, save sample JSON to recon/samples/.
// Usage: node recon/recon.mjs   (optional env: ESPN_S2, ESPN_SWID)
import { writeFile } from 'node:fs/promises';
const OUT = new URL('./samples/', import.meta.url);
const SEASON = 2026;
const results = [];
async function hit(name, url, headers = {}) {
  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let ok = r.ok, note = `${r.status}`;
    try { JSON.parse(text); } catch { ok = false; note += ' non-JSON'; }
    await writeFile(new URL(`${name}.json`, OUT), text);
    results.push({ name, ok, note, bytes: text.length });
    return ok ? JSON.parse(text) : null;
  } catch (e) { results.push({ name, ok: false, note: e.message }); return null; }
}
const state = await hit('sleeper_state', 'https://api.sleeper.app/v1/state/nfl');
const week = state?.week ?? 12;
for (const id of ['1314651728238383104', '1376271532837339136']) {
  await hit(`sleeper_${id}_league`, `https://api.sleeper.app/v1/league/${id}`);
  await hit(`sleeper_${id}_users`, `https://api.sleeper.app/v1/league/${id}/users`);
  await hit(`sleeper_${id}_rosters`, `https://api.sleeper.app/v1/league/${id}/rosters`);
  await hit(`sleeper_${id}_matchups_w${week}`, `https://api.sleeper.app/v1/league/${id}/matchups/${week}`);
}
await hit(`sleeper_projections_w${week}`, `https://api.sleeper.com/projections/nfl/${SEASON}/${week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF`);
const players = await hit('sleeper_players_nfl', 'https://api.sleeper.app/v1/players/nfl');
const espnV = 'view=mTeam&view=mRoster&view=mMatchupScore&view=mSettings&view=mScoreboard';
const base = (id) => `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/segments/0/leagues/${id}?${espnV}&scoringPeriodId=${week}`;
await hit('espn_968263583', base('968263583'));
const cookie = process.env.ESPN_S2 ? { Cookie: `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}` } : {};
await hit('espn_1454538148', base('1454538148'), cookie);
const sb = await hit('espn_nfl_scoreboard', 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
const ev = sb?.events?.find(e => e.status?.type?.completed) ?? sb?.events?.[0];
if (ev) await hit(`espn_nfl_summary_${ev.id}`, `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${ev.id}`);
console.table(results);
console.log('NFL week (Sleeper):', week);
if (players) {
  const v = Object.values(players);
  console.log('players:', v.length, 'with espn_id:', v.filter(p => p.espn_id).length, 'with yahoo_id:', v.filter(p => p.yahoo_id).length);
}
