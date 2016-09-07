'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'regions';

function Regions() {}

Regions.prototype = {};

/* 
 * public functions 
 */
Regions.prototype.setDatabase = function (db) {
	this._db = db;
};

Regions.prototype.saveOrUpdate = function (region) {
	region = convert2Db(region);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'slug': region.slug}).count().do(function(regionExists) {
			return r.branch(r.expr(regionExists).gt(0), 
				r.table(TABLE_NAME).filter({'slug': region.slug}).update(region), 
				r.table(TABLE_NAME).insert(r.expr(region).merge({subscription_count: 0})));
		}).run(db.connection).then(function(result) {
			if (undefined == result.generated_keys) {
				r.table(TABLE_NAME).filter({'slug': region.slug}).getField('id')
				.run(db.connection).then(function(cursor) {
					cursor.toArray().then(function (keys) {
						result.existing_keys = keys;
						resolve(result);
					}).catch(reject);
				}).catch(reject);
			} else {
				resolve(result);
			}
		}).catch(reject);
	});
};

Regions.prototype.getById = function (id) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).get(id)
		.run(db.connection).then(function(region) {
			resolve(convert2Json(region));
		}).catch(reject);
	});
};

Regions.prototype.getBySlug = function (slug) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'slug': slug})
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(regions) {
				resolve(convert2Json(regions[0]));
			});
		}).catch(reject);
	});
};

Regions.prototype.searchBySlug = function (term) {
	var extractedTerm = extractSearchTerm(term);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(function (d) {
			return d('slug').match(extractedTerm);
		}).orderBy('slug').limit(5)
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(regions) {
				var output = [];
				for (var region of regions) {
					output.push(convert2Json(region));
				}
				resolve(output);
			});
		}).catch(reject);
	});
};

Regions.prototype.listByIntersections = function (vertices) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.filter(r.row('average')('create_time').gt(getHourAgo(1.5))
			.and(r.row('coords').intersects(convertVertices(vertices))))
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				var result = [];
				for (var station of stations) {
					result.push(convert2Json(station));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Regions.prototype.notifyConcentrationChanges = function (callback) {
	var db = this._db;
	return new Promise(function (resolve, reject) {
		r.table('subscriptions').filter({type: 'region', status: 'active'})
		.eqJoin('region_id', r.table(TABLE_NAME))
		.filter(r.row('right')('average')('pm2_5').gt(35)
			.and(r.row('right')('subscription_count').gt(0))
			.and(r.row('right')('average')('create_time').gt(getHourAgo())))
		.run(db.connection).then(function(cursor) {
			cursor.each(function(error, result) {
				if (error) {
					console.log(error)
					return;
				}
				if (callback) {
					callback(result);
				}
			}, resolve);
		}).catch(reject);
	});
};

/* 
 * private functions 
 */
var getHourAgo = function (base) {
	if (undefined == base) {
		base = 1;
	}
 	var hourAgo = new Date();
 	hourAgo.setTime(hourAgo.getTime() - 1000 * 60 * 60 * base)
	return hourAgo;
};

var convertVertices = function(vertices) {
	var points = [];
	for (var vertex of vertices) {
		points.push(r.point(vertex.longitude, vertex.latitude));
	}
	return r.polygon(r.args(points));
};

var convert2Db = function (region) {
	if (region.coords != undefined && region.coords.latitude != undefined && region.coords.latitude != undefined) {
		region.coords = r.point(Number.parseFloat(region.coords.longitude), Number.parseFloat(region.coords.latitude));
	}
	return region;
};

var convert2Json = function (region) {
	if (undefined == region) {
		return undefined;
	}
	if (undefined != region.average.pm2_5) {
		region.average.pm2_5 = Math.round(region.average.pm2_5);
	}
	if (region.coords != undefined) {
		var coords = {
			longitude: region.coords['coordinates'][0],
			latitude: region.coords['coordinates'][1]
		};
		region.coords = coords;
	}
	if (region.average.create_time != undefined) {
		region.average.create_time = region.average.create_time.toISOString().replace(/\.[0-9]+Z/, 'Z');
	}
	return region;
};

var extractSearchTerm = function (term) {
	return term.replace(/[台臺]/g, '[台臺]');
};

module.exports = new Regions();
