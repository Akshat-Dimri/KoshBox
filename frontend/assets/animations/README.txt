Payment-received animation — drop your file(s) in this folder using these
exact names (device.js / index.html already look for them, no code changes
needed once the files exist):

  payment-received.mp4    (primary — H.264, no audio track)
  payment-received.webm   (optional — VP9, smaller, used if the browser
                            prefers it; mp4 works fine alone)
  payment-received.gif    (fallback only, used if neither video plays)

SPEC
  Aspect ratio : 3:4 portrait
  Resolution   : 720x960  (810x1080 if you want extra headroom for retina)
  Frame rate   : 24-30fps
  Duration     : ~2-3s recommended (not a hard limit — the overlay now
                 reads the video's actual duration and keeps the amount/
                 label text on screen for exactly that long, so a longer
                 clip just plays out in full)
  Audio        : none — the video is muted; the payment sound already
                 plays separately via audio-engine.js

WHY 3:4
  The on-screen device screen isn't a fixed size — it scales with the
  viewport between roughly 176x180 and 316x460 CSS px, so the live aspect
  ratio actually ranges from ~1:1 (small) to ~2:3 (large). 3:4 sits in the
  middle of that range and is rendered with object-fit: cover, so it always
  fills the screen edge-to-edge with only mild cropping at the extremes.

SAFE AREA
  Because of that cover-crop, keep the important motion (checkmark, logo,
  etc.) centered in the middle ~70% of the frame — content near the left/
  right edges is the first to get cropped on the more square layouts.

FALLBACK BEHAVIOR
  If no file is present at all, the overlay silently uses the built-in
  SVG checkmark tick animation — nothing breaks, nothing needs a code
  change either way.
