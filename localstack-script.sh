#!/bin/bash

awslocal s3api \
    create-bucket --bucket my-bucket \
    --create-bucket-configuration LocationConstraint=eu-central-1 \
    --region eu-central-1
echo '{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["GET","POST","PUT"],"AllowedOrigins":["*"],"ExposeHeaders":["ETag"]}]}' > cors.json
awslocal s3api put-bucket-cors --bucket my-bucket --cors-configuration file://cors.json

awslocal sqs create-queue \
    --queue-name my-queue \
    --region eu-central-1
awslocal sqs create-queue \
    --queue-name my-queue-dlq \
    --region eu-central-1

QUEUE_URL=$(awslocal sqs get-queue-url --queue-name my-queue --region eu-central-1 --query 'QueueUrl' --output text)
DLQ_URL=$(awslocal sqs get-queue-url --queue-name my-queue-dlq --region eu-central-1 --query 'QueueUrl' --output text)
DLQ_ARN=$(awslocal sqs get-queue-attributes \
        --queue-url "$DLQ_URL" \
        --region eu-central-1 \
        --attribute-names QueueArn \
        --query 'Attributes.QueueArn' \
    --output text)

awslocal sqs set-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --region eu-central-1 \
    --attributes "{
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
}"
