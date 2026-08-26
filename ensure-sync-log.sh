#!/bin/bash
DB_PASS=$(grep DB_PASSWORD /var/www/jegbrowser.com/.env | cut -d= -f2-)
mysql -u jeg_user -p"$DB_PASS" -D jeg_profiles < /root/ensure-sync-log.sql
