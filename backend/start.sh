#!/bin/sh

# Initialize database schema
if [ -n "$DATABASE_URL" ]; then
  echo "Initializing database schema..."
  psql "$DATABASE_URL" -f init-db.sql 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ Database schema initialized successfully"
  else
    echo "⚠️ Database initialization completed (may have had some warnings)"
  fi
else
  echo "⚠️ DATABASE_URL not set, skipping database initialization"
fi

echo ""
echo "Starting application..."

# Start the application
exec node dist/index.js
