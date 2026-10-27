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

INDICES_US = [("^GSPC", "标普500"), ("^IXIC", "纳斯达克综合"), ("^NDX", "纳斯达克100"),
              ("^DJI", "道琼斯工业"), ("^RUT", "罗素2000")]
# A股指数走腾讯日K（yfinance 对创业板/沪深300/中证500/科创50 只有最新一行）
INDICES_CN = [("sh000001", "上证指数"), ("sz399001", "深证成指"), ("sz399006", "创业板指"),
              ("sh000300", "沪深300"), ("sh000905", "中证500"), ("sh000688", "科创50")]

def _mk_entry(sym, name, closes):
    last_d, last_c = closes[-1]
    prev_c = closes[-2][1]
    def pct(n):
        base = closes[-n-1][1] if len(closes) > n else closes[0][1]
        return round((last_c / base - 1) * 100, 2)
    return {"sym": sym, "name": name, "date": last_d, "close": round(last_c, 2),
            "chg": round((last_c / prev_c - 1) * 100, 2), "m1": pct(21), "m3": pct(63),
            "spark": [{"d": d, "c": round(c, 2)} for d, c in closes]}

def load_indices(old):
    old_map = {}
    if old:
        for grp in ("us", "cn"):
            for e in old.get("indices", {}).get(grp, []):
                old_map[e["sym"]] = e
    out = {"us": [], "cn": []}
    try:
        import yfinance as yf
        for sym, name in INDICES_US:
            try:
                h = yf.Ticker(sym).history(period="6mo")
                closes = [(str(d.date()), float(c)) for d, c in zip(h.index, h["Close"]) if c == c]
                if len(closes) < 2: raise ValueError("too few rows")
                out["us"].append(_mk_entry(sym, name, closes))
            except Exception as e:
                print(f"index {sym} failed: {e}", file=sys.stderr)
                if sym in old_map: out["us"].append(old_map[sym])
    except Exception as e:
        print(f"yfinance unavailable: {e}", file=sys.stderr)
        out["us"] = [old_map[s] for s, _ in INDICES_US if s in old_map]
    try:
        import requests
        from datetime import date, timedelta
        end = date.today(); beg = end - timedelta(days=200)
        for code, name in INDICES_CN:
            try:
                url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={code},day,{beg},{end},200,qfq"
                j = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"}).json()
                d = j["data"][code]
                ks = d.get("qfqday") or d.get("day") or []
                closes = [(k[0], float(k[2])) for k in ks]
                if len(closes) < 2: raise ValueError("too few rows")
                out["cn"].append(_mk_entry(code, name, closes))
            except Exception as e:
                print(f"index {code} failed: {e}", file=sys.stderr)
                if code in old_map: out["cn"].append(old_map[code])
    except Exception as e:
        print(f"tencent unavailable: {e}", file=sys.stderr)
        out["cn"] = [old_map[c] for c, _ in INDICES_CN if c in old_map]
    return out

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
        "indices": load_indices(old),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"data.json: {len(data['reports'])} reports, VIX {len(vix)} pts, latest VIX={data['vix_latest']}, updated {data['updated_at']}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
