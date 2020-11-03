# Lambda function for setting up MS teams integration

## Prerequisites
1. Install AWS CLI
```sh
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

2. Get AWS credentials
Contact your AWS Admin to get your access key and secret OR generate a new one yourself from [IAM console](https://console.aws.amazon.com/iam/home) > Your username > Securoity credentials > Create Access Key


3. Configure AWS CLI
Run the following and follow the prompts

```sh
aws configure
```

## Set up Lambda role

1. Create lambdaEx-trust-policy.json file with the following content

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

2. Create a role and attachg policies
```sh
aws iam create-role --role-name LambdaExecutor --assume-role-policy-document file://lambda-ex-trust-policy.json
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/AWSLambdaExecute --role-name LambdaExecutor
```
> copy the ARN of the role 


## Create Lambda
1. Copy msteams/lambda folder and customize index.js
2. Install dependencies
    ```sh
    yarn
    ```
3. Zip the files
```sh
zip -r function.zip .
```

4. uplaod the files
```sh
aws lambda create-function --function-name dina-tv2-transform --zip-file fileb://function.zip --handler index.handler --runtime nodejs12.x --role arn:aws:iam::570397503715:role/LambdaExecutor
```

## Add API and ENV
Open Lambda on AWS admin web page and add the following 

Configure a API gateway with REST API
Configure SNS to integration-alerts on failure
Add the required ENV vars
