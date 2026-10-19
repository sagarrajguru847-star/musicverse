# MusicVerse

MusicVerse is a responsive React + TypeScript music workspace with an immersive Three.js scene, scroll-linked GSAP depth animation, local playlists, a music catalog browser, and a persistent player.

## Start locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:8000`. The web app runs on port `8000`; its Express API runs on port `8787`, and Vite proxies `/api` requests to it. Port `8000` must be available.

Playlists and favorites are stored in this browser's `localStorage`. Audio files you import are stored in IndexedDB and are not uploaded. Clearing the browser's site storage removes those local items.

## Play YouTube videos in MusicVerse

Paste a YouTube video link in the **Play from YouTube** field. MusicVerse loads YouTube's official IFrame Player API, shows the video in a persistent player dock, and syncs its title, channel, duration, playback position, play/pause, seek, and volume with the MusicVerse player. The embed has to remain visible while it plays.

You do not need a YouTube API key to play a video by link. MusicVerse cannot discover/search YouTube by song title without a separate YouTube Data API integration, and browser security does not allow a page to read what is playing in a different YouTube tab. Play the video inside MusicVerse for its now-playing state to sync here. Some videos disallow embedding, have been removed, or are region/account restricted; the app reports those playback failures.

## Import audio you own

Use **Import audio** to add MP3, M4A, AAC, WAV, OGG, or other browser-supported files. MusicVerse stores the blobs in this browser's IndexedDB and plays them through its persistent player. The files are not uploaded to the MusicVerse server.

## Optional live Jamendo catalog

Jamendo provides a catalog of independent tracks with stream URLs and license details. To enable it:

1. Create an app at the [Jamendo Developer Portal](https://devportal.jamendo.com/).
2. Copy `.env.example` to `.env` and set `JAMENDO_CLIENT_ID` to your app's client ID.
3. Restart the API server.

Keep artist/source and license links visible. Jamendo's published API terms specify non-commercial use; contact Jamendo before monetizing or using its music commercially. Track-specific Creative Commons licenses may add conditions. Playlist changes remain local to this browser.

## What needs credentials or a subscription

| Feature | Requirements |
| --- | --- |
| Local playlists, favorites, and imported audio | No credentials or subscription; saved in this browser |
| Play a YouTube video from its link | Internet access and a video that allows embedding; no MusicVerse API key or subscription |
| Search Jamendo's live catalog | Optional Jamendo developer client ID |

## Commands

```bash
npm run dev       # React app and local API
npm run check     # Type-check the browser app and API
npm run build     # Production assets and API output
npm start         # Serve the built app and API on PORT (default 8787)
```

The immersive hero uses Three.js for a rotating record, floating sleeve artwork, a pulsing waveform, and a four-phase spatial scene. GSAP ScrollTrigger ties camera depth and orbital motion to the long hero scroll; dashboard sections and album/track cards enter with depth and rotation. Reduced-motion preferences are honored. The WebGL scene is decorative and does not contain audio.

## References

- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters)
- [Jamendo tracks API](https://developer.jamendo.com/v3.0/tracks)
- [Jamendo API terms of use](https://devportal.jamendo.com/api_terms_of_use)
