// LOCAL-DEV FALLBACK ONLY. In production (Vercel), comments.js reads
// /api/config instead — the Supabase URL/anon key live in Vercel env vars
// via the Supabase integration, not here. This file only matters if you're
// previewing a page with a plain static server (python3 -m http.server)
// that has no /api route to hit. Fill in your own project's values if you
// want comments to work in that local-only scenario; leave as placeholders
// otherwise — the widget just shows "not wired up yet" and the page itself
// is unaffected either way. deckId is set per-page via window.COMMENTS_DECK_ID
// inline before this script loads, not here.
window.SUPABASE_COMMENTS_CONFIG = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  anonKey: 'YOUR-ANON-PUBLIC-KEY',
};
