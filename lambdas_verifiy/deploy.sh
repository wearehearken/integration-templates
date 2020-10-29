#!/bin/sh
rm -rf function.zip
zip -r function.zip .
aws lambda update-function-code --function-name KpccCategorizer --zip-file fileb://function.zip
