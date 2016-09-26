'use strict';

var config = require('../config');
var db = require('../lib/db');
var stations = require('../lib/stations');
var data = require('../lib/data');
var stationsData = require('./stations.json');
var stationsQ = [];
var dataQ = [];
var ctx = {batchSize: config.db_batch_size};
var now = new Date();

for (var slug in stationsData) {
    if (stationsData[slug].data.pm2_5 && stationsData[slug].data.create_time) {
        var ctime = new Date(stationsData[slug].data.create_time);
        if (now.getTime() - ctime.getTime() < 1000 * 60 * 60) {
            stationsQ.push(stationsData[slug]);
            dataQ.push(JSON.parse(JSON.stringify(stationsData[slug].data)));
        }
    }
}
function onError(error) {
    console.error(error);
}

db.connect(config.rethinkdb).then(function (db) {
    stations.setDatabase(db);
    stations.setAqi(config.aqi);
    data.setDatabase(db);
    stations.batchSaveOrUpdate(ctx, stationsQ).then(function (result) {
        console.log('saved stations: '+result.length);
        for (var i in dataQ) {
            var key = result[i].existing_keys || result[i].generated_keys;
            if (undefined != key) {
                dataQ[i].station_id = key[0];
            }
        }
        return data.batchSave(ctx, dataQ);
    }, onError).then(function (result) {
        console.log('saved data: '+result.length);
        db.disconnect();
    }, onError);
});

