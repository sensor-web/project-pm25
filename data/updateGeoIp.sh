wget http://geolite.maxmind.com/download/geoip/database/GeoLiteCity.dat.gz &&
gunzip -f GeoLiteCity.dat.gz &&
forever restart $1
