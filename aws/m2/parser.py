import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr


QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/512804349786/flight-fare-queue"
USER_AGENT = "Mozilla/5.0 (compatible; flight-notifier/1.0)"

ddb = boto3.resource("dynamodb").Table("subscriptions")
sqs = boto3.client("sqs")
secrets = boto3.client("secretsmanager")


def cheapest(origin, destination, month, token, currency):
    query = urllib.parse.urlencode({
        "origin": origin,
        "destination": destination,
        "depart_date": month,
        "currency": currency,
        "token": token,
    })
    request = urllib.request.Request(
        f"https://api.travelpayouts.com/v1/prices/cheap?{query}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            data = json.loads(response.read())
    except Exception as error:
        print(f"{currency} fare request failed: {error}")
        return None

    offers = data.get("data", {}).get(destination, {})
    if not data.get("success") or not offers:
        return None

    best = min(offers.values(), key=lambda offer: offer["price"])
    return {
        "price": best["price"],
        "currency": currency.upper(),
        "airline": best.get("airline"),
        "depart_date": best.get("departure_at"),
        "return_date": best.get("return_at"),
    }


def eligible(subscription, now):
    status = subscription.get("subscription_status")
    if status == "active":
        return True
    if status != "cancelled":
        return False

    current_period_end = subscription.get("current_period_end", "")
    if current_period_end >= now:
        return True

    ddb.update_item(
        Key={"email": subscription["email"], "route": subscription["route"]},
        UpdateExpression="SET subscription_status = :expired, updated_at = :timestamp",
        ExpressionAttributeValues={":expired": "expired", ":timestamp": now},
    )
    return False


def handler(event, context):
    origin = event["origin"]
    destination = event["destination"]
    route = event["route"]
    month = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    secret = json.loads(secrets.get_secret_value(SecretId="flight/travelpayouts")["SecretString"])
    twd = cheapest(origin, destination, month, secret["token"], "twd")
    if not twd:
        print(f"No TWD fare for {route}; skipping.")
        return {"ok": True, "route": route, "matched": 0}

    usd = cheapest(origin, destination, month, secret["token"], "usd")
    result = ddb.scan(FilterExpression=Attr("route").eq(route))
    matched = 0
    for subscription in result["Items"]:
        if not eligible(subscription, now):
            continue
        if Decimal(subscription["target_price"]) < Decimal(str(twd["price"])):
            continue

        message = {
            "email": subscription["email"],
            "route": route,
            "plan_name": subscription["plan_name"],
            "target_price": int(subscription["target_price"]),
            "cheapest": twd,
        }
        if usd:
            message["cheapest_usd"] = usd
        sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(message))
        matched += 1

    print(f"{route}: NT${twd['price']}, matched {matched}")
    return {"ok": True, "route": route, "matched": matched}