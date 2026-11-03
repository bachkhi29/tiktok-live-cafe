// Opt-in real synthesis: this test needs Internet and never connects to TikTok.
process.env.CAFE_TEST_LIVE_TTS = '1';
await import('./verify-ui.mjs');
