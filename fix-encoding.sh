#!/bin/bash
DB_PASS=$(grep DB_PASSWORD /var/www/jegbrowser.com/.env | cut -d= -f2-)
mysql -u jeg_user -p"$DB_PASS" -D jeg_profiles <<SQL
ALTER DATABASE jeg_profiles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE gologin_profiles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE gologin_folders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW VARIABLES LIKE 'character_set_database';
SQL
