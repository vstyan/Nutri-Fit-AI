# Project Guidelines & Agent Instructions

## User Notifications
- **Desktop Toast & Audio Chime Policy**: Send a desktop toast (`notify-send`) and sound chime (`paplay`) **ONLY** when you need the user's explicit input, approval, or decision and you are actively waiting on the user.
- **Do NOT notify on completion/stop**: Never trigger toasts or chimes simply because a task or milestone has finished.
- **Proactive Execution**: Proactively invoke `./scripts/notify_user.sh question` ONLY when asking questions or blocked waiting on user decisions.
- **Mute Toggle**: If the user asks to mute or disable the audio chime, create `.agents/mute_sound` (or remove it to unmute).
