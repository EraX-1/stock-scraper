#!/bin/bash

# Azure Container Registry への Docker イメージのデプロイスクリプト
# qast-scraper をベースに作成

# 設定変数（実際の値に置き換えてください）
ACR_NAME="stockregistry"  # あなたのACR名
RESOURCE_GROUP="stock"  # リソースグループ名
IMAGE_NAME="stock-scraper"
IMAGE_TAG="latest"

# Azure CLI でログイン状態を確認
echo "Azure CLI のログイン状態を確認しています..."
if ! az account show &>/dev/null; then
    echo "Azure にログインしてください:"
    az login
fi

# ACR にログイン
echo "Azure Container Registry にログインしています..."
az acr login --name $ACR_NAME

# ACR の完全な URL を取得
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

# Docker イメージをビルド（AMD64プラットフォーム指定）
echo "Docker イメージをビルドしています（AMD64）..."
docker build --platform linux/amd64 -f Dockerfile.clean -t $IMAGE_NAME:$IMAGE_TAG .

# イメージに ACR のタグを付ける
echo "イメージにタグを付けています..."
docker tag $IMAGE_NAME:$IMAGE_TAG $ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG

# ACR にイメージをプッシュ
echo "イメージを Azure Container Registry にプッシュしています..."
docker push $ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG

echo "デプロイが完了しました！"
echo "イメージ: $ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"