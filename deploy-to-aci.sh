#!/bin/bash

# Azure Container Instances への直接デプロイスクリプト

# 設定変数
ACR_NAME="stockregistry"
RESOURCE_GROUP="stock"
CONTAINER_GROUP_NAME="stock-scraper-instance"
IMAGE_NAME="stock-scraper"
IMAGE_TAG="latest"
LOCATION="japaneast"

# Azure CLI でログイン状態を確認
echo "Azure CLI のログイン状態を確認しています..."
if ! az account show &>/dev/null; then
    echo "Azure にログインしてください:"
    az login
fi

# ACR の完全な URL を取得
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
FULL_IMAGE_NAME="$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"

# Container Instance を作成/更新
echo "Azure Container Instance をデプロイしています..."
az container create \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_GROUP_NAME \
    --image $FULL_IMAGE_NAME \
    --registry-login-server $ACR_LOGIN_SERVER \
    --registry-username $(az acr credential show --name $ACR_NAME --query username -o tsv) \
    --registry-password $(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv) \
    --cpu 2 \
    --memory 4 \
    --restart-policy Never \
    --location $LOCATION \
    --environment-variables \
        HEADLESS=true \
        DEBUG=false

echo "デプロイが完了しました！"
echo "Container Instance: $CONTAINER_GROUP_NAME"

# ログを確認
echo ""
echo "コンテナのログを確認するには以下のコマンドを実行してください:"
echo "az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_GROUP_NAME"