# -*- coding: utf-8 -*-
"""生成网站 data.json：日报(全部历史) + VIX恐慌指数(1年) + IV30历史。
用法: ~/workspace/venv-options/bin/python update_site.py
失败时保留旧 VIX 数据，不清空。"""
import csv, html, json, os, re, sys
from datetime import datetime
from zoneinfo import ZoneInfo

BASE = os.path.dirname(os.path.abspath(__file__))
REPORTS = os.path.expanduser("~/workspace/options-daily/reports_us")
IVCSV = os.path.expanduser("~/workspace/options-daily/data_us/iv30_hist.csv")
OUT = os.path.join(BASE, "data.json")

def md2html(md):
    out, in_list = [], False
    for line in md.splitlines():
        s = line.strip()
        if s.startswith("- "):
            if not in_list: out.append("<ul>"); in_list = True
            out.append(f"<li>{inline(s[2:])}</li>"); continue
        if in_list: out.append("</ul>"); in_list = False
        if s.startswith("# "): out.append(f"<h1>{inline(s[2:])}</h1>")
        elif s.startswith("## "): out.append(f"<h2>{inline(s[3:])}</h2>")
        elif s.startswith("#"): out.append(f"<h2>{inline(s.lstrip('# '))}</h2>")
        elif s: out.append(f"<p>{inline(s)}</p>")
    if in_list: out.append("</ul>")
    return "\n".join(out)

def inline(t):
    t = html.escape(t)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)

def load_reports():
    reps = []
    for fn in sorted(os.listdir(REPORTS), reverse=True):
        if re.match(r"\d{4}-\d{2}-\d{2}\.md$", fn):
            with open(os.path.join(REPORTS, fn), encoding="utf-8") as f:
                reps.append({"date": fn[:-3], "html": md2html(f.read())})
    return reps

def load_iv30():
    series = {}
    if os.path.exists(IVCSV):
        with open(IVCSV, encoding="utf-8") as f:
            for row in csv.reader(f):
                if len(row) == 3:
                    try: series.setdefault(row[1], []).append({"d": row[0], "v": round(float(row[2]), 2)})
                    except ValueError: pass
    return series

def load_vix(old):
    try:
        import yfinance as yf
        h = yf.Ticker("^VIX").history(period="1y")
        pts = [{"d": str(d.date()), "c": round(float(c), 2)} for d, c in zip(h.index, h["Close"])]
        if len(pts) > 20: return pts
    except Exception as e:
        print(f"VIX fetch failed: {e}", file=sys.stderr)
    return old.get("vix", []) if old else []

def main():
    old = {}
    if os.path.exists(OUT):
        try: old = json.load(open(OUT, encoding="utf-8"))
        except Exception: pass
    vix = load_vix(old)
    data = {
        "updated_at": datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M 北京时间"),
        "vix_latest": vix[-1]["c"] if vix else None,
        "vix": vix,
        "iv30": load_iv30(),
        "reports": load_reports(),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"data.json: {len(data['reports'])} reports, VIX {len(vix)} pts, latest VIX={data['vix_latest']}, updated {data['updated_at']}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
