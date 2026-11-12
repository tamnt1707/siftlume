#!/bin/sh
# Opens Chrome window A or B with a WAV file as its microphone (scripts/meet-test/README.md).
#   sh scripts/meet-test/launch.sh a                         # host, in a separate test profile
#   MEET_PROFILE="Profile 2" sh scripts/meet-test/launch.sh a  # host, in one of your own profiles
#   sh scripts/meet-test/launch.sh b <meeting link>          # guest, in a separate profile
#
# The flags apply to a whole Chrome process, not to one profile: with MEET_PROFILE, quit Chrome
# completely first (Cmd+Q), or Chrome opens a window in the running process and ignores them.
# Every profile of that process then has the fake microphone: quit and reopen Chrome normally
# when done. Without --disable-features=AudioServiceSandbox, Chrome on macOS cannot read the file
# and the fake microphone stays silent.
set -e
WHO=${1:-a}
DIR=${MEET_TEST_DIR:-$HOME/meet-test}
CHROME=${CHROME_PATH:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
WAV="$DIR/speaker-$WHO.wav"
[ -f "$WAV" ] || { echo "Missing $WAV: run python3 scripts/meet-test/make-audio.py first"; exit 1; }
URL=${2:-https://meet.new}
[ "$WHO" = b ] && URL=${2:-about:blank}

if [ "$WHO" = a ] && [ -n "$MEET_PROFILE" ]; then
  if pgrep -xq "Google Chrome"; then
    echo "Chrome is running: quit it completely (Cmd+Q) and run this again, or the flags are ignored."
    exit 1
  fi
  PROFILE_ARGS="--profile-directory=$MEET_PROFILE"
  DATA_DIR="$HOME/Library/Application Support/Google/Chrome"
else
  PROFILE_ARGS=""
  DATA_DIR="$DIR/profile-$WHO"
fi

exec "$CHROME" \
  --user-data-dir="$DATA_DIR" \
  ${PROFILE_ARGS:+"$PROFILE_ARGS"} \
  --no-first-run \
  --use-fake-device-for-media-stream \
  --use-fake-ui-for-media-stream \
  --disable-features=AudioServiceSandbox \
  --use-file-for-fake-audio-capture="$WAV" \
  "$URL"
