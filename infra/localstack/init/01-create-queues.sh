#!/usr/bin/env bash
set -euo pipefail

# LocalStack init hook (runs automatically once the SQS service is ready —
# see https://docs.localstack.cloud/references/init-hooks/). Provisions the
# queues this project needs so nobody has to run `aws sqs create-queue`
# by hand after `docker compose up`; the application never creates queues
# itself (see skill `queue`), only enqueues/consumes.
awslocal sqs create-queue --queue-name pets-registration --region "${AWS_DEFAULT_REGION:-us-east-1}"
