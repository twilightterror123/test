from flask import Flask, request, jsonify, render_template, redirect, session
from datetime import datetime, timedelta
from functools import wraps
import sqlite3
import secrets
import string
import hashlib
import os
import requests


app = Flask(__name__)

app.secret_key = os.getenv("FLASK_SECRET")

ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")
DISCORD_WEBHOOK = os.getenv("DISCORD_WEBHOOK")


if not ADMIN_USER or not ADMIN_PASS:
    raise Exception(
        "Missing ADMIN_USER or ADMIN_PASS environment variable"
    )


# =========================
# DATABASE
# =========================

conn = sqlite3.connect(
    "data.db",
    check_same_thread=False
)

c = conn.cursor()


c.executescript("""
CREATE TABLE IF NOT EXISTS keys (

    key TEXT PRIMARY KEY,

    type TEXT NOT NULL,

    price REAL DEFAULT 0,

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



# =========================
# SETTINGS
# =========================


PRICES = {

    "DAY": 0.00,

    "WEEK": 2.50,

    "MONTH": 3.50,

    "LIFE": 7.00

}


DURATION = {

    "DAY": timedelta(days=1),

    "WEEK": timedelta(days=7),

    "MONTH": timedelta(days=30),

    "LIFE": None

}



# =========================
# HELPERS
# =========================


def notify(msg):

    if not DISCORD_WEBHOOK:
        return

    try:

        requests.post(
            DISCORD_WEBHOOK,
            json={
                "content": msg
            },
            timeout=3
        )

    except:

        pass



def add_log(
    action,
    key="",
    device="",
    ip="",
    info=""
):

    c.execute(
        """
        INSERT INTO logs
        (
        time,
        action,
        key,
        device,
        ip,
        info
        )
        VALUES (?,?,?,?,?,?)
        """,
        (
            str(datetime.utcnow()),
            action,
            key,
            device,
            ip,
            info
        )
    )

    conn.commit()



def hash_hwid(hwid):

    return hashlib.sha256(
        hwid.encode()
    ).hexdigest()



def gen_key(prefix="AQUA"):

    chars = (
        string.ascii_uppercase
        +
        string.digits
    )

    return (
        prefix
        +
        "-"
        +
        "".join(
            secrets.choice(chars)
            for _ in range(16)
        )
    )



def login_req(func):

    @wraps(func)
    def wrapper(*args, **kwargs):

        if not session.get("auth"):

            return redirect("/login")

        return func(*args, **kwargs)

    return wrapper
    # =========================
# LOGIN
# =========================

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        user = request.form.get("user")
        password = request.form.get("pass")


        if user == ADMIN_USER and password == ADMIN_PASS:

            session["auth"] = True

            return redirect("/")


        return """
        <h2 style="color:#f85149;font-family:monospace">
        ACCESS DENIED
        </h2>
        <a href="/login">
        RETRY
        </a>
        """


    return """
<!DOCTYPE html>
<html>
<head>

<title>AQUA AUTH</title>

<style>

body{
background:#0b0f18;
color:white;
font-family:Arial;
height:100vh;
display:flex;
align-items:center;
justify-content:center;
}

.box{
background:#151a27;
border:1px solid #26304a;
padding:35px;
width:330px;
border-radius:12px;
}

h1{
text-align:center;
color:#00d4ff;
}

input{
width:100%;
padding:12px;
margin:8px 0;
background:#0b0f18;
border:1px solid #26304a;
border-radius:6px;
color:white;
}

button{
width:100%;
padding:12px;
background:#00d4ff;
border:0;
border-radius:6px;
color:white;
cursor:pointer;
}

</style>

</head>

<body>

<div class="box">

<h1>🔑 AQUA AUTH</h1>

<form method="post">

<input name="user" placeholder="USER">

<input name="pass" type="password" placeholder="PASS">

<button>
LOGIN
</button>

</form>

</div>

</body>

</html>
"""



@app.route("/logout")
def logout():

    session.clear()

    return redirect("/login")



# =========================
# DASHBOARD
# =========================

@app.route("/")
@login_req
def dashboard():


    c.execute(
        "SELECT COUNT(*) FROM keys"
    )

    total = c.fetchone()[0]


    c.execute(
        "SELECT COUNT(*) FROM keys WHERE used=1"
    )

    active = c.fetchone()[0]


    c.execute(
        "SELECT COUNT(*) FROM keys WHERE banned=1"
    )

    banned = c.fetchone()[0]


    c.execute(
        """
        SELECT *
        FROM keys
        ORDER BY created DESC
        LIMIT 500
        """
    )

    keys = c.fetchall()


    c.execute(
        """
        SELECT *
        FROM logs
        ORDER BY id DESC
        LIMIT 200
        """
    )

    logs = c.fetchall()



    return render_template(
        "dash.html",
        total=total,
        active=active,
        banned=banned,
        keys=keys,
        logs=logs
    )



# =========================
# ACTIVATE
# =========================

@app.route(
    "/api/activate",
    methods=["POST"]
)

def activate():

    data = request.json


    if not data:

        return jsonify({
            "ok":False,
            "err":"no_data"
        })


    key = data.get(
        "key",
        ""
    ).strip().upper()


    hwid = data.get(
        "hwid",
        data.get("device","")
    )


    ip = request.remote_addr

    hw = hash_hwid(hwid)



    c.execute(
        """
        SELECT
        key,
        type,
        used,
        device,
        expires,
        banned

        FROM keys

        WHERE key=?
        """,
        (key,)
    )


    row = c.fetchone()


    if not row:

        return jsonify({
            "ok":False,
            "err":"invalid"
        })


    k,t,used,device,expires,banned=row



    if banned:

        return jsonify({
            "ok":False,
            "err":"banned"
        })



    # FIRST USE

    if used == 0:


        now = datetime.utcnow()


        duration = DURATION[t]


        if duration:

            exp = now + duration

        else:

            exp = None



        c.execute(
            """
            UPDATE keys SET

            used=1,

            device=?,

            hwid=?,

            ip=?,

            created=?,

            expires=?,

            last_seen=?

            WHERE key=?

            """,
            (
                hw,
                hwid,
                ip,
                str(now),
                str(exp) if exp else None,
                str(now),
                key
            )
        )


        conn.commit()


        add_log(
            "activate",
            key,
            hwid,
            ip,
            t
        )


        notify(
            f"🔑 ACTIVATED\n{key}\n{t}\n{ip}"
        )


        return jsonify({

            "ok":True,

            "type":t,

            "expires":
            str(exp)
            if exp
            else None

        })



    # HARDWARE CHECK

    if device != hw:


        add_log(
            "wrong_hwid",
            key,
            hwid,
            ip,
            "locked"
        )


        return jsonify({

            "ok":False,

            "err":
            "hardware_locked"

        })
        # =========================
# CHECK KEY
# =========================

@app.route("/api/check", methods=["POST"])
def check():

    data = request.json

    if not data:
        return jsonify({
            "ok":False,
            "valid":False
        })


    hwid = data.get(
        "hwid",
        data.get("device","")
    )


    hw = hash_hwid(hwid)



    c.execute(
        """
        SELECT
        key,
        type,
        expires,
        banned

        FROM keys

        WHERE device=?

        AND used=1
        """,
        (hw,)
    )


    row = c.fetchone()


    if not row:

        return jsonify({
            "ok":False,
            "valid":False
        })


    key,t,expires,banned=row



    if banned:

        return jsonify({
            "ok":False,
            "valid":False,
            "err":"banned"
        })



    if expires:

        if datetime.utcnow() > datetime.fromisoformat(expires):

            return jsonify({
                "ok":False,
                "valid":False,
                "err":"expired"
            })



    return jsonify({

        "ok":True,

        "valid":True,

        "key":key,

        "type":t,

        "expires":expires

    })



# =========================
# GENERATE KEYS
# =========================

@app.route("/api/gen", methods=["POST"])
@login_req
def generate():

    data = request.json


    t = data.get(
        "type",
        "MONTH"
    ).upper()


    count = min(
        int(data.get("count",10)),
        500
    )


    prefix = data.get(
        "prefix",
        "AQUA"
    ).upper()



    if t not in PRICES:

        return jsonify({
            "ok":False,
            "err":"invalid_type"
        })



    result=[]


    for _ in range(count):

        key = gen_key(prefix)


        c.execute(
            """
            INSERT INTO keys
            (
            key,
            type,
            price
            )
            VALUES (?,?,?)
            """,
            (
                key,
                t,
                PRICES[t]
            )
        )


        result.append(key)



    conn.commit()


    add_log(
        "generate",
        f"{count}x{t}",
        "",
        request.remote_addr,
        prefix
    )



    notify(
        f"🔑 GENERATED {count} {t}"
    )


    return jsonify({

        "ok":True,

        "keys":result

    })



# =========================
# BAN KEY
# =========================

@app.route("/api/ban", methods=["POST"])
@login_req
def ban():

    data=request.json


    key=data.get(
        "key",
        ""
    ).upper()


    reason=data.get(
        "reason",
        "no reason"
    )



    c.execute(
        """
        UPDATE keys

        SET banned=1,
        note=?

        WHERE key=?

        """,
        (
            reason,
            key
        )
    )


    conn.commit()


    add_log(
        "ban",
        key,
        "",
        request.remote_addr,
        reason
    )


    return jsonify({
        "ok":True
    })



# =========================
# UNBAN
# =========================

@app.route("/api/unban", methods=["POST"])
@login_req
def unban():

    data=request.json


    key=data.get(
        "key",
        ""
    ).upper()



    c.execute(
        """
        UPDATE keys

        SET banned=0,
        note=NULL

        WHERE key=?

        """,
        (key,)
    )


    conn.commit()


    return jsonify({
        "ok":True
    })



# =========================
# RESET KEY
# =========================

@app.route("/api/reset", methods=["POST"])
@login_req
def reset():

    data=request.json

    key=data.get(
        "key",
        ""
    ).upper()



    c.execute(
        """
        UPDATE keys SET

        used=0,

        device=NULL,

        hwid=NULL,

        ip=NULL,

        created=NULL,

        expires=NULL,

        last_seen=NULL

        WHERE key=?

        """,
        (key,)
    )


    conn.commit()



    return jsonify({
        "ok":True
    })



# =========================
# DELETE KEY
# =========================

@app.route("/api/delete", methods=["POST"])
@login_req
def delete():

    data=request.json


    key=data.get(
        "key",
        ""
    ).upper()



    c.execute(
        "DELETE FROM keys WHERE key=?",
        (key,)
    )


    conn.commit()



    return jsonify({
        "ok":True
    })



# =========================
# LOGS
# =========================

@app.route("/api/logs")
@login_req
def logs():

    c.execute(
        """
        SELECT *
        FROM logs
        ORDER BY id DESC
        LIMIT 200
        """
    )


    rows=c.fetchall()


    return jsonify(rows)



# =========================
# STATS
# =========================

@app.route("/api/stats")
@login_req
def stats():


    c.execute(
        "SELECT COUNT(*) FROM keys"
    )

    total=c.fetchone()[0]


    c.execute(
        "SELECT COUNT(*) FROM keys WHERE used=1"
    )

    used=c.fetchone()[0]


    c.execute(
        "SELECT COUNT(*) FROM keys WHERE banned=1"
    )

    banned=c.fetchone()[0]



    return jsonify({

        "total":total,

        "used":used,

        "free":total-used,

        "banned":banned

    })



# =========================
# START
# =========================

if __name__ == "__main__":

    port=int(
        os.getenv(
            "PORT",
            10000
        )
    )


    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
