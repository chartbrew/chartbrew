#!/bin/bash

# Check if version parameter is provided
if [ -z "$1" ]; then
    echo "Please provide a version number as parameter"
    echo "Usage: ./changeVersion.sh v3.12.1"
    exit 1
fi

# Add v prefix if not provided
NEW_VERSION=$1
if [[ ! $NEW_VERSION =~ ^v ]]; then
    NEW_VERSION="v$NEW_VERSION"
fi

# Update version in root package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
echo "Updated version in root package.json to $NEW_VERSION"

# Update version in client/package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" client/package.json
echo "Updated version in client/package.json to $NEW_VERSION"

# Update version in server/package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" server/package.json
echo "Updated version in server/package.json to $NEW_VERSION"

echo "Version update complete!"
