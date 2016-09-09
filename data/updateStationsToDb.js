'use strict';

var config = require('../config.json');
var db = require('../lib/db');
var stations = require('../lib/stations');
var data = require('../lib/data');
var stationsData = require('./stations.json');
var stationsQueue = [];
var ctx = null;

for (var slug in stationsData) {
  stationsQueue.push(stationsData[slug]);
}
function onError(error) {
  console.error(error);
}
function migrateStationsRecursive() {
  var stationData = stationsQueue.pop();
  if (stationData) {
    var entry = JSON.parse(JSON.stringify(stationData.data));
    stations.saveOrUpdate(ctx, stationData)
    .then(function(result) {
      if (undefined != result.existing_keys && undefined != result.existing_keys[0]) {
        entry.station_id = result.existing_keys[0];
      } else if (undefined != result.generated_keys && undefined != result.generated_keys[0]) {
        entry.station_id = result.generated_keys[0];
      }
      return data.save(ctx, entry);
    }, onError)
    .then(migrateStationsRecursive, onError).catch(onError);
  } else {
    db.disconnect();
    console.log('Data migrated to DB.');
  }
}

db.connect(config.rethinkdb).then(function (db) {
  stations.setDatabase(db);
  data.setDatabase(db);
  migrateStationsRecursive();
});

