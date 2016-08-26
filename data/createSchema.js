'use strict';

var config = require('../config.json');
var db = require('../lib/db');

function createTables() {
	return db.createDatabaseIfNotExist(config.rethinkdb.db)
	.then(db.createTableIfNotExist('stations'))
	.then(db.createTableIfNotExist('data'))
	.then(db.createTableIfNotExist('regions'))
	.then(db.createTableIfNotExist('summary'))
	.then(db.createTableIfNotExist('subscriptions'));
}

function createIndices() {
	return db.createIndexIfNotExist('stations', 'slug')
	.then(db.createIndexIfNotExist('stations', 'subscription_count'))
	.then(db.createIndexIfNotExist('stations', 'device_key'))
	.then(db.createIndexIfNotExist('stations', 'coords', {geo: true}))
	.then(db.createIndexIfNotExist('stations', 'data_create_time', function(d) {return d('data')('create_time')}))
	.then(db.createIndexIfNotExist('stations', 'data_pm2_5', function(d) {return d('data')('pm2_5')}))
	.then(db.createIndexIfNotExist('data', 'station_id'))
	.then(db.createIndexIfNotExist('data', 'pm2_5'))
	.then(db.createIndexIfNotExist('data', 'create_time'))
	.then(db.createIndexIfNotExist('regions', 'slug'))
	.then(db.createIndexIfNotExist('regions', 'subscription_count'))
	.then(db.createIndexIfNotExist('regions', 'region_type'))
	.then(db.createIndexIfNotExist('regions', 'country_code'))
	.then(db.createIndexIfNotExist('regions', 'average_create_time', function(d) {return d('average')('create_time')}))
	.then(db.createIndexIfNotExist('regions', 'average_pm2_5', function(d) {return d('average')('pm2_5')}))
	.then(db.createIndexIfNotExist('summary', 'region_id'))
	.then(db.createIndexIfNotExist('summary', 'average_create_time', function(d) {return d('average')('create_time')}))
	.then(db.createIndexIfNotExist('summary', 'average_pm2_5', function(d) {return d('average')('pm2_5')}))
	.then(db.createIndexIfNotExist('subscriptions', 'email'))
	.then(db.createIndexIfNotExist('subscriptions', 'status'))
	.then(db.createIndexIfNotExist('subscriptions', 'type'))
	.then(db.createIndexIfNotExist('subscriptions', 'coords', {geo: true}))
	.then(db.createIndexIfNotExist('subscriptions', 'create_time'))
	.then(db.createIndexIfNotExist('subscriptions', 'api_key'))
	.then(db.createIndexIfNotExist('subscriptions', 'station_id'))
	.then(db.createIndexIfNotExist('subscriptions', 'region_id'));
}

db.connect(config.rethinkdb).then(function() {
	createTables().then(createIndices).then(function () {
		console.log('Schema created.');
		db.disconnect();
	}).catch(function(error) {
		console.log(error);
	});
});
