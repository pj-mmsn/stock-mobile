# -*- coding: utf-8 -*-
"""端到端验证：把"今天"伪装成 2026-09-24，真实调用两个 review 函数，
   写入**临时数据库副本**（不动生产库），证明函数本身能产出非空结果。"""
import os
import sys
import json
import shutil
import sqlite3
import datetime

SRC_DB = '/var/lib/stock-mobile/pred.db'
TMP_DB = '/tmp/pred_review_test.db'
TARGET_DAY = '2026-09-24'

print("=== 1) 用 SQLite 在线备份 API 复制一份生产库到 %s ===" % TMP_DB)
if os.path.exists(TMP_DB):
    os.remove(TMP_DB)
src = sqlite3.connect('file:%s?mode=ro' % SRC_DB, uri=True)
dst = sqlite3.connect(TMP_DB)
with dst:
    src.backup(dst)
dst.close()
src.close()
print("  副本大小 = %.1f MB" % (os.path.getsize(TMP_DB) / 1048576.0))

# 让 predict_server 用副本库 + 伪装日期
os.environ['PRED_DB'] = TMP_DB
sys.path.insert(0, '/opt/stock-mobile/backend')

import predict_server as ps

assert ps.DB == TMP_DB, 'DB 未指向副本：%s' % ps.DB
print("  predict_server.DB = %s  ✅" % ps.DB)


class _FakeNow(datetime.datetime):
    pass


_REAL_NOW = ps.now_cst


def fake_now():
    return datetime.datetime(2026, 9, 24, 20, 25, tzinfo=datetime.timezone(datetime.timedelta(hours=8)))


ps.now_cst = fake_now
print("  已把 now_cst() 伪装为 2026-09-24 20:25  ✅")

print()
print("=== 2) 真实调用 run_evening_review() ===")
try:
    ps.run_evening_review()
except Exception as e:
    import traceback
    print("  异常:", repr(e))
    traceback.print_exc()

print()
print("=== 3) 真实调用 mbm_evening_review() ===")
try:
    ps.mbm_evening_review()
except Exception as e:
    import traceback
    print("  异常:", repr(e))
    traceback.print_exc()

print()
print("=== 4) 检查副本库里是否真的写入了结果 ===")
c = sqlite3.connect('file:%s?mode=ro' % TMP_DB, uri=True)
for t in ('evening', 'mbm_review'):
    rows = c.execute("SELECT date,data FROM forecast_history WHERE type=? ORDER BY date DESC LIMIT 3", (t,)).fetchall()
    print("  --- %s (%d 条) ---" % (t, len(rows)))
    for d, ds in rows:
        try:
            j = json.loads(ds)
            if t == 'evening':
                print("     %s winrate=%s avg_return=%s total=%s" % (d, j.get('winrate'), j.get('avg_return'), j.get('total')))
                print("        summary: %s" % str(j.get('summary'))[:110])
            else:
                print("     %s winrate=%s avg_return=%s total=%s reviewed=%s" % (
                    d, j.get('winrate'), j.get('avg_return'), j.get('total'), j.get('reviewed')))
                print("        summary: %s" % str(j.get('summary'))[:110])
        except Exception as e:
            print("     %s (解析失败 %s)" % (d, e))
c.close()

print()
print("=== 5) 生产库复核（应与运行前一致）===")
c2 = sqlite3.connect('file:%s?mode=ro' % SRC_DB, uri=True)
for t in ('evening', 'mbm_review'):
    mx = c2.execute("SELECT max(date) FROM forecast_history WHERE type=?", (t,)).fetchone()[0]
    print("  生产库 %-12s 最新 = %s" % (t, mx))
c2.close()

# ★ 必须清理自己产生的库副本。
# 2026-10-12 教训：本脚本创建的副本和主库一样大（约 2.5GB），
# 漏删两次就把 40GB 分区从 78% 顶到 85%，差点让半夜的自动备份失败。
# 规则：诊断类脚本一律在最后删掉自己的大体积中间产物。
try:
    if os.path.exists(TMP_DB):
        _sz = os.path.getsize(TMP_DB) / 1073741824.0
        os.remove(TMP_DB)
        print()
        print("  ✅ 已清理临时副本 %s（%.2f GB）" % (TMP_DB, _sz))
    else:
        print()
        print("  （临时副本已不存在）")
except Exception as _e:
    print()
    print("  !! 清理临时副本失败，请手动删除 %s（%r）" % (TMP_DB, _e))
