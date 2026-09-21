// Persistent, serverless-safe session store backed by a Supabase (PostgreSQL)
// `sessions` table.
//
// Why: this app runs on Vercel as a serverless function. The default
// express-session MemoryStore (and memorystore) keep session data in the RAM of
// a single process. Serverless invocations spin up/cold-start on demand, so the
// in-memory sessions vanish — a returning user's cookie references a session id
// that no longer exists, so `req.session.userId` is undefined and they get
// bounced back to /login (or hit errors) even though they just signed in.
//
// Storing sessions in the database means any warm or cold instance can resolve
// the session from the shared cookie id, so logins persist reliably across
// serverless invocations and redeploys.

const session = require("express-session");

class SupabaseSessionStore extends session.Store {
  constructor({ client, tableName = "sessions", ttlMs = 1000 * 60 * 60 * 24 * 7 } = {}) {
    super();
    if (!client) throw new Error("SupabaseSessionStore requires a Supabase client (service role).");
    this.db = client;
    this.table = tableName;
    this.ttlMs = ttlMs;
  }

  // Helper: express-session passes a `sess.cookie` with either `expires` (Date/ISO
  // string) or `maxAge` (ms from now). Fall back to the store's default TTL.
  _expiryFromSession(sess) {
    const cookie = sess && sess.cookie;
    if (cookie && cookie.expires) {
      const d = new Date(cookie.expires);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (cookie && cookie.maxAge) {
      return new Date(Date.now() + Number(cookie.maxAge));
    }
    return new Date(Date.now() + this.ttlMs);
  }

  get(sid, callback) {
    this.db
      .from(this.table)
      .select("sess")
      .eq("sid", sid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return callback(error);
        if (!data) return callback(null, null);
        // Treat an expired row as "no session" and clean it up.
        const sess = data.sess;
        const expiry = this._expiryFromSession(sess);
        if (expiry && expiry.getTime() < Date.now()) {
          this.destroy(sid, () => {});
          return callback(null, null);
        }
        callback(null, sess);
      })
      .catch((e) => callback(e));
  }

  set(sid, sess, callback) {
    const expiry = this._expiryFromSession(sess);
    this.db
      .from(this.table)
      .upsert(
        { sid, sess, expire: expiry.toISOString() },
        { onConflict: "sid" }
      )
      .then(({ error }) => callback && callback(error || null))
      .catch((e) => callback && callback(e));
  }

  touch(sid, sess, callback) {
    const expiry = this._expiryFromSession(sess);
    this.db
      .from(this.table)
      .update({ expire: expiry.toISOString() })
      .eq("sid", sid)
      .then(({ error }) => callback && callback(error || null))
      .catch((e) => callback && callback(e));
  }

  destroy(sid, callback) {
    this.db
      .from(this.table)
      .delete()
      .eq("sid", sid)
      .then(({ error }) => callback && callback(error || null))
      .catch((e) => callback && callback(e));
  }
}

module.exports = { SupabaseSessionStore };
