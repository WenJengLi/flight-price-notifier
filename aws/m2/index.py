import base64
import hashlib
import hmac
import html
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

import boto3


PLANS = {
    "tokyo": {"origin": "TPE", "destination": "TYO"},
    "seoul": {"origin": "TPE", "destination": "SEL"},
    "london": {"origin": "TPE", "destination": "LON"},
}

TABLE_NAME = os.environ.get("SUBSCRIPTIONS_TABLE", "subscriptions")
ECPAY_SECRET_ID = os.environ.get("ECPAY_SECRET_ID", "flight/ecpay")
STATUS_QUEUE_URL = os.environ.get("STATUS_QUEUE_URL", "")
API_BASE_URL = os.environ.get("API_BASE_URL", "").rstrip("/")
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")

table = boto3.resource("dynamodb").Table(TABLE_NAME)
secrets_manager = boto3.client("secretsmanager")
sqs = boto3.client("sqs")
_ecpay_secret = None


def json_response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
        },
        "body": json.dumps(body, default=str),
    }


def text_response(body, status=200):
    return {
        "statusCode": status,
        "headers": {"content-type": "text/plain; charset=utf-8"},
        "body": body,
    }


def html_response(body):
    return {
        "statusCode": 200,
        "headers": {
            "content-type": "text/html; charset=utf-8",
            "access-control-allow-origin": "*",
        },
        "body": body,
    }


def ecpay_url_encode(value):
    encoded = urllib.parse.quote_plus(str(value)).replace("~", "%7E").lower()
    for original, replacement in (
        ("%2d", "-"), ("%5f", "_"), ("%2e", "."), ("%21", "!"),
        ("%2a", "*"), ("%28", "("), ("%29", ")"),
    ):
        encoded = encoded.replace(original, replacement)
    return encoded


def check_mac_value(params, hash_key, hash_iv):
    items = {key: value for key, value in params.items() if key != "CheckMacValue"}
    pairs = "&".join(f"{key}={items[key]}" for key in sorted(items, key=str.lower))
    source = f"HashKey={hash_key}&{pairs}&HashIV={hash_iv}"
    return hashlib.sha256(ecpay_url_encode(source).encode("utf-8")).hexdigest().upper()


def get_ecpay_secret():
    global _ecpay_secret
    if _ecpay_secret is None:
        response = secrets_manager.get_secret_value(SecretId=ECPAY_SECRET_ID)
        _ecpay_secret = json.loads(response["SecretString"])
    return _ecpay_secret


def parse_body(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    return body if isinstance(body, str) else json.dumps(body)


def parse_json(event):
    try:
        return json.loads(parse_body(event) or "{}")
    except json.JSONDecodeError:
        return None


def parse_form(event):
    values = urllib.parse.parse_qs(parse_body(event), keep_blank_values=True)
    return {key: values[key][-1] for key in values}


def utc_timestamp(value=None):
    return (value or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")


def next_month(value=None):
    date = value or datetime.now(timezone.utc)
    year = date.year + (date.month // 12)
    month = (date.month % 12) + 1
    days = (31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    return date.replace(year=year, month=month, day=min(date.day, days[month - 1]))


def public_subscription(item):
    return {
        "email": item["email"],
        "route": item["route"],
        "plan_name": item["plan_name"],
        "origin": item["origin"],
        "destination": item["destination"],
        "target_price": int(item["target_price"]),
        "currency": item["currency"],
        "created_at": item["created_at"],
        "updated_at": item["updated_at"],
        "subscription_status": item.get("subscription_status", "pending_payment"),
        "current_period_end": item.get("current_period_end"),
        "current_period_end_date": item.get("current_period_end_date"),
    }


def checkout_html(params, cashier_url):
    inputs = "".join(
        f'<input type="hidden" name="{html.escape(key)}" value="{html.escape(str(value))}">' 
        for key, value in params.items()
    )
    return (
        "<!doctype html><html><body><form action=\""
        + html.escape(cashier_url, quote=True)
        + "\" method=\"post\">"
        + inputs
        + "</form><script>document.forms[0].submit()</script></body></html>"
    )


def enqueue(event_type, email, route):
    if STATUS_QUEUE_URL:
        sqs.send_message(
            QueueUrl=STATUS_QUEUE_URL,
            MessageBody=json.dumps({"event_type": event_type, "email": email, "route": route}),
        )


def save_subscription(event):
    body = parse_json(event)
    if not body:
        return json_response(400, {"error": "Invalid subscription data"})

    try:
        email = str(body.get("email", "")).strip().lower()
        plan_name = body.get("plan_name")
        target_price = Decimal(str(body.get("target_price")))
        if not email or plan_name not in PLANS or target_price <= 0:
            raise ValueError
    except (InvalidOperation, TypeError, ValueError):
        return json_response(400, {"error": "email, plan_name, and a positive target_price are required"})

    plan = PLANS[plan_name]
    route = f"{plan['origin']}-{plan['destination']}"
    existing = table.get_item(Key={"email": email, "route": route}).get("Item")
    if existing and existing.get("subscription_status") in {"active", "cancelled"}:
        timestamp = utc_timestamp()
        table.update_item(
            Key={"email": email, "route": route},
            UpdateExpression="SET target_price = :price, updated_at = :timestamp",
            ExpressionAttributeValues={":price": target_price, ":timestamp": timestamp},
        )
        existing["target_price"] = target_price
        existing["updated_at"] = timestamp
        return json_response(200, public_subscription(existing))

    secret = get_ecpay_secret()
    if not API_BASE_URL or not SITE_URL:
        return json_response(500, {"error": "Payment endpoint configuration is missing"})

    timestamp = utc_timestamp()
    merchant_trade_no = f"F{datetime.now(timezone.utc):%y%m%d%H%M%S}{secrets.token_hex(2).upper()}"
    item = {
        "email": email,
        "route": route,
        "plan_name": plan_name,
        "origin": plan["origin"],
        "destination": plan["destination"],
        "target_price": target_price,
        "currency": "TWD",
        "created_at": existing.get("created_at", timestamp) if existing else timestamp,
        "updated_at": timestamp,
        "subscription_status": "pending_payment",
        "merchant_trade_no": merchant_trade_no,
    }
    table.put_item(Item=item)

    amount = str(secret["amount"])
    trade_date = datetime.now(ZoneInfo("Asia/Taipei")).strftime("%Y/%m/%d %H:%M:%S")
    params = {
        "MerchantID": secret["merchant_id"],
        "MerchantTradeNo": merchant_trade_no,
        "MerchantTradeDate": trade_date,
        "PaymentType": "aio",
        "ChoosePayment": "Credit",
        "EncryptType": "1",
        "TotalAmount": amount,
        "PeriodAmount": amount,
        "PeriodType": "M",
        "Frequency": "1",
        "ExecTimes": "999",
        "ItemName": "Flight price alerts monthly subscription",
        "TradeDesc": "Flight price alert subscription",
        "ReturnURL": f"{API_BASE_URL}/ecpay-return",
        "PeriodReturnURL": f"{API_BASE_URL}/ecpay-period",
        "OrderResultURL": f"{API_BASE_URL}/ecpay-result",
        "CustomField1": email,
        "CustomField2": route,
    }
    params["CheckMacValue"] = check_mac_value(params, secret["hash_key"], secret["hash_iv"])
    cashier_url = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
    if secret.get("env") == "production":
        cashier_url = "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5"
    return html_response(checkout_html(params, cashier_url))


def process_callback(event, is_period):
    params = parse_form(event)
    secret = get_ecpay_secret()
    expected = check_mac_value(params, secret["hash_key"], secret["hash_iv"])
    if not hmac.compare_digest(params.get("CheckMacValue", "").upper(), expected):
        print(f"ECPay callback rejected: invalid CMV; fields={sorted(params)}")
        return text_response("0|CheckMacValueInvalid", 400)
    if params.get("MerchantID") != str(secret["merchant_id"]):
        print("ECPay callback rejected: MerchantID mismatch")
        return text_response("0|MerchantIDInvalid", 400)
    if params.get("SimulatePaid") == "1" or params.get("RtnCode") != "1":
        print(f"ECPay callback acknowledged without activation: RtnCode={params.get('RtnCode')}, simulated={params.get('SimulatePaid')}")
        return text_response("1|OK")

    email = params.get("CustomField1", "").strip().lower()
    route = params.get("CustomField2", "").strip()
    merchant_trade_no = params.get("MerchantTradeNo", "")
    if not email or not route or not merchant_trade_no:
        print("ECPay callback rejected: missing subscription keys")
        return text_response("0|SubscriptionNotFound", 400)

    item = table.get_item(Key={"email": email, "route": route}).get("Item")
    if not item or item.get("merchant_trade_no") != merchant_trade_no:
        print(f"ECPay callback rejected: subscription not found for route={route}")
        return text_response("0|SubscriptionNotFound", 400)

    if not is_period and item.get("subscription_status") == "active":
        print(f"ECPay callback already active for route={route}")
        return text_response("1|OK")

    period_end = next_month()
    table.update_item(
        Key={"email": email, "route": route},
        UpdateExpression=(
            "SET subscription_status = :status, current_period_end = :period_end, "
            "current_period_end_date = :period_end, updated_at = :timestamp"
        ),
        ExpressionAttributeValues={
            ":status": "active",
            ":period_end": utc_timestamp(period_end),
            ":timestamp": utc_timestamp(),
        },
    )
    if not is_period:
        enqueue("welcome", email, route)
    print(f"ECPay callback activated route={route}, period={is_period}")
    return text_response("1|OK")


def result_redirect():
    return {"statusCode": 302, "headers": {"Location": f"{SITE_URL}/app?purchase=success"}, "body": ""}


def cancel_subscription(event):
    body = parse_json(event)
    if not body:
        return json_response(400, {"error": "Invalid cancellation request"})
    email = str(body.get("email", "")).strip().lower()
    route = str(body.get("route", "")).strip()
    item = table.get_item(Key={"email": email, "route": route}).get("Item")
    if not item:
        return json_response(404, {"error": "Subscription not found"})
    if item.get("subscription_status") == "cancelled":
        return json_response(200, public_subscription(item))

    secret = get_ecpay_secret()
    action_params = {
        "MerchantID": secret["merchant_id"],
        "MerchantTradeNo": item.get("merchant_trade_no", ""),
        "Action": "Cancel",
        "TimeStamp": str(int(time.time())),
    }
    if action_params["MerchantTradeNo"]:
        action_params["CheckMacValue"] = check_mac_value(action_params, secret["hash_key"], secret["hash_iv"])
        endpoint = "https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction"
        if secret.get("env") == "production":
            endpoint = "https://payment.ecpay.com.tw/Cashier/CreditCardPeriodAction"
        request = urllib.request.Request(endpoint, data=urllib.parse.urlencode(action_params).encode(), method="POST")
        try:
            with urllib.request.urlopen(request, timeout=10):
                pass
        except Exception as error:
            print(f"ECPay cancellation request failed: {error}")

    period_end = item.get("current_period_end") or utc_timestamp(next_month())
    timestamp = utc_timestamp()
    table.update_item(
        Key={"email": email, "route": route},
        UpdateExpression=(
            "SET subscription_status = :status, current_period_end = :period_end, "
            "current_period_end_date = :period_end, updated_at = :timestamp"
        ),
        ExpressionAttributeValues={
            ":status": "cancelled",
            ":period_end": period_end,
            ":timestamp": timestamp,
        },
    )
    item.update({
        "subscription_status": "cancelled",
        "current_period_end": period_end,
        "current_period_end_date": period_end,
        "updated_at": timestamp,
    })
    enqueue("cancel", email, route)
    return json_response(200, public_subscription(item))


def send_status_email(secret, message):
    event_type = message["event_type"]
    route = message["route"]
    if event_type == "welcome":
        subject = "Your Flight Price Notifier subscription is active"
        body_html = f"<h2>Subscription active</h2><p>Your {html.escape(route)} price alerts are now active.</p>"
        body_text = f"Your {route} price alerts are now active."
    else:
        subject = "Your Flight Price Notifier subscription was cancelled"
        body_html = f"<h2>Subscription cancelled</h2><p>Your {html.escape(route)} alerts remain active until your current period ends.</p>"
        body_text = f"Your {route} alerts remain active until your current period ends."

    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps({
            "from": secret["from"],
            "to": [message["email"]],
            "subject": subject,
            "html": body_html,
            "text": body_text,
        }).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {secret['api_key']}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; flight-notifier/1.0)",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.status


def status_notification(event):
    resend_secret = json.loads(secrets_manager.get_secret_value(SecretId="flight/resend")["SecretString"])
    for record in event.get("Records", []):
        message = json.loads(record["body"])
        event_type = message.get("event_type")
        if event_type not in {"welcome", "cancel"}:
            print(f"Skipping unknown status event: {event_type}")
            continue

        state_name = f"{event_type}_notification_state"
        timestamp_name = f"{event_type}_sent_at"
        try:
            table.update_item(
                Key={"email": message["email"], "route": message["route"]},
                UpdateExpression="SET #state = :sending",
                ConditionExpression="attribute_not_exists(#state) OR #state = :failed",
                ExpressionAttributeNames={"#state": state_name},
                ExpressionAttributeValues={":sending": "sending", ":failed": "failed"},
            )
        except table.meta.client.exceptions.ConditionalCheckFailedException:
            print(f"{message['email']} {message['route']}: {event_type} already handled")
            continue

        try:
            status = send_status_email(resend_secret, message)
            table.update_item(
                Key={"email": message["email"], "route": message["route"]},
                UpdateExpression="SET #state = :sent, #sent_at = :timestamp",
                ExpressionAttributeNames={"#state": state_name, "#sent_at": timestamp_name},
                ExpressionAttributeValues={":sent": "sent", ":timestamp": utc_timestamp()},
            )
            print(f"Resend OK {status}: {event_type} sent to {message['email']}")
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8")
            print(f"Resend error {error.code}: {body}")
            table.update_item(
                Key={"email": message["email"], "route": message["route"]},
                UpdateExpression="SET #state = :failed",
                ExpressionAttributeNames={"#state": state_name},
                ExpressionAttributeValues={":failed": "failed"},
            )
            if error.code in {429, 500, 502, 503, 504}:
                raise
        except Exception:
            table.update_item(
                Key={"email": message["email"], "route": message["route"]},
                UpdateExpression="SET #state = :failed",
                ExpressionAttributeNames={"#state": state_name},
                ExpressionAttributeValues={":failed": "failed"},
            )
            raise
    return {"ok": True}


def handler(event, context):
    handler_name = os.environ.get("M2_HANDLER", "save")
    if handler_name == "save":
        return save_subscription(event)
    if handler_name == "return":
        return process_callback(event, is_period=False)
    if handler_name == "period":
        return process_callback(event, is_period=True)
    if handler_name == "result":
        return result_redirect()
    if handler_name == "cancel":
        return cancel_subscription(event)
    if handler_name == "status":
        return status_notification(event)
    return json_response(500, {"error": "Unknown M2 handler configuration"})