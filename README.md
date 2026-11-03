# OpenMenuBar website mirror

Public website assets and V54r1 4K/90fps product film only. GitHub Pages mirror at https://funning0423.github.io/openmenubar-site/

The native app source and account backend are not included. Account links use the existing original service.

V54r1 uses a one-second closed GOP with one reference frame and no B-frames to prevent hardware-decoder corruption during playback and seeking. Frame timing, motion, and audio are unchanged.

All devices default to progressive H.264 High Level 4.2 1080p60 playback, with faststart and native byte-range requests. The quality selector can switch to the original 4K90 film while preserving the current time. Playback starts synchronously from the user gesture, without fetching the entire file into a Blob. A bounded 10-second startup/stall watchdog tries the other public mirror; 4K decode/load errors also fall back to 1080p60. No third-party telemetry is sent. Optional video-audit=1 exposes bounded local playback diagnostics; ordinary visits do not load that script.
