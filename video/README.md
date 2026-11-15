# Roundabout product video

A 2½-minute promo for [Roundabout](https://github.com/shivamshinde123/Roundabout), built with [Remotion](https://www.remotion.dev) in the app's own Linear-style dark theme (Docs/design-system.md, D-43).

```bash
npm install
python scripts/voiceover.py   # Brian neural voice + word timings → public/voiceover/, src/voiceover.json (pip install edge-tts; needs ffprobe)
python scripts/music.py       # original music bed → public/music/bed.wav (numpy)
npx remotion studio           # preview / edit
npx remotion render src/index.ts RoundaboutPromo out/roundabout-promo.mp4
node scripts/stills.mjs <dir> 120 1281 2869   # render review frames at half size
```

**Scenes, in order:** the hook (who's doing what?), the problem (scattered chats), the reveal, the board and its badges, connecting over MCP, pickup, handoffs and blockers, review, updates while agents work, supported clients, the architecture, and the call to action.

- `src/Promo.tsx`: scene order, lengths, crossfades, and music that ducks under the voice
- `src/scenes/`: one component per scene; visuals are synced to the narration with `wordAt()`
- `src/components/ui.tsx`: the app's status icons, avatars, badges, cards, columns, window and terminal, redrawn with the same tokens
- `src/components/Captions.tsx`: word-by-word captions
- `src/theme.ts`: design tokens shared with the app and the website
- Client logos come from `../src/lib/client-logos.ts` (Simple Icons CC0, LobeHub MIT)
