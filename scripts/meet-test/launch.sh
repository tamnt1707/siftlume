#!/bin/sh
# Opens Chrome window A or B with a WAV file as its microphone (scripts/meet-test/README.md).
# Without --disable-features=AudioServiceSandbox, Chrome on macOS cannot read the file and the
# fake microphone stays silent.
#   sh scripts/meet-test/launch.sh a     # signed-in host, with Siftlume loaded
#   sh scripts/meet-test/launch.sh b     # guest
set -e
WHO=${1:-a}
DIR=${MEET_TEST_DIR:-$HOME/meet-test}
CHROME=${CHROME_PATH:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
WAV="$DIR/speaker-$WHO.wav"
[ -f "$WAV" ] || { echo "Missing $WAV: run python3 scripts/meet-test/make-audio.py first"; exit 1; }
URL=${2:-https://meet.new}
[ "$WHO" = b ] && URL=${2:-about:blank}
exec "$CHROME" \
  --user-data-dir="$DIR/profile-$WHO" \
  --no-first-run \
  --use-fake-device-for-media-stream \
  --use-fake-ui-for-media-stream \
  --disable-features=AudioServiceSandbox \
  --use-file-for-fake-audio-capture="$WAV" \
  "$URL"
