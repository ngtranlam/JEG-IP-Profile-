#!/bin/bash
set -e

ENV_FILE="/var/www/jegbrowser.com/.env"

DB_NAME=$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2-)
DB_USER=$(grep '^DB_USERNAME=' "$ENV_FILE" | cut -d= -f2-)
DB_PASS=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

echo "Syncing MySQL credentials for user '$DB_USER' on database '$DB_NAME'"

mysql --defaults-file=/dev/null <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "Verifying connection as $DB_USER..."
mysql -u "$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='${DB_NAME}';"

echo "Done."