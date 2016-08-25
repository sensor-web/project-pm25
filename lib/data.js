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

Data.prototype.save = function (data) {
	data = convert2Db(data);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'station_id': data.station_id, 'create_time': data.create_time}).count()
		.do(function(dataExists) {
			return r.branch(r.expr(dataExists).gt(0), 
				{'create':0}, 
				r.table(TABLE_NAME).insert(data));
		}).run(db.connection).then(resolve).catch(reject);
	});
};

/* 
 * private functions 
 */

var convert2Db = function (data) {
	if (data.create_time != undefined) {
		data.create_time = new Date(data.create_time);
	}
	return data;
};

var convert2Json = function (data) {
	return data;
};


module.exports = new Data();