wget http://geolite.maxmind.com/download/geoip/database/GeoLiteCity.dat.gz &&
gunzip -f GeoLiteCity.dat.gz &&
if ! [ -z "$1" ]; then
    forever restart $1
fi
