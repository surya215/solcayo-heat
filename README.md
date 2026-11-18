# solcayo-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/surya215/solcayo-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/surya215/solcayo-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solcayo Heat is a complete open-world crime game in the spirit of GTA 6, set in the sun-soaked island city of Solcayo. Play as Jax Moreno, a getaway driver back on the island to settle a debt: steal cars, outrun the Solcayo police, and finish Selene's six story missions — from a hot package delivery to taking down El Tiburón himself.

## What is in the game

- **An open city** on a road grid with a beach, a marina, a park and five named places — drive it or walk it
- **Traffic and pedestrians** who drive the roads, walk the sidewalks and run from trouble
- **Cars to steal and drive**, with damage, smoke and explosions
- **A wanted level (0–5 stars)** with police cars that chase, ram and bust you — and a Taller that clears your name for cash
- **Six story missions** with waypoints, objectives and payouts, plus free roam after the finale
- **Combat** on foot with a pistol, enemy gunmen, and car chases against a courier and a boss limo
- **Shops**: repair and clear wanted at Taller Sol, ammo at Toko Senjata Baja, healing at Klinik Mar
- **A HUD with a minimap**, health/armor, money, wanted stars, a clock and a day/night cycle
- **Procedural WebAudio sound**: engine, sirens, gunshots and a sunset bassline — no audio files
- **A start screen, pause, busted/wasted screens, a finale screen, and saving** (money and mission progress in localStorage)

## Controls

- **WASD / arrows** — move on foot, drive (W accelerate, S brake/reverse, A/D steer)
- **Shift** — run
- **E** — steal / enter / exit a car, interact at shops and mission spots (hold E to collect debts)
- **Mouse** — aim, **click** — shoot
- **N** — start the next mission
- **Esc / P** — pause, **M** — mute, **Enter** — confirm menus

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/index.html` plays from static files in desktop Chrome. Screenshots under `screenshots/` are real renders of the game's own code, staged with `?shot=start|drive|chase|mission&seed=1`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=vfpg0cj5&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
