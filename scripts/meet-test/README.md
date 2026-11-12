# Testing the Meet recorder without speaking

Two Chrome windows join one Google Meet call. Each uses a WAV file as its microphone, made from
`meeting.txt` with macOS `say`, and the two files take turns, so Meet captions a two-person
meeting with names. Nobody has to talk.

## Once

```bash
pnpm build                                       # .output/chrome-mv3
python3 scripts/meet-test/make-audio.py          # ~/meet-test/speaker-a.wav and speaker-b.wav (~2 min)
sh scripts/meet-test/launch.sh a                 # window A: a new Chrome profile
```

In window A (the profile is kept in `~/meet-test/profile-a`, so this is needed only once):

1. Sign in to Google.
2. Open `chrome://extensions`, turn on **Developer mode**, **Load unpacked** → `.output/chrome-mv3`.
   Chrome no longer accepts `--load-extension`, so this cannot be scripted. After each new build,
   click the reload arrow on the Siftlume card.
3. Set up Siftlume (Settings → an AI provider), and pin its icon.

## Each test

1. Window A opens `meet.new`: join the call. Copy the meeting link.
2. `sh scripts/meet-test/launch.sh b <meeting link>`: window B joins as a guest named e.g. **Bao**.
   Admit B in window A.
3. Both files start playing as soon as each window has its microphone, so restart them in step:
   in both windows turn the microphone off, then on again, within a second or two. (Or relaunch B
   last; a few seconds of offset only shifts the turns.)
4. In window A, click the Siftlume icon → the side panel shows **Start recording**. Captions are
   turned on automatically; the transcript appears live with both names.
5. After ~2 minutes (before the files loop), click **Stop and summarize**, or leave the call:
   ending the call summarizes once.
6. Click **Export debug log** and send the JSON: it records how Meet's caption area changed, which
   is what the recorder's selectors and the replay tests are built from.

To avoid echo, mute the speaker in one window (tab right-click → Mute site).

The expected summary (from `meeting.txt`): launch moved to **Monday the 20th**, press release stays
on Friday; ads budget **8,000 Instagram / 4,000 search**; action items **Bao: Android QA by
Wednesday**, **Bao: release notes to Ana by Thursday**, **Ana: tell marketing today**; open question:
**tablet onboarding screen**, decided next week.

Other languages: write the turns in that language and pick voices, e.g.
`python3 scripts/meet-test/make-audio.py my-meeting.txt ~/meet-test Linh Linh` (Vietnamese), and
set Meet's caption language to match.
