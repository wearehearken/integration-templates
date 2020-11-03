#!/bin/sh
rm -rf function.zip
cd ./lambda
zip -r ../function.zip .
cd ..
aws lambda update-function-code --function-name dina-tv2-transform --zip-file fileb://function.zip
