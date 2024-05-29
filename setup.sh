#!/bin/bash

DB_DIR="./data"
DB_FILE="$DB_DIR/blockchain.db"
CONFIG_FILE="./config.json"

# Check if the database directory exists
if [ ! -d "$DB_DIR" ]; then
    echo "Creating database directory..."
    mkdir -p "$DB_DIR"
fi

# Check if the database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "Initializing new database..."
    sqlite3 "$DB_FILE" "CREATE TABLE blockchain (height INTEGER PRIMARY KEY, block TEXT);"
    # Insert the genesis block
    node -e "const { generateGenesisBlock, addBlockToDatabase } = require('./blockchain'); addBlockToDatabase(generateGenesisBlock());"
else
    echo "Database already exists. Using existing database..."
fi

# Start the blockchain server using api.js
npm start
