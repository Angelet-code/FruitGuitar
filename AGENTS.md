# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Prototype Design Decisions

- Use Caveat Brush from Google Fonts as the game typography.
- On mobile, never allow page scrolling; the whole game must fit inside the viewport.
- On mobile, keep the fruit board as the dominant area at roughly 70% of the viewport.
- On mobile, place the front camera, waveform, and detected chord in one compact row at the bottom.
- Request the user-facing/front camera for gameplay camera access.
- Request camera/microphone permissions from the startup tuning popup before gameplay starts, not from the play button.
- Keep the startup tuning popup centered over the whole viewport with a 50% white backdrop; it is an overlay above the app, not part of the game grid.
- Do not show microphone/camera icons in the startup tuning popup.
- Do not show microphone/camera labels or status chips in the startup tuning popup.
- The startup tuner detects single guitar notes across all 12 semitones, including sharps; gameplay keeps using chord detection.
- Keep the play button as a game-start action labeled "Empezar".
- Use the watermelon fruit sprite as the favicon and iOS web app icon.
