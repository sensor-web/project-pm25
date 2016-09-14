# Project SensorWeb PM2.5 Pilot Website

Project SensorWeb is a crowdsourcing sensor network.  
We believe that open data can help revealing significant residential information and making lives better.

PM2.5 pilot website provides simple ways for users to discover relevant air quality data and contribute to the network.

This website is still in early beta,  
[let us know][contact] if any questions and comments.


## Prerequisites

You'll need to have the following stuff installed on your machine.
* [git][git]
* [Node.js][node]
* [RethinkDB][rethinkdb]

## Get it Running

Clone source code from repo:
```
git clone https://github.com/yshlin/project-pm25.git
cd project-pm25
```

Make a copy of he config file and change your settings
```
cp config.js.sample config.js
```

Install node.js dependencies
```
npm install
```

Create schema and load data into database for the first time.
```
cd data
echo "{}" > 3rdPartyData.json
echo "{}" > stations.json
echo "{}" > redirect.json
cp aqiTable.json.sample aqiTable.json
./updateGeoIp.sh
node ./createSchema.js
./cronjob.sh --freq=daily
```

## Set up Cron Jobs

Set up hourly job to update data from external source
```
00      0-3,5-23      *       *       *       cd ~/project-pm25/data/ && ./cronjob.sh --freq=hourly
```

Set up daily job to update new sensor locations and data from external source
```
00      4      *       *       *       cd ~/project-pm25/data/ && ./cronjob.sh --freq=daily
```

Update GeoIP database every month (and don't forget to reload database into memory).
```
30      03      7       *       *       cd ~/project-pm25/data/ && ./updateGeoIp.sh
```

[node]: http://nodejs.org/
[git]: https://git-scm.com/
[rethinkdb]: https://www.rethinkdb.com/
[contact]: mailto:sensorweb-tw@mozilla.com