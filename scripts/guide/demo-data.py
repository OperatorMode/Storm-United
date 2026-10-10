"""Fake demo data for guide screenshots (local .data only, never deployed)."""
import json, uuid
from datetime import datetime, timedelta, timezone

import os
p = os.path.join(os.path.dirname(__file__), "..", "..", ".data", "local-db.json")
d = json.load(open(p, encoding="utf8"))

TEAM, LEAGUE, COMP = "riverside-rockets", "riverside-league", "riverside-u10"

# Start clean (re-runnable).
d["teams"] = [t for t in d["teams"] if t["id"] != TEAM]
d["players"] = [x for x in d["players"] if x.get("team_id") != TEAM]
d["leagues"] = [l for l in d["leagues"] if l["id"] != LEAGUE]
d["competitions"] = [c for c in d["competitions"] if c["id"] != COMP]
d["competition_teams"] = [c for c in d["competition_teams"] if c.get("competition_id") != COMP]
d["fixtures"] = [f for f in d["fixtures"] if f.get("competition_id") != COMP]
for k in ("attendance", "announcements", "chat", "team_phones", "ballots"):
    d[k] = [x for x in d.get(k, []) if x.get("team_id") != TEAM and not str(x.get("game_id", "")).startswith("demo-")]

d["leagues"].append({"id": LEAGUE, "name": "Riverside Junior League", "short_name": "Riverside JL", "website": None,
                     "venue": "Riverside Park", "source": "manual", "timezone": "Australia/Perth", "created_by": "test-mgr"})
d["competitions"].append({"id": COMP, "league_id": LEAGUE, "name": "Under 10s", "season": "2026", "kind": "season", "source_key": None,
                          "points_win": 3, "points_draw": 1, "ladder_last_round": None, "finals_date": None, "finals_note": None})
clubs = ["Rockets", "Comets", "Falcons", "Hawks", "Lions", "Tigers"]
now = datetime.now(timezone.utc).isoformat()
for c in clubs:
    d["competition_teams"].append({"competition_id": COMP, "name": c, "created_at": now})

# Saturdays 8:30 am Perth (00:30 UTC). Next game: Sat 17 Oct.
def sat(day):
    return datetime(2026, 10, day, 0, 30, tzinfo=timezone.utc).isoformat().replace("+00:00", ".000Z")

games = [
    (1, 3, "Rockets", "Comets", 3, 1, "Riverside Park"), (1, 3, "Falcons", "Hawks", 2, 2, "Falcon Field"), (1, 3, "Lions", "Tigers", 0, 1, "Lions Oval"),
    (2, 10, "Hawks", "Rockets", 1, 2, "Hawks Reserve"), (2, 10, "Comets", "Lions", 2, 0, "Riverside Park"), (2, 10, "Tigers", "Falcons", 1, 3, "Tigers Park"),
    (3, 17, "Rockets", "Falcons", None, None, "Riverside Park"), (3, 17, "Lions", "Hawks", None, None, "Lions Oval"), (3, 17, "Comets", "Tigers", None, None, "Riverside Park"),
    (4, 24, "Tigers", "Rockets", None, None, "Tigers Park"), (4, 24, "Hawks", "Comets", None, None, "Hawks Reserve"), (4, 24, "Falcons", "Lions", None, None, "Falcon Field"),
]
for rnd, day, h, a, hs, as_, pitch in games:
    d["fixtures"].append({"id": f"demo-{rnd}-{h.lower()}", "competition_id": COMP, "status": "played" if hs is not None else "scheduled",
                          "round": rnd, "stage": None, "kickoff": sat(day), "pitch": pitch, "home": h, "away": a,
                          "home_score": hs, "away_score": as_})

d["teams"].append({"id": TEAM, "name": "Riverside Rockets", "league_name": "Rockets", "division": COMP, "competition_id": COMP,
                   "primary_color": "#1f3a93", "accent_color": "#ff7a1a", "logo_url": None, "admin_pin_hash": None,
                   "join_code_hash": None, "join_code_key": None, "meet_minutes": 20, "goalie_enabled": True})
names = ["Ava M", "Noah R", "Leo P", "Zoe K", "Max T", "Isla B", "Ethan W", "Ruby S", "Oliver H", "Chloe D"]
ids = [n.split()[0].lower() for n in names]
for i, n in enumerate(names):
    d["players"].append({"id": ids[i], "name": n, "sort": i, "active": True, "team_id": TEAM})

# Next game (round 3): most families have answered.
nxt = "demo-3-rockets"
for i, pid in enumerate(ids):
    if pid == "leo":
        continue  # left for the screenshot: "Can Leo make it?"
    status = "no" if pid == "ruby" else "maybe" if pid == "oliver" else None if pid == "chloe" else "yes"
    if status:
        d["attendance"].append({"team_id": TEAM, "game_id": nxt, "player_id": pid, "status": status,
                                "goalie": "1st" if pid == "max" else None, "updated_at": now})

# People in the team (each phone is one person) and their chat.
def ago(h):
    return (datetime.now(timezone.utc) - timedelta(hours=h)).isoformat()

people = {}
for kid, rel, nm in [("ava", "Mum", None), ("noah", "Dad", None), ("zoe", "Mum", "Kate"), ("max", "Grandparent", None), ("isla", "Dad", None)]:
    mid = str(uuid.uuid4())
    people[kid] = f"p:{mid}"
    d.setdefault("team_phones", []).append({"team_id": TEAM, "device_id": str(uuid.uuid4()), "children": kid, "is_self": False,
                                            "device": "iPhone", "last_seen": ago(2), "removed_children": "", "member_id": mid,
                                            "relation": rel, "name": nm, "created_at": ago(300)})
# The phone in the screenshots: Leo's Dad.
d["team_phones"].append({"team_id": TEAM, "device_id": "11111111-1111-4111-8111-111111111111", "children": "leo", "is_self": False,
                         "device": "iPhone", "last_seen": ago(1), "removed_children": "", "member_id": str(uuid.uuid4()),
                         "relation": "Dad", "name": None, "created_at": ago(200)})
chat = [
    (people["ava"], "Morning all! Does anyone have a spare pair of shin pads? Ava has grown out of hers.", 26),
    (people["noah"], "We have a spare pair, I'll bring them Saturday", 25.5),
    (people["ava"], "Legend, thank you!", 25.4),
    ("coach", "Great effort at training tonight everyone. Remember the orange shirts on Saturday.", 5),
    (people["zoe"], "Zoe is so excited for the Falcons game", 4),
    (people["max"], "Max says he'll go in goal for the first half", 3),
]
for author, body, h in chat:
    d["chat"].append({"id": str(uuid.uuid4()), "team_id": TEAM, "author_id": author, "body": body, "created_at": ago(h)})

d["announcements"].append({"id": str(uuid.uuid4()), "team_id": TEAM, "created_at": ago(30), "source": None,
                           "body": "Welcome to the Rockets team app! Please mark attendance for each game by Thursday night, so we know numbers. Shin pads every game."})
d["announcements"].append({"id": str(uuid.uuid4()), "team_id": TEAM, "created_at": ago(6), "source": None,
                           "body": "Saturday: we meet 20 minutes before kick-off at Riverside Park, pitch 2. Bring a water bottle."})

json.dump(d, open(p, "w", encoding="utf8"), indent=2)
print("demo ready")
