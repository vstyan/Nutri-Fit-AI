#!/usr/bin/env bash
# Antigravity User Notification Helper
# Triggers native desktop toasts via notify-send and optional chimes via paplay.

MODE="${1:-stop}"
CUSTOM_TITLE="$2"
CUSTOM_BODY="$3"

# Check sound preference: mute if .agents/mute_sound exists or ~/.gemini/mute_sound exists
SOUND_ENABLED=true
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$WORKSPACE_ROOT/.agents/mute_sound" ] || [ -f "$HOME/.gemini/mute_sound" ]; then
  SOUND_ENABLED=false
fi

# If stdin has data (from Antigravity lifecycle hook)
STDIN_DATA=""
if [ ! -t 0 ]; then
  STDIN_DATA=$(cat 2>/dev/null || true)
fi

SOUND_COMPLETE="/usr/share/sounds/freedesktop/stereo/complete.oga"
SOUND_ATTENTION="/usr/share/sounds/freedesktop/stereo/window-attention.oga"

case "$MODE" in
  question|approval|attention)
    TITLE="${CUSTOM_TITLE:-Antigravity AI - Attention Needed}"
    BODY="${CUSTOM_BODY:-A question, decision, or approval is waiting for your input.}"
    notify-send -u critical -t 10000 -a "Antigravity AI" -i "dialog-warning" "$TITLE" "$BODY" 2>/dev/null || true
    if [ "$SOUND_ENABLED" = true ] && [ -f "$SOUND_ATTENTION" ]; then
      paplay "$SOUND_ATTENTION" 2>/dev/null &
    fi
    # If called as hook, return allow decision
    if [ -n "$STDIN_DATA" ]; then
      echo '{"decision": "allow"}'
    fi
    ;;

  custom)
    TITLE="${CUSTOM_TITLE:-Antigravity AI}"
    BODY="${CUSTOM_BODY:-Task update}"
    notify-send -u normal -t 6000 -a "Antigravity AI" -i "dialog-information" "$TITLE" "$BODY" 2>/dev/null || true
    if [ "$SOUND_ENABLED" = true ] && [ -f "$SOUND_COMPLETE" ]; then
      paplay "$SOUND_COMPLETE" 2>/dev/null &
    fi
    ;;

  stop|*)
    TITLE="${CUSTOM_TITLE:-Antigravity AI}"
    BODY="${CUSTOM_BODY:-Task completed! Ready for your review.}"
    notify-send -u normal -t 6000 -a "Antigravity AI" -i "dialog-information" "$TITLE" "$BODY" 2>/dev/null || true
    if [ "$SOUND_ENABLED" = true ] && [ -f "$SOUND_COMPLETE" ]; then
      paplay "$SOUND_COMPLETE" 2>/dev/null &
    fi
    # If called as hook, return empty JSON object
    if [ -n "$STDIN_DATA" ]; then
      echo "{}"
    fi
    ;;
esac
