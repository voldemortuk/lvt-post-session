// Serverless function (zero-config on Vercel — anything under /api just
// works, no build step, no framework needed). Hands the browser only the
// two PUBLIC values it needs for comments; the service-role key and DB URL
// that the Supabase integration also injects stay server-side and are
// never read here.
//
// Shared by every page in this repo that loads comments.js — each page
// passes its own deck id via ?deck=, so one function backs all of them and
// rows stay scoped by deck_id in the same Supabase table.
module.exports = function handler(req, res) {
  var url = process.env.SUPABASE_URL;
  var anonKey = process.env.SUPABASE_ANON_KEY;

  res.setHeader('Cache-Control', 'no-store');

  if (!url || !anonKey) {
    res.status(500).json({ error: 'Supabase env vars not found on this deployment' });
    return;
  }

  var deck = (req.query && req.query.deck) || 'page';

  res.status(200).json({
    url: url,
    anonKey: anonKey,
    deckId: deck,
  });
};
