#!/usr/bin/env python3
"""
海乐生活（云裳/海尔）洗衣机状态只读客户端 POC
- 无需登录/账号：位置→网点→设备→单机状态 全链路只读
- 用法:
    python3 haile_status.py                       # 杭州西湖周边
    python3 haile_status.py --lng 120.15 --lat 30.27 --radius 翻页查看
    python3 haile_status.py --position 6503       # 指定网点ID
数据链路文档: ../notes/02_api_data_link.md
"""
import argparse
import json
import ssl
import sys
import urllib.request
from datetime import datetime

try:  # python.org 版 Python 常缺系统 CA，优先用 certifi
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = None

BASE = "https://yshz-user.haier-ioc.com"
HEADERS = {
    "Content-Type": "application/json",
    "appType": "2",        # 2 = H5 网页端身份
    "appVersion": "1.8.9",
    "authorization": "",   # 只读链路不需要
}

STATE = {1: "空闲", 2: "占用", 3: "故障"}
CATEGORY = {"00": "洗衣机", "01": "洗鞋机", "02": "烘干机", "03": "吹风机",
            "04": "饮水机", "08": "淋浴", "09": "投放器"}


def call(method, path, payload=None, params=None):
    url = BASE + path
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as resp:
        body = json.loads(resp.read().decode())
    if body.get("code") != 0:
        raise RuntimeError(f"{path} -> {body}")
    return body["data"]


def fmt_remaining(finish_time):
    if not finish_time:
        return "-"
    try:
        fin = datetime.strptime(finish_time[:19], "%Y-%m-%d %H:%M:%S")
        mins = int((fin - datetime.now()).total_seconds() // 60)
        return f"{mins}分钟" if mins > 0 else "即将结束"
    except ValueError:
        return finish_time


def show_position(position_id):
    cats = call("GET", "/position/positionDevice", params={"id": position_id})
    print(f"\n网点 #{position_id} 设备统计:")
    for c in cats:
        print(f"  {CATEGORY.get(c['categoryCode'], c['categoryCode'])}: "
              f"总{c['total']}台 / 空闲{c['idleCount']}台")

    for c in cats:
        code = c["categoryCode"]
        page = 1
        while True:
            d = call("POST", "/position/deviceDetailPage",
                     {"positionId": position_id, "categoryCode": code,
                      "page": page, "floorCode": "", "pageSize": 50})
            items = d.get("items") or []
            print(f"\n  [{CATEGORY.get(code, code)}] 第{page}页:")
            for it in items:
                st = STATE.get(it["state"], f"未知({it['state']})")
                rem = fmt_remaining(it.get("finishTime"))
                reserve = "可预约" if it.get("enableReserve") else ""
                print(f"    {it['name']:<16} {st}  剩余:{rem:<8} {reserve}"
                      f"  (deviceId={it['deviceId']})")
            if page * 50 >= d.get("total", 0) or not items:
                break
            page += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lng", type=float, default=120.15507)
    ap.add_argument("--lat", type=float, default=30.274085)
    ap.add_argument("--page-size", type=int, default=20)
    ap.add_argument("--position", type=int, help="直接查看指定网点ID")
    args = ap.parse_args()

    if args.position:
        show_position(args.position)
        return

    data = call("POST", "/position/nearPosition",
                {"lng": args.lng, "lat": args.lat,
                 "page": 1, "pageSize": args.page_size})
    print(f"附近共 {data['total']} 个网点（显示前 {len(data['items'])} 个）:")
    for p in data["items"]:
        cats = ",".join(CATEGORY.get(c, c) for c in p.get("categoryCodeList") or [])
        print(f"  [{p['id']}] {p['name']}  {int(p['distance'])}m  "
              f"空闲{p['idleCount']}台  类型:{cats}")

    if data["items"]:
        first = data["items"][0]["id"]
        print(f"\n—— 展开第 1 个网点的设备明细（--position <id> 可指定）——")
        show_position(first)


if __name__ == "__main__":
    sys.exit(main())
