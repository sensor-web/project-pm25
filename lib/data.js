'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'data';

function Data() {}

Data.prototype = {};

/* 
 * public functions 
 */

Data.prototype.setDatabase = function (db) {
	this._db = db;
};

Data.prototype.batchSave = function (ctx, data) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		var dataQ = [];
		var queries = [];
		var insertQ = [];
		var insertIdx = [];
		var response = [];
		for (var datum of data) {
			var d = convert2Db(ctx, datum);
			dataQ.push(d);
			queries.push(r.table(TABLE_NAME).filter({'station_id': d.station_id, 'create_time': d.create_time}).count());
		}
		batchQuery(ctx, db, queries).then(function (counts) {
			for (var idx in counts) {
				if (0 == counts[idx]) {
					insertQ.push(dataQ[idx]);
					insertIdx.push(idx);
				} else {
					response[idx] = {inserted: 0};
				}
			}
			batchInsert(ctx, db, insertQ).then(function (insertResults) {
				for (var i in insertResults) {
					var residx = insertIdx[i];
					response[residx] = {
						generated_keys: [insertResults[i]],
						inserted: 1
					};
				}
				resolve(response);
			}, reject).catch(reject);
		}, reject).catch(reject);
	});
};

Data.prototype.save = function (ctx, data) {
	data = convert2Db(ctx, data);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'station_id': data.station_id, 'create_time': data.create_time}).count()
		.do(function(dataExists) {
			return r.branch(r.expr(dataExists).gt(0), 
				{inserted: 0}, 
				r.table(TABLE_NAME).insert(data));
		}).run(db.connection).then(resolve).catch(reject);
	});
};

Data.prototype.getWeekMax = function(ctx, stationId, field) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(r.row('station_id').eq(stationId).and(r.row('create_time').gt(getDayAgo(7)))).getField(field).max().round()
		.run(db.connection).then(resolve).catch(reject);
	});
};

Data.prototype.getWeekMin = function(ctx, stationId, field) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(r.row('station_id').eq(stationId).and(r.row('create_time').gt(getDayAgo(7)))).getField(field).min().round()
		.run(db.connection).then(resolve).catch(reject);
	});
};

/* 
 * private functions 
 */

var getDayAgo = function (base) {
	if (undefined == base) {
		base = 1;
	}
 	var hourAgo = new Date();
 	hourAgo.setTime(hourAgo.getTime() - 1000 * 60 * 60 * 24 * base)
	return hourAgo;
};

var convert2Db = function (ctx, data) {
	if (data.create_time != undefined) {
		data.create_time = new Date(data.create_time);
	}
	return data;
};

var convert2Json = function (ctx, data) {
	return data;
};

var batchInsert = function (ctx, db, docs) {
	return new Promise(function (resolve, reject) {
		var batches = [];
		while (docs.length) {
			var batch = docs.splice(0, ctx.batchSize);
			batches.push(r.table(TABLE_NAME).insert(batch).run(db.connection, {durability: 'soft'}));
		}
		Promise.all(batches).then(function (results) {
			var keys = [];
			for (var result of results) {
				keys.push(result.generated_keys);
			}
			resolve([].concat.apply([], keys));
		}).catch(reject);
	});
};

var batchQuery = function (ctx, db, queries) {
	return new Promise(function (resolve, reject) {
		var batches = [];
		while (queries.length) {
			var batch = queries.splice(0, ctx.batchSize);
			batches.push(r.expr(batch).run(db.connection));
		}
		Promise.all(batches).then(function (results) {
			resolve([].concat.apply([], results));
		}).catch(reject);
	});
};

module.exports = new Data();