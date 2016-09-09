'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'summary';

function Summary() {}

Summary.prototype = {};

/* 
 * public functions 
 */

Summary.prototype.setDatabase = function (db) {
	this._db = db;
};

Summary.prototype.save = function (ctx, summary) {
	summary = convert2Db(ctx, summary);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(r.row('region_id').eq(summary.region_id).and(r.row('average')('create_time').eq(summary.average.create_time))).count()
		.do(function(summaryExists) {
			return r.branch(r.expr(summaryExists).gt(0), 
				{'create':0}, 
				r.table(TABLE_NAME).insert(summary));
		}).run(db.connection).then(resolve).catch(reject);
	});
};

Summary.prototype.getWeekAvgMax = function(ctx, regionId, field) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(r.row('region_id').eq(regionId).and(r.row('average')('create_time').gt(getDayAgo(7)))).getField('average')(field).max().round()
		.run(db.connection).then(resolve).catch(reject);
	});
};

Summary.prototype.getWeekAvgMin = function(ctx, regionId, field) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(r.row('region_id').eq(regionId).and(r.row('average')('create_time').gt(getDayAgo(7)))).getField('average')(field).min().round()
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

var convert2Db = function (ctx, summary) {
	if (summary.average.create_time != undefined) {
		summary.average.create_time = new Date(summary.average.create_time);
	}
	return summary;
};

var convert2Json = function (ctx, summary) {
	return summary;
};
module.exports = new Summary();