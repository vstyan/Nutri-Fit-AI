#!/usr/bin/env bash
# Antigravity User Notification Helper
# Triggers native desktop toasts via notify-send and audio chimes via PulseAudio / ALSA.
#
# POLICY:
# - Toasts & chimes ONLY when waiting for explicit user input, approval, or decision.
# - Do NOT notify on completion/stop.

# Ensure desktop session bus and display are available even in stripped subshells
export DISPLAY="${DISPLAY:-:0}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/$(id -u)/bus}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

MODE="${1:-stop}"
CUSTOM_TITLE="$2"
CUSTOM_BODY="$3"

# Determine script & workspace paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GRANDPARENT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check sound preference: mute if .agents/mute_sound exists or ~/.gemini/mute_sound exists
SOUND_ENABLED=true
if [ -f "$PARENT_DIR/.agents/mute_sound" ] || \
   [ -f "$PARENT_DIR/mute_sound" ] || \
   [ -f "$GRANDPARENT_DIR/.agents/mute_sound" ] || \
   [ -f "$GRANDPARENT_DIR/mute_sound" ] || \
   [ -f "$HOME/.gemini/mute_sound" ]; then
  SOUND_ENABLED=false
fi

# Detect if stdin has hook data
STDIN_DATA=""
if [ ! -t 0 ]; then
  STDIN_DATA=$(cat 2>/dev/null || true)
fi

# Use clear, audible alerts
SOUND_ATTENTION="/usr/share/sounds/mate/default/alerts/glass.ogg"
[ ! -f "$SOUND_ATTENTION" ] && SOUND_ATTENTION="/usr/share/sounds/freedesktop/stereo/bell.oga"
[ ! -f "$SOUND_ATTENTION" ] && SOUND_ATTENTION="/usr/share/sounds/freedesktop/stereo/dialog-warning.oga"

play_chime() {
  local sound_file="$1"
  if [ "$SOUND_ENABLED" = true ] && [ -n "$sound_file" ] && [ -f "$sound_file" ]; then
    # Unmute sink if muted
    pactl set-sink-mute @DEFAULT_SINK@ false 2>/dev/null || true
    # Play synchronously so subshell termination does not kill the audio process
    paplay "$sound_file" 2>/dev/null || canberra-gtk-play -f "$sound_file" 2>/dev/null || aplay "$sound_file" 2>/dev/null || true
  fi
}

case "$MODE" in
  question|approval|attention)
    TITLE="${CUSTOM_TITLE:-Antigravity AI — Input Needed}"
    BODY="${CUSTOM_BODY:-Your input or approval is needed to proceed.}"
    notify-send -u critical -t 15000 -a "Antigravity AI" -i "dialog-warning" "$TITLE" "$BODY" 2>/dev/null || true
    play_chime "$SOUND_ATTENTION"
    if [ -n "$STDIN_DATA" ]; then
      echo '{"decision": "allow"}'
    fi
    ;;

  custom)
    TITLE="${CUSTOM_TITLE:-Antigravity AI}"
    BODY="${CUSTOM_BODY:-Task update}"
    notify-send -u normal -t 6000 -a "Antigravity AI" -i "dialog-information" "$TITLE" "$BODY" 2>/dev/null || true
    play_chime "$SOUND_ATTENTION"
    if [ -n "$STDIN_DATA" ]; then
      echo '{"decision": "allow"}'
    fi
    ;;

  stop|*)
    # Do NOT notify on completion/stop per user rule in GEMINI.md
    if [ -n "$STDIN_DATA" ]; then
      echo '{"decision": "allow"}'
    fi
    ;;
esac
