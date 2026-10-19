import json

import boto3


table = boto3.resource("dynamodb").Table("subscriptions")


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
        },
        "body": json.dumps(body),
    }


def handler(event, context):
    params = event.get("queryStringParameters") or {}
    email = str(params.get("email", "")).strip().lower()

    if not email:
        return respond(400, {"error": "email is required"})

    result = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("email").eq(email)
    )
    items = result.get("Items", [])
    while result.get("LastEvaluatedKey"):
        result = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("email").eq(email),
            ExclusiveStartKey=result["LastEvaluatedKey"],
        )
        items.extend(result.get("Items", []))

    subscriptions = []
    for item in items:
        subscriptions.append({
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
        })

    return respond(200, {"subscriptions": subscriptions})