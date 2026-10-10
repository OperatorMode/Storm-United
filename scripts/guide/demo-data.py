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
old = [c["id"] for c in d.get("conversations", []) if c["team_id"] == TEAM]
d["conversations"] = [c for c in d.get("conversations", []) if c["team_id"] != TEAM]
d["conversation_members"] = [m for m in d.get("conversation_members", []) if m["conversation_id"] not in old]
d["direct_messages"] = [m for m in d.get("direct_messages", []) if m["conversation_id"] not in old]
for k in ("training", "team_duties", "duty_signups", "team_managers"):
    d[k] = [x for x in d.get(k, []) if x.get("team_id") != TEAM]
d["managers"] = [m for m in d.get("managers", []) if m["id"] != "demo-coach"]
for k in ("attendance", "announcements", "chat", "team_phones", "ballots"):
    d[k] = [x for x in d.get(k, []) if x.get("team_id") != TEAM and not str(x.get("game_id", "")).startswith("demo-")]

# Imported from the league's own (made-up) website, and verified as official.
d["leagues"].append({"id": LEAGUE, "name": "Riverside Junior League", "short_name": "Riverside JL", "website": "https://riversidejl.example",
                     "venue": "Riverside Park", "source": "manual", "timezone": "Australia/Perth", "created_by": "demo-coach",
                     "verified_at": "2026-10-01T02:00:00.000Z", "verified_by": "secretary@riversidejl.example"})
d["competitions"].append({"id": COMP, "league_id": LEAGUE, "name": "Under 10s", "season": "2026", "kind": "season", "source_key": None,
                          "points_win": 3, "points_draw": 1, "ladder_last_round": None, "finals_date": None, "finals_note": None,
                          "feed_type": "web", "feed_url": "https://riversidejl.example/fixtures/under-10s",
                          "feed_synced_at": (datetime.now(timezone.utc) - timedelta(minutes=40)).isoformat(), "feed_error": None,
                          "ladder_table": {"columns": ["P", "W", "D", "L", "GD", "Pts"], "source": "riversidejl.example",
                                           "syncedAt": (datetime.now(timezone.utc) - timedelta(minutes=40)).isoformat(),
                                           "rows": [{"team": t, "values": v} for t, v in [
                                               ("Rockets", ["2", "2", "0", "0", "+3", "6"]), ("Falcons", ["2", "1", "1", "0", "+2", "4"]),
                                               ("Comets", ["2", "1", "0", "1", "0", "3"]), ("Tigers", ["2", "1", "0", "1", "-1", "3"]),
                                               ("Hawks", ["2", "0", "1", "1", "-1", "1"]), ("Lions", ["2", "0", "0", "2", "-3", "0"])]]}})
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
    device = "44444444-4444-4444-8444-444444444444" if kid == "ava" else str(uuid.uuid4())  # Ava's Mum: fixed, for screenshots
    d.setdefault("team_phones", []).append({"team_id": TEAM, "device_id": device, "children": kid, "is_self": False,
                                            "device": "iPhone", "last_seen": ago(2), "removed_children": "", "member_id": mid,
                                            "relation": rel, "name": nm, "created_at": ago(300)})
# A new phone waiting for Ava's family to let it in.
d["team_phones"].append({"team_id": TEAM, "device_id": str(uuid.uuid4()), "children": "ava", "is_self": False, "device": "Android",
                         "last_seen": ago(0.2), "removed_children": "", "member_id": str(uuid.uuid4()), "relation": "Dad", "name": "Sam",
                         "created_at": ago(0.2), "pending": "ava"})

# The phone in the screenshots: Leo's Dad.
ME = "33333333-3333-4333-8333-333333333333"
d["team_phones"].append({"team_id": TEAM, "device_id": "11111111-1111-4111-8111-111111111111", "children": "leo", "is_self": False,
                         "device": "iPhone", "last_seen": ago(1), "removed_children": "", "member_id": ME,
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

welcome, latest = str(uuid.uuid4()), str(uuid.uuid4())
d["announcements"].append({"id": welcome, "team_id": TEAM, "created_at": ago(30), "source": None,
                           "body": "Welcome to the Rockets team app! Please mark attendance for each game by Thursday night, so we know numbers. Shin pads every game."})
d["announcements"].append({"id": latest, "team_id": TEAM, "created_at": ago(6), "source": None,
                           "body": "Saturday: we meet 20 minutes before kick-off at Riverside Park, pitch 2. Bring a water bottle."})

# Private messages for Leo's Dad: one-to-one with Noah's Dad, and a carpool group.
me = f"p:{ME}"
def conversation(name, members, msgs, read_all=False):
    cid = str(uuid.uuid4())
    d.setdefault("conversations", []).append({"id": cid, "team_id": TEAM, "name": name, "is_group": name is not None, "created_by": members[0],
                                              "created_at": ago(80), "last_message_at": ago(msgs[-1][2])})
    for m in members:
        d.setdefault("conversation_members", []).append({"conversation_id": cid, "member": m, "joined_at": ago(80), "left_at": None,
                                                         "last_read_at": ago(0 if read_all else msgs[-1][2] + 0.5) if m == me else None})
    for author, body, h in msgs:
        d.setdefault("direct_messages", []).append({"id": str(uuid.uuid4()), "conversation_id": cid, "author": author, "body": body,
                                                    "kind": "text", "removed": False, "created_at": ago(h)})
conversation("Saturday carpool", [people["ava"], me, people["zoe"]], [
    (people["ava"], "Who can drive to Riverside Park on Saturday?", 9),
    (me, "I can take two kids", 8.5),
    (people["zoe"], "Zoe can come with you then, thanks!", 1.5),
])
conversation(None, [me, people["noah"]], [
    (me, "Thanks for the shin pads!", 25),
    (people["noah"], "No worries, see you Saturday", 24.5),
], read_all=True)
conversation(None, ["coach", me], [
    ("coach", "Could Leo try in defence this week?", 30),
    (me, "Sounds good, he'll be keen", 29),
], read_all=True)

# Leagues: the coach runs Riverside (official); Eastside was imported by someone else and isn't claimed yet.
d["league_admins"] = [x for x in d.get("league_admins", []) if x["league_id"] not in (LEAGUE, "eastside-league")]
d["league_admins"].append({"league_id": LEAGUE, "manager_id": "demo-coach", "created_at": ago(500)})
d["league_admins"].append({"league_id": "eastside-league", "manager_id": "demo-importer", "created_at": ago(50)})
d["managers"] = [m for m in d["managers"] if m["id"] != "demo-importer"]
d["managers"].append({"id": "demo-importer", "email": "importer@example.test", "name": None, "created_at": ago(60)})
d["league_messages"] = [m for m in d.get("league_messages", []) if m["league_id"] != LEAGUE]
d["league_messages"].append({"id": str(uuid.uuid4()), "league_id": LEAGUE, "competition_id": None, "audience": "all", "teams": 1,
                             "body": "Round 3 is on as planned. Lions Oval pitches are closed for resurfacing, so the Lions v Hawks game moves to Riverside Park, pitch 3.",
                             "created_at": ago(28)})
EAST, EASTC = "eastside-league", "eastside-u11"
d["leagues"] = [l for l in d["leagues"] if l["id"] != EAST]
d["competitions"] = [c for c in d["competitions"] if c["id"] != EASTC]
d["competition_teams"] = [c for c in d["competition_teams"] if c.get("competition_id") != EASTC]
d["fixtures"] = [f for f in d["fixtures"] if f.get("competition_id") != EASTC]
d["leagues"].append({"id": EAST, "name": "Eastside Junior League", "short_name": "Eastside JL", "website": "https://eastsidejl.example",
                     "venue": "Eastside Reserve", "source": "manual", "timezone": "Australia/Perth", "created_by": "demo-importer"})
d["competitions"].append({"id": EASTC, "league_id": EAST, "name": "Under 11s", "season": "2026", "kind": "season", "source_key": None,
                          "points_win": 3, "points_draw": 1, "ladder_last_round": None, "finals_date": None, "finals_note": None,
                          "feed_type": "web", "feed_url": "https://eastsidejl.example/draw/under-11s",
                          "feed_synced_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(), "feed_error": None})
for c in ["Sharks", "Dolphins", "Stingrays", "Marlins"]:
    d["competition_teams"].append({"competition_id": EASTC, "name": c, "created_at": now})
for rnd, day, h, a in [(1, 17, "Sharks", "Dolphins"), (1, 17, "Stingrays", "Marlins"), (2, 24, "Dolphins", "Stingrays"), (2, 24, "Marlins", "Sharks")]:
    d["fixtures"].append({"id": f"demo-east-{rnd}-{h.lower()}", "competition_id": EASTC, "status": "scheduled", "round": rnd, "stage": None,
                          "kickoff": sat(day), "pitch": "Eastside Reserve", "home": h, "away": a, "home_score": None, "away_score": None})

# The coach: signed in as coach@example.test, owner of the team.
d["managers"].append({"id": "demo-coach", "email": "coach@example.test", "name": None, "created_at": ago(500)})
d["team_managers"].append({"team_id": TEAM, "manager_id": "demo-coach", "role": "owner", "created_at": ago(500)})

# Training: Tuesdays and Thursdays 5:30 pm Perth (09:30 UTC) for the next few weeks.
for series, weekday in (("demo-tue", 1), ("demo-thu", 3)):
    day = datetime(2026, 10, 5, 9, 30, tzinfo=timezone.utc)
    while day.weekday() != weekday:
        day += timedelta(days=1)
    for w in range(6):
        t = day + timedelta(weeks=w)
        d.setdefault("training", []).append({"id": f"{series}-{w}", "team_id": TEAM, "starts_at": t.isoformat().replace("+00:00", ".000Z"),
                                             "minutes": 60, "location": "Riverside Park, pitch 2", "note": None, "cancelled": False, "series_id": series})

# Duty roster for match days.
for i, name in enumerate(["Oranges", "First aid kit", "Goal nets"]):
    d.setdefault("team_duties", []).append({"team_id": TEAM, "name": name, "sort": i})
for duty, kid in (("Oranges", "ava"), ("Goal nets", "noah")):
    d.setdefault("duty_signups", []).append({"team_id": TEAM, "game_id": nxt, "duty": duty, "player_id": kid, "created_at": ago(20)})

# Families who tapped Got it (not Leo's: his Dad is the phone in the screenshots).
d["acks"] = [x for x in d.get("acks", []) if x["announcement_id"] not in (welcome, latest) and not x.get("demo")]
for aid, kids in ((welcome, ["ava", "noah", "zoe", "max", "isla", "ethan", "ruby", "oliver"]), (latest, ["ava", "noah", "zoe", "max", "isla", "ruby", "oliver"])):
    for kid in kids:
        d["acks"].append({"announcement_id": aid, "player_id": kid, "created_at": ago(4), "demo": True})

json.dump(d, open(p, "w", encoding="utf8"), indent=2)
print("demo ready")
