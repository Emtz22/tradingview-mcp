#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
import shutil
import sqlite3
import statistics
import subprocess
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any

ROOT = Path.cwd()
WORK = ROOT / ".tmp-h5-pareto"
ZIP_PATH = WORK / "source.zip"
EXTRACT = WORK / "extract"
OUT = WORK / "output"
DRIVE_ID = os.environ["H5_DRIVE_FILE_ID"]
KEY_RE = re.compile(r"(?:readme|summary|report|result|metric|pareto|variant|forward|backtest|improvement|manifest|receipt|score|analysis|review|handoff|paper|trade|fastlab|cohort|decision|strategy|external)", re.I)
TEXT_EXTS = {".md", ".txt", ".json", ".jsonl", ".csv", ".tsv", ".py", ".toml", ".yaml", ".yml", ".ini", ".cfg", ".log", ".sql", ".sh", ".ps1"}
MAX_PRINT_TOTAL = 700_000
MAX_PRINT_FILE = 70_000


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def safe(name: str) -> bool:
    p = PurePosixPath(name)
    return not p.is_absolute() and ".." not in p.parts and not re.match(r"^[A-Za-z]:", name)


def read_text(path: Path) -> str | None:
    raw = path.read_bytes()
    if b"\0" in raw[:8192]:
        return None
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return None


def num(v: Any) -> float | None:
    if v is None or isinstance(v, bool): return None
    if isinstance(v, (int, float)):
        x=float(v); return x if math.isfinite(x) else None
    s=str(v).strip().replace(",", "")
    if not s or s.lower() in {"nan","null","none","na","n/a"}: return None
    if s.endswith("%"): s=s[:-1]
    try:
        x=float(s); return x if math.isfinite(x) else None
    except ValueError: return None


def stat(v: list[float]) -> dict[str, Any]:
    v=sorted(x for x in v if math.isfinite(x))
    if not v: return {}
    n=len(v); q=lambda p:v[min(n-1,max(0,round((n-1)*p)))]
    return {"n":n,"min":v[0],"p25":q(.25),"median":statistics.median(v),"mean":statistics.fmean(v),"p75":q(.75),"max":v[-1],"sum":math.fsum(v)}


def csv_summary(path: Path) -> dict[str, Any]:
    result={"path":path.relative_to(EXTRACT).as_posix()}
    try:
        delimiter="\t" if path.suffix.lower()==".tsv" else ","
        with path.open("r",encoding="utf-8-sig",errors="replace",newline="") as f:
            rd=csv.DictReader(f,delimiter=delimiter); cols=rd.fieldnames or []
            nums={c:[] for c in cols}; cats={c:Counter() for c in cols}; first=[]; last=[]; rows=0
            for row in rd:
                rows+=1
                if len(first)<3:first.append(dict(row))
                last.append(dict(row)); last=last[-3:]
                for c in cols:
                    value=row.get(c)
                    x=num(value)
                    if x is not None: nums[c].append(x)
                    elif value not in (None,"") and len(cats[c])<=60: cats[c][str(value)]+=1
            result.update({"rows":rows,"columns":cols,"numeric":{c:stat(v) for c,v in nums.items() if v},"categorical":{c:dict(v.most_common(30)) for c,v in cats.items() if len(v)<=30},"first":first,"last":last})
    except Exception as exc: result["error"]=f"{type(exc).__name__}:{exc}"
    return result


def jsonl_summary(path: Path) -> dict[str, Any]:
    result={"path":path.relative_to(EXTRACT).as_posix()}; keys=Counter(); nums=defaultdict(list); cats=defaultdict(Counter); first=[]; last=[]; rows=0; errors=0
    try:
        with path.open("r",encoding="utf-8-sig",errors="replace") as f:
            for line in f:
                if not line.strip():continue
                rows+=1
                try:o=json.loads(line)
                except Exception:errors+=1;continue
                if len(first)<3:first.append(o)
                last.append(o);last=last[-3:]
                if isinstance(o,dict):
                    keys.update(o.keys())
                    for k,v in o.items():
                        x=num(v)
                        if x is not None:nums[k].append(x)
                        elif isinstance(v,(str,bool)) and len(cats[k])<=60:cats[k][str(v)]+=1
        result.update({"rows":rows,"errors":errors,"keys":dict(keys),"numeric":{k:stat(v) for k,v in nums.items()},"categorical":{k:dict(v.most_common(30)) for k,v in cats.items() if len(v)<=30},"first":first,"last":last})
    except Exception as exc:result["error"]=f"{type(exc).__name__}:{exc}"
    return result


def sqlite_summary(path: Path) -> dict[str, Any]:
    result={"path":path.relative_to(EXTRACT).as_posix(),"tables":{}}
    try:
        con=sqlite3.connect(f"file:{path.as_posix()}?mode=ro",uri=True)
        result["quick_check"]=con.execute("PRAGMA quick_check").fetchall()[:10]
        for (table,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
            q=table.replace('"','""'); count=con.execute(f'SELECT COUNT(*) FROM "{q}"').fetchone()[0]
            cols=con.execute(f'PRAGMA table_info("{q}")').fetchall()
            sample=[]
            if count:
                cur=con.execute(f'SELECT * FROM "{q}" LIMIT 3'); names=[d[0] for d in cur.description]
                for row in cur.fetchall():
                    o=dict(zip(names,row))
                    for k,v in list(o.items()):
                        if isinstance(v,(bytes,bytearray)):o[k]=f"<bytes:{len(v)}>"
                    sample.append(o)
            result["tables"][table]={"rows":count,"columns":[{"name":c[1],"type":c[2],"pk":c[5]} for c in cols],"sample":sample}
        con.close()
    except Exception as exc:result["error"]=f"{type(exc).__name__}:{exc}"
    return result


def main() -> None:
    shutil.rmtree(WORK,ignore_errors=True); EXTRACT.mkdir(parents=True); OUT.mkdir(parents=True)
    url=f"https://drive.usercontent.google.com/download?id={DRIVE_ID}&export=download&confirm=t"
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req,timeout=240) as src, ZIP_PATH.open("wb") as dst: shutil.copyfileobj(src,dst,1024*1024)
    if not zipfile.is_zipfile(ZIP_PATH): raise RuntimeError(f"download is not zip: {ZIP_PATH.read_bytes()[:200]!r}")
    inventory=[]
    with zipfile.ZipFile(ZIP_PATH) as z:
        bad=z.testzip(); infos=z.infolist(); unsafe=[i.filename for i in infos if not safe(i.filename)]
        if bad or unsafe: raise RuntimeError(f"bad={bad} unsafe={unsafe[:10]}")
        for i in infos: inventory.append({"path":i.filename,"bytes":i.file_size,"compressed":i.compress_size,"crc32":f"{i.CRC:08x}"})
        z.extractall(EXTRACT)
    files=[p for p in EXTRACT.rglob("*") if p.is_file()]
    receipt={"archive_sha256":sha256(ZIP_PATH),"archive_bytes":ZIP_PATH.stat().st_size,"zip_test":"PASS","entries":len(inventory),"files":len(files),"uncompressed_bytes":sum(x["bytes"] for x in inventory),"suffixes":dict(Counter(p.suffix.lower() or "<none>" for p in files))}
    csvs=[];jsonls=[];dbs=[];texts=[];printed=0
    print("H5_PHASE0_RECEIPT="+json.dumps(receipt,sort_keys=True))
    print("H5_PHASE0_TREE_BEGIN")
    for x in inventory:print(f"{x['bytes']:>12} {x['path']}")
    print("H5_PHASE0_TREE_END")
    for p in sorted(files):
        ext=p.suffix.lower(); size=p.stat().st_size; rel=p.relative_to(EXTRACT).as_posix()
        if ext in {".csv",".tsv"} and size<=100_000_000:csvs.append(csv_summary(p))
        elif ext==".jsonl" and size<=100_000_000:jsonls.append(jsonl_summary(p))
        elif ext in {".db",".sqlite",".sqlite3"} and size<=500_000_000:dbs.append(sqlite_summary(p))
        if ext in TEXT_EXTS and size<=3_000_000:
            t=read_text(p)
            if t is not None:
                texts.append({"path":rel,"bytes":size,"lines":len(t.splitlines()),"head":"\n".join(t.splitlines()[:50]),"tail":"\n".join(t.splitlines()[-30:])})
                if KEY_RE.search(rel+"\n"+t[:10000]) and printed<MAX_PRINT_TOTAL:
                    chunk=t[:min(MAX_PRINT_FILE,MAX_PRINT_TOTAL-printed)]
                    print(f"H5_KEY_FILE_BEGIN {rel} bytes={size}")
                    print(chunk)
                    print(f"H5_KEY_FILE_END {rel}")
                    printed+=len(chunk)
    payload={"csv":csvs,"jsonl":jsonls,"sqlite":dbs,"text_catalog":texts}
    (OUT/"phase0.json").write_text(json.dumps({"receipt":receipt,"inventory":inventory,"summaries":payload},indent=2,ensure_ascii=False,default=str),encoding="utf-8")
    print("H5_STRUCTURED_SUMMARIES_BEGIN")
    print(json.dumps(payload,ensure_ascii=False,default=str)[:1_200_000])
    print("H5_STRUCTURED_SUMMARIES_END")
    # Preserve the source and extraction only inside the Actions artifact.
    shutil.copy2(ZIP_PATH,OUT/"SOURCE_HANDOFF.zip")
    shutil.make_archive(str(OUT/"extracted"),"zip",EXTRACT)

if __name__=="__main__":main()
