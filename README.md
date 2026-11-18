# OpenMenuBar website mirror

Public website assets and 4K/90fps product film only. GitHub Pages mirror at https://funning0423.github.io/openmenubar-site/

The native app source and account backend are not included. Account links use the existing original service.

The 4K encode uses a one-second closed GOP with one reference frame and no B-frames to prevent hardware-decoder corruption during playback and seeking. Frame timing, motion, and audio are unchanged.

Both progressive encodes come from the 4K90 master and support faststart and native byte-range requests. The player selects 4K90 when its rendered width exceeds 1920 physical pixels. Smaller players, data-saving connections and slow connections default to 1080p60. The quality selector preserves the current time when switching between the two. Playback starts synchronously from the user gesture, without fetching the entire file into a Blob. A bounded 10-second startup/stall watchdog tries the other public mirror; 4K decode/load errors also fall back to 1080p60. No third-party telemetry is sent. Optional video-audit=1 exposes bounded local playback diagnostics; ordinary visits do not load that script.
