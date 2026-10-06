# M2 CloudShell Deployment

This directory contains the M2 Lambda sources. Commit and push these files first,
then run the following from AWS CloudShell. Do not put any secret values in the
repository or shell history.

## 1. Get the source and package it

```bash
git clone https://github.com/WenJengLi/flight-price-notifier.git ~/flight-m2
cd ~/flight-m2
python3 aws/m2/test_check_mac_value.py
mkdir -p build/m2 build/parser
cp aws/m2/index.py build/m2/index.py
cp aws/m2/parser.py build/parser/index.py
(cd build/m2 && zip -q ../m2.zip index.py)
(cd build/parser && zip -q ../parser.zip index.py)
```

Set the one non-secret site value. It must be the Vercel production URL, without
a trailing slash.

```bash
export REGION=us-east-1
export ACCOUNT_ID=512804349786
export API_ID=9fa9ubhgd4
export API_BASE_URL=https://9fa9ubhgd4.execute-api.us-east-1.amazonaws.com
export SITE_URL=https://flight-price-notifier-omega.vercel.app
export ROLE_ARN=arn:aws:iam::512804349786:role/flight-lambda-role
export STATUS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/512804349786/flight-status-queue
```

Confirm the ECPay secret exists. Do not print it:

```bash
aws secretsmanager describe-secret --secret-id flight/ecpay --region "$REGION" --query Name --output text
```

## 2. Grant M2 permissions

```bash
cat > /tmp/flight-m2-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Scan"],
      "Resource": "arn:aws:dynamodb:us-east-1:512804349786:table/subscriptions"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:512804349786:secret:flight/ecpay-*",
        "arn:aws:secretsmanager:us-east-1:512804349786:secret:flight/resend-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
      "Resource": "arn:aws:sqs:us-east-1:512804349786:flight-status-queue"
    }
  ]
}
EOF
aws iam put-role-policy --role-name flight-lambda-role --policy-name flight-m2 --policy-document file:///tmp/flight-m2-policy.json
```

## 3. Deploy the M2 handlers

```bash
cd ~/flight-m2

aws lambda update-function-code --function-name flight-save-subscription --zip-file fileb://build/m2.zip --region "$REGION"
aws lambda wait function-updated --function-name flight-save-subscription --region "$REGION"
aws lambda update-function-configuration --function-name flight-save-subscription --handler index.handler --timeout 15 --environment "Variables={M2_HANDLER=save,API_BASE_URL=$API_BASE_URL,SITE_URL=$SITE_URL,STATUS_QUEUE_URL=$STATUS_QUEUE_URL}" --region "$REGION"

for HANDLER in return period result cancel status; do
  FUNCTION_NAME="flight-ecpay-$HANDLER"
  [ "$HANDLER" = "cancel" ] && FUNCTION_NAME=flight-cancel-subscription
  [ "$HANDLER" = "status" ] && FUNCTION_NAME=flight-status-notification
  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
    aws lambda update-function-code --function-name "$FUNCTION_NAME" --zip-file fileb://build/m2.zip --region "$REGION"
    aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
    aws lambda update-function-configuration --function-name "$FUNCTION_NAME" --handler index.handler --timeout 15 --environment "Variables={M2_HANDLER=$HANDLER,API_BASE_URL=$API_BASE_URL,SITE_URL=$SITE_URL,STATUS_QUEUE_URL=$STATUS_QUEUE_URL}" --region "$REGION"
  else
    aws lambda create-function --function-name "$FUNCTION_NAME" --runtime python3.12 --role "$ROLE_ARN" --handler index.handler --timeout 15 --memory-size 128 --zip-file fileb://build/m2.zip --environment "Variables={M2_HANDLER=$HANDLER,API_BASE_URL=$API_BASE_URL,SITE_URL=$SITE_URL,STATUS_QUEUE_URL=$STATUS_QUEUE_URL}" --region "$REGION"
  fi
done
```

## 4. Wire API Gateway and SQS

The existing `POST /subscribe` integration is `44i4o5t`.

```bash
SAVE_ARN="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:flight-save-subscription/invocations"
aws apigatewayv2 update-integration --api-id "$API_ID" --integration-id 44i4o5t --integration-uri "$SAVE_ARN" --payload-format-version 2.0 --region "$REGION"

for ROUTE in ecpay-return ecpay-period ecpay-result cancel; do
  FUNCTION_NAME="flight-${ROUTE}"
  [ "$ROUTE" = "cancel" ] && FUNCTION_NAME=flight-cancel-subscription
  ARN="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}/invocations"
  INTEGRATION_ID=$(aws apigatewayv2 create-integration --api-id "$API_ID" --integration-type AWS_PROXY --integration-uri "$ARN" --payload-format-version 2.0 --region "$REGION" --query IntegrationId --output text)
  METHOD=POST
  [ "$ROUTE" = "ecpay-result" ] && METHOD=ANY
  aws apigatewayv2 create-route --api-id "$API_ID" --route-key "$METHOD /$ROUTE" --target "integrations/$INTEGRATION_ID" --region "$REGION"
  aws lambda add-permission --function-name "$FUNCTION_NAME" --statement-id "apigw-${ROUTE}" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/${ROUTE}" --region "$REGION"
done

STATUS_ARN=$(aws lambda get-function --function-name flight-status-notification --region "$REGION" --query 'Configuration.FunctionArn' --output text)
aws lambda create-event-source-mapping --function-name "$STATUS_ARN" --event-source-arn "arn:aws:sqs:${REGION}:${ACCOUNT_ID}:flight-status-queue" --batch-size 1 --region "$REGION"

aws lambda add-permission --function-name flight-save-subscription --statement-id apigw-subscribe-m2 --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/POST/subscribe" --region "$REGION" || true
```

If rerunning Step 4 after a partial deployment, inspect existing routes and
integrations first rather than creating duplicates:

```bash
aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION"
aws apigatewayv2 get-integrations --api-id "$API_ID" --region "$REGION"
```

## 5. Deploy the parser gate

```bash
aws lambda update-function-code --function-name flight-parser --zip-file fileb://build/parser.zip --region "$REGION"
aws lambda wait function-updated --function-name flight-parser --region "$REGION"
```

## 6. Verify before paying

```bash
curl -i -X POST "$API_BASE_URL/subscribe" -H 'content-type: application/json' -d '{"email":"YOUR_EMAIL","plan_name":"tokyo","target_price":10000}'
```

The response must have `content-type: text/html`, an ECPay stage cashier action,
and a hidden `CheckMacValue`. Confirm the DynamoDB row is `pending_payment` and
has `merchant_trade_no`. Only then test the stage checkout card.