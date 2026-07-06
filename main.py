from flask import Flask, request, jsonify, render_template, redirect, session
from datetime import datetime, timedelta
import sqlite3
import secrets
import string
import hashlib
import os
import requests
from functools import wraps

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET", secrets.token_hex(32))

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin")
DISCORD_WEBHOOK = os.getenv("DISCORD_WEBHOOK")

conn = sqlite3.connect("data.db", check_same_thread=False)
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS keys (
    key TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    device TEXT,
    hwid TEXT,
    ip TEXT,
    created TEXT,
    expires TEXT,
    last_seen TEXT,
    banned INTEGER DEFAULT 0,
    note TEXT
);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT,
    action TEXT,
    key TEXT,
    device TEXT,
    ip TEXT,
    info TEXT
);
""")
conn.commit()

def notify(msg):
    if DISCORD_WEBHOOK:
        try:
            requests.post(DISCORD_WEBHOOK, json={"content": msg}, timeout=3)
        except:
            pass

def add_log(action, key="", device="", ip="", info=""):
    c.execute("INSERT INTO logs (time, action, key, device, ip, info) VALUES (?, ?, ?, ?, ?, ?)",
              (str(datetime.utcnow()), action, key, device, ip, info))
    conn.commit()

def gen_key(prefix="AQUA"):
    return f"{prefix}-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(16))

def get_expiry(t):
    return {
        "DAY": timedelta(days=1),
        "WEEK": timedelta(days=7),
        "MONTH": timedelta(days=30),
        "LIFE": None
    }.get(t)

def login_req(f):
    @wraps(f)
    def wrap(*a, **kw):
        if not session.get("auth"):
            return redirect("/login")
        return f(*a, **kw)
    return wrap

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        if request.form.get("user") == ADMIN_USER and request.form.get("pass") == ADMIN_PASS:
            session["auth"] = True
            return redirect("/")
        return "<h2 style='color:#f85149;font-family:monospace;'>ACCESS DENIED</h2><a href='/login' style='color:#58a6ff;'>RETRY</a>"
    
    return """<!DOCTYPE html><html><head><title>AQUA AUTH</title><style>
*{margin:0;padding:0}
body{background:#0a0c16;font-family:'Segoe UI',monospace;display:flex;justify-content:center;align-items:center;height:100vh}
.box{background:linear-gradient(145deg,#11152b,#181e3d);border:1px solid #1f2555;border-radius:14px;padding:40px;width:360px}
.logo{text-align:center;font-size:38px;margin-bottom:8px}
h1{color:#00d4ff;text-align:center;font-size:22px;letter-spacing:2px;margin-bottom:5px}
.sub{color:#4a5278;text-align:center;font-size:12px;margin-bottom:28px;text-transform:uppercase;letter-spacing:1px}
input{width:100%;padding:13px 15px;margin-bottom:14px;background:#0a0c16;border:1px solid #1f2555;border-radius:8px;color:#c0c8e0;font-size:14px;outline:none}
input:focus{border-color:#00d4ff;box-shadow:0 0 0 3px rgba(0,212,255,0.1)}
button{width:100%;padding:13px;background:linear-gradient(135deg,#00d4ff,#7b2ff7);border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:.3s}
button:hover{transform:translateY(-1px);box-shadow:0 6px 25px rgba(0,212,255,0.2)}
</style></head><body>
<div class='box'><div class='logo'>🔑</div><h1>AQUA AUTH</h1><div class='sub'>Admin Access</div>
<form method='post'><input type='text' name='user' placeholder='USER' autocomplete='off'><input type='password' name='pass' placeholder='PASS'><button>→ ENTER</button></form></div></body></html>"""

@app.route("/")
@login_req
def dashboard():
    c.execute("SELECT COUNT(*) FROM keys")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM keys WHERE used=1")
    used = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM keys WHERE banned=1")
    banned = c.fetchone()[0]
    c.execute("SELECT type,COUNT(*) FROM keys GROUP BY type")
    by_type = dict(c.fetchall())
    c.execute("SELECT * FROM keys ORDER BY used DESC,created DESC LIMIT 300")
    keys = c.fetchall()
    c.execute("SELECT * FROM logs ORDER BY id DESC LIMIT 100")
    logs = c.fetchall()
    return render_template("dash.html", total=total, used=used, banned=banned, by_type=by_type, keys=keys, logs=logs)

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

@app.route("/api/activate", methods=["POST"])
def api_activate():
    data = request.json
    if not data:
        return jsonify({"ok": False, "err": "no_data"})
    
    key = data.get("key", "").strip().upper()
    hwid = data.get("hwid", data.get("device", ""))
    ip = request.remote_addr

    c.execute("SELECT key,type,used,device,hwid,expires,banned FROM keys WHERE key=?", (key,))
    row = c.fetchone()
    
    if not row:
        return jsonify({"ok": False, "err": "invalid"})
    
    k, t, used, sdev, shwid, exp, banned = row
    
    if banned:
        add_log("banned_try", key, hwid, ip, "banned key")
        return jsonify({"ok": False, "err": "banned"})
    
    if exp:
        try:
            if datetime.utcnow() > datetime.fromisoformat(exp):
                add_log("expired_try", key, hwid, ip, "expired")
                return jsonify({"ok": False, "err": "expired"})
        except:
            pass
    
    if used == 0:
        now = datetime.utcnow()
        dur = get_expiry(t)
        exp = now + dur if dur else None
        
        c.execute("""UPDATE keys SET used=1,device=?,hwid=?,ip=?,created=?,expires=?,last_seen=?
                    WHERE key=?""", (hashlib.sha256(hwid.encode()).hexdigest(), hwid, ip, 
                                    str(now), str(exp) if exp else None, str(now), key))
        conn.commit()
        
        notify(f"🔑 ACTIVATED\nKey: `{key}`\nType: {t}\nIP: {ip}")
        add_log("activate", key, hwid, ip, f"first {t}")
        
        return jsonify({"ok": True, "type": t, "exp": str(exp) if exp else None})
    
    expected = hashlib.sha256(hwid.encode()).hexdigest()
    if sdev and sdev != expected:
        add_log("wrong_dev", key, hwid, ip, f"expected {sdev[:16]}...")
        return jsonify({"ok": False, "err": "locked"})
    
    c.execute("UPDATE keys SET last_seen=?,ip=? WHERE key=?", (str(datetime.utcnow()), ip, key))
    conn.commit()
    add_log("check", key, hwid, ip, "ok")
    
    return jsonify({"ok": True, "type": t, "exp": exp if exp else None})

@app.route("/api/check", methods=["POST"])
def api_check():
    data = request.json
    hwid = data.get("hwid", data.get("device", ""))
    ip = request.remote_addr
    
    dh = hashlib.sha256(hwid.encode()).hexdigest()
    
    c.execute("SELECT key,type,expires,banned FROM keys WHERE device=? AND used=1", (dh,))
    row = c.fetchone()
    
    if not row:
        return jsonify({"ok": False, "valid": False})
    
    key, t, exp, banned = row
    
    if banned:
        return jsonify({"ok": False, "valid": False, "err": "banned"})
    
    if exp:
        try:
            if datetime.utcnow() > datetime.fromisoformat(exp):
                return jsonify({"ok": False, "valid": False, "err": "expired"})
        except:
            pass
    
    return jsonify({"ok": True, "valid": True, "type": t, "key": key})

@app.route("/api/gen", methods=["POST"])
@login_req
def api_gen():
    data = request.json
    t = data.get("type", "MONTH").upper()
    count = min(int(data.get("count", 10)), 500)
    prefix = data.get("prefix", "AQUA").upper()
    
    if t not in ["DAY","WEEK","MONTH","LIFE"]:
        return jsonify({"err": "bad type"}), 400
    
    keys = []
    for _ in range(count):
        k = gen_key(prefix)
        c.execute("INSERT OR IGNORE INTO keys (key,type) VALUES (?,?)", (k, t))
        keys.append(k)
    conn.commit()
    
    add_log("gen", f"{count}x{t}", "", request.remote_addr, prefix)
    notify(f"🔑 **{count} KEYS GEN**\nType: {t}\nPrefix: {prefix}")
    
    return jsonify({"ok": True, "count": len(keys), "keys": keys})

@app.route("/api/ban", methods=["POST"])
@login_req
def api_ban():
    data = request.json
    key = data.get("key", "").strip().upper()
    reason = data.get("reason", "no reason")
    
    c.execute("UPDATE keys SET banned=1,note=? WHERE key=?", (reason, key))
    conn.commit()
    
    add_log("ban", key, "", request.remote_addr, reason)
    notify(f"⛔ **BANNED**\nKey: `{key}`\nReason: {reason}")
    
    return jsonify({"ok": True})

@app.route("/api/unban", methods=["POST"])
@login_req
def api_unban():
    data = request.json
    key = data.get("key", "").strip().upper()
    
    c.execute("UPDATE keys SET banned=0,note=NULL WHERE key=?", (key,))
    conn.commit()
    add_log("unban", key, "", request.remote_addr, "")
    
    return jsonify({"ok": True})

@app.route("/api/del", methods=["POST"])
@login_req
def api_del():
    data = request.json
    key = data.get("key", "").strip().upper()
    
    c.execute("DELETE FROM keys WHERE key=?", (key,))
    conn.commit()
    add_log("delete", key, "", request.remote_addr, "")
    
    return jsonify({"ok": True})

@app.route("/api/reset", methods=["POST"])
@login_req
def api_reset():
    data = request.json
    key = data.get("key", "").strip().upper()
    
    c.execute("""UPDATE keys SET used=0,device=NULL,hwid=NULL,created=NULL,
                expires=NULL,last_seen=NULL,banned=0,note=NULL WHERE key=?""", (key,))
    conn.commit()
    add_log("reset", key, "", request.remote_addr, "")
    
    return jsonify({"ok": True})

@app.route("/api/ban_dev", methods=["POST"])
@login_req
def api_ban_dev():
    data = request.json
    hwid = data.get("hwid", "")
    reason = data.get("reason", "violation")
    
    if not hwid:
        return jsonify({"err": "no hwid"}), 400
    
    dh = hashlib.sha256(hwid.encode()).hexdigest()
    c.execute("UPDATE keys SET banned=1,note=? WHERE device=?", (reason, dh))
    conn.commit()
    
    add_log("ban_dev", "", hwid, request.remote_addr, reason)
    notify(f"⛔ **DEVICE BANNED**\nHWID: `{hwid[:16]}...`\nReason: {reason}")
    
    return jsonify({"ok": True})

@app.route("/api/logs")
@login_req
def api_logs():
    c.execute("SELECT * FROM logs ORDER BY id DESC LIMIT 200")
    logs = c.fetchall()
    return jsonify([{"id":l[0],"time":l[1],"action":l[2],"key":l[3],"device":l[4],"ip":l[5],"info":l[6]} for l in logs])

@app.route("/api/stats")
@login_req
def api_stats():
    c.execute("SELECT COUNT(*) FROM keys")
    t = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM keys WHERE used=1")
    u = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM keys WHERE banned=1")
    b = c.fetchone()[0]
    c.execute("SELECT type,COUNT(*) FROM keys GROUP BY type")
    bt = dict(c.fetchall())
    c.execute("SELECT type,COUNT(*) FROM keys WHERE used=1 GROUP BY type")
    ut = dict(c.fetchall())
    return jsonify({"total":t,"used":u,"banned":b,"free":t-u,"by_type":bt,"used_by_type":ut})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
