# Project Guidelines & Agent Instructions

## User Notifications
- **Desktop Toast & Audio Chime**: The user often works on other tasks while the assistant is running.
- **Completion & Attention**: Whenever a user-requested task finishes or when user approval/input is needed, notify the user via a native desktop toast (`notify-send`) and sound chime (`paplay`).
- **Mute Toggle**: If the user asks to mute or disable the audio chime, create `.agents/mute_sound` (or remove it to unmute).
