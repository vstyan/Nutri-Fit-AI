# Project Guidelines & Agent Instructions

## User Notifications
- **Desktop Toast & Audio Chime**: The user often works on other tasks while the assistant is running.
- **Completion & Attention**: Whenever a user-requested task finishes or when user approval/input is needed, notify the user via a native desktop toast (`notify-send`) and sound chime (`paplay`).
- **Proactive Execution**: Do not rely solely on passive lifecycle hooks. Proactively invoke `./scripts/notify_user.sh question` whenever asking questions or awaiting user approval/decisions, and `./scripts/notify_user.sh stop` whenever finishing a major task or milestone.
- **Mute Toggle**: If the user asks to mute or disable the audio chime, create `.agents/mute_sound` (or remove it to unmute).
