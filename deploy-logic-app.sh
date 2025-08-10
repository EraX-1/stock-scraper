#!/bin/bash

# Logic App スケジューラーのデプロイスクリプト

# 設定変数
RESOURCE_GROUP="stock"
LOGIC_APP_NAME="stock-scraper-scheduler"
CONTAINER_GROUP_NAME="stock-scraper-instance"
LOCATION="japaneast"

# Azure CLI でログイン状態を確認
echo "Azure CLI のログイン状態を確認しています..."
if ! az account show &>/dev/null; then
    echo "Azure にログインしてください:"
    az login
fi

# Logic App をデプロイ
echo "Logic App をデプロイしています..."
az deployment group create \
    --resource-group $RESOURCE_GROUP \
    --template-file logic-app-template.json \
    --parameters \
        logicAppName=$LOGIC_APP_NAME \
        location=$LOCATION \
        containerGroupResourceGroup=$RESOURCE_GROUP \
        containerGroupName=$CONTAINER_GROUP_NAME

echo "Logic App のデプロイが完了しました！"
echo "Logic App: $LOGIC_APP_NAME"

echo ""
echo "次のステップ:"
echo "1. Azure Portal で Logic App を開く"
echo "2. Container Registry の認証情報を設定する"
echo "3. Logic App の実行権限を設定する"