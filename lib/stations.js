'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'stations';

function Stations(connection) {}

Stations.prototype = {};

/* 
 * public functions 
 */

Stations.prototype.setDatabase = function (db) {
	this._db = db;
};

Stations.prototype.saveOrUpdate = function (station) {
	station = convert2Db(station);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'slug': station.slug}).count().do(function(stationExists) {
			return r.branch(r.expr(stationExists).gt(0), 
				r.table(TABLE_NAME).filter({'slug': station.slug}).update(station), 
				r.table(TABLE_NAME).insert(r.expr(station).merge({subscription_count: 0})));
		}).run(db.connection).then(function(result) {
			if (undefined == result.generated_keys) {
				r.table(TABLE_NAME).filter({'slug': station.slug}).getField('id')
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

Stations.prototype.countByRegionType = function (regionType) {
	var db = this._db;
	return r.table(TABLE_NAME).filter(r.row('data')('create_time').gt(getHourAgo(1.5))).group(r.row('address')('country_code'), r.row('address')('country'), r.row('address')(regionType)).count().run(db.connection);
};

Stations.prototype.averageByRegionType = function (regionType, dataType) {
	var db = this._db;
	return r.table(TABLE_NAME).filter(r.row('data')('create_time').gt(getHourAgo(1.5)).and(r.row('data')(dataType))).group(r.row('address')('country_code'), r.row('address')('country'), r.row('address')(regionType)).getField('data')(dataType).avg().run(db.connection);
};

Stations.prototype.getBySlug = function (slug) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'slug': slug})
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				resolve(convert2Json(stations[0]));
			});
		}).catch(reject);
	});
};

Stations.prototype.searchBySlug = function (term) {
	var extractedTerm = extractSearchTerm(term);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(function (d) {
			return d('slug').match(extractedTerm);
		}).orderBy('slug').limit(5)
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				var output = [];
				for (var station of stations) {
					output.push(convert2Json(station));
				}
				resolve(output);
			});
		}).catch(reject);
	});
};

Stations.prototype.listByNearestCoords = function (coords, id) {
	var db = this._db;
	coords.latitude = Number.parseFloat(coords.latitude);
	coords.longitude = Number.parseFloat(coords.longitude);
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.getNearest(r.point(coords.longitude, coords.latitude), {index: 'coords', maxDist: 3000})
		.filter(r.row('doc')('data')('create_time').gt(getHourAgo(1.5))
			.and(undefined != id ? r.row('doc')('id').ne(id) : true)).limit(10)
		.map(function(data) {
			return data('doc').merge({distance: data('dist').round()});
		})
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

Stations.prototype.listByRegionTop = function (regionType, regionName, dataType) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(
			r.row('data')('create_time').gt(getHourAgo(1.5))
			.and(r.row('address')(regionType).eq(regionName)))
		.orderBy(r.desc(r.row('data')(dataType))).limit(10)
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

Stations.prototype.listByIds = function (ids) {
	if (typeof ids === 'string') {
		ids = [ids];
	}
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.filter(function(data){return r.expr(ids).contains(data('id'))})
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

Stations.prototype.listByDeviceKey = function (deviceKey) {
	if (typeof ids === 'string') {
		ids = [ids];
	}
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.filter({device_key: deviceKey})
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

Stations.prototype.listByIntersections = function (vertices) {
	if (typeof ids === 'string') {
		ids = [ids];
	}
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.filter(r.row('data')('create_time').gt(getHourAgo(1.5))
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

Stations.prototype.updateData = function (data) {
	//check API Key
};

Stations.prototype.notifyConcentrationChanges = function (callback, finishCallback) {
	var db = this._db;
	return new Promise(function (resolve, reject) {
		r.table('subscriptions').filter({type: 'station', status: 'active'})
		.eqJoin('station_id', r.table(TABLE_NAME))
		.filter(r.row('right')('subscription_count').gt(0)
			.and(r.row('right')('data')('pm2_5').gt(35))
			.and(r.row('right')('data')('create_time').gt(getHourAgo())))
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
}

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

var convert2Db = function (station) {
	if (station.id != undefined) {
		station.device_key = station.id;
		delete station.id;
	}
	if (station.coords != undefined && station.coords.latitude != undefined && station.coords.latitude != undefined) {
		station.coords = r.point(Number.parseFloat(station.coords.longitude), Number.parseFloat(station.coords.latitude));
	}
	if (station.data != undefined && station.data.create_time != undefined) {
		station.data.create_time = new Date(station.data.create_time);
	}
	return station;
};

var convert2Json = function (station) {
	if (undefined == station) {
		return undefined;
	}
	if (undefined != station.data.pm2_5) {
		station.data.pm2_5 = Math.round(station.data.pm2_5);
	}
	if (station.coords != undefined) {
		var coords = {
			longitude: station.coords['coordinates'][0],
			latitude: station.coords['coordinates'][1]
		};
		station.coords = coords;
	}
	if (station.data != undefined && station.data.create_time != undefined) {
		station.data.create_time = station.data.create_time.toISOString().replace(/\.[0-9]+Z/, 'Z');
	}
	return station;
};

var extractSearchTerm = function (term) {
	return term.replace(/[台臺]/g, '[台臺]');
};

//TODO: accept connection object passed as an argument
module.exports = new Stations();
