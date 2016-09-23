'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'stations';
var _aqi;

function Stations() {}

Stations.prototype = {};

/* 
 * public functions 
 */

Stations.prototype.setDatabase = function (db) {
	this._db = db;
};

Stations.prototype.setAqi = function (aqi) {
	_aqi = aqi;
};

Stations.prototype.batchSaveOrUpdate = function (ctx, stations) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		var queries = [];
		var insertQ = [];
		var updateQ = [];
		var updateQ2 = [];
		var insertIdx = [];
		var updateIdx = [];
		var response = [];
		for (var station of stations) {
			queries.push(r.table(TABLE_NAME).filter({'slug': station.slug}).count());
		}
		batchQuery(ctx, db, queries).then(function (counts) {
			for (var idx in counts) {
				var station = convert2Db(ctx, stations[idx]);
				if (counts[idx] > 0) {
					updateQ.push(r.table(TABLE_NAME).filter({'slug': station.slug}).update(station, {durability: 'soft'}));
					updateQ2.push(r.table(TABLE_NAME).filter({'slug': station.slug}).getField('id').coerceTo('array'));
					updateIdx.push(idx);
				} else {
					station.subscription_count = 0;
					insertQ.push(station);
					insertIdx.push(idx);
				}
			}
			batchQuery(ctx, db, updateQ).then(function (updateResults) {
				for (var idx in updateResults) {
					var residx = updateIdx[idx];
					response[residx] = updateResults[idx];
				}
				return batchInsert(ctx, db, insertQ);
			}, reject).then(function (insertResults) {
				for (var idx in insertResults) {
					var residx = insertIdx[idx];
					response[residx] = {
						generated_keys: [insertResults[idx]],
						inserted: 1
					};
				}
				return batchQuery(ctx, db, updateQ2);
			}, reject).then(function (updateResults) {
				for (var idx in updateResults) {
					var residx = updateIdx[idx];
					response[residx].existing_keys = updateResults[idx];
				}
				resolve(response);
			}, reject).catch(reject);
		}).catch(reject);
	});
};

Stations.prototype.saveOrUpdate = function (ctx, station) {
	station = convert2Db(ctx, station);
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

Stations.prototype.countByRegionType = function (ctx, regionType) {
	var db = this._db;
	return r.table(TABLE_NAME).filter(r.row('data')('create_time').gt(getHourAgo(1.5))).group(r.row('address')('country_code'), r.row('address')('country'), r.row('address')(regionType)).count().run(db.connection);
};

Stations.prototype.averageByRegionType = function (ctx, regionType, dataType) {
	var db = this._db;
	return r.table(TABLE_NAME).filter(r.row('data')('create_time').gt(getHourAgo(1.5)).and(r.row('data')(dataType))).group(r.row('address')('country_code'), r.row('address')('country'), r.row('address')(regionType)).getField('data')(dataType).avg().run(db.connection);
};

Stations.prototype.getBySlug = function (ctx, slug) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'slug': slug})
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				resolve(convert2Json(ctx, stations[0]));
			});
		}).catch(reject);
	});
};

Stations.prototype.searchBySlug = function (ctx, term) {
	var extractedTerm = extractSearchTerm(term);
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter(function (d) {
			return d('data')('create_time').gt(getHourAgo(1.5)).and(d('slug').match(extractedTerm));
		}).orderBy('slug').limit(5)
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				var output = [];
				for (var station of stations) {
					output.push(convert2Json(ctx, station));
				}
				resolve(output);
			});
		}).catch(reject);
	});
};

Stations.prototype.listByNearestCoords = function (ctx, coords, id) {
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
					result.push(convert2Json(ctx, station));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Stations.prototype.listByRegionTop = function (ctx, regionType, regionName, dataType) {
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
					result.push(convert2Json(ctx, station));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Stations.prototype.listByIds = function (ctx, ids) {
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
					result.push(convert2Json(ctx, station));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Stations.prototype.listByDeviceKey = function (ctx, deviceKey) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.filter({device_key: deviceKey})
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				var result = [];
				for (var station of stations) {
					result.push(convert2Json(ctx, station));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Stations.prototype.listByIntersections = function (ctx, vertices) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.filter(r.row('data')('create_time').gt(getHourAgo(1.5))
			.and(r.row('coords').intersects(convertVertices(vertices))))
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				var result = [];
				for (var station of stations) {
					result.push(convert2Json(ctx, station));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Stations.prototype.list = function (ctx) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(stations) {
				var result = [];
				for (var station of stations) {
					result.push(convert2Json(ctx, station));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Stations.prototype.updateData = function (ctx, id, data, legacy) {
	var db = this._db;
	data.create_time = new Date();
	return new Promise(function(resolve, reject) {
		if (legacy) {
			r.table(TABLE_NAME).filter({'id': id, 'party': 'legacy'}).count().do(function(stationExists) {
				return r.branch(r.expr(stationExists).gt(0), 
					r.table(TABLE_NAME).get(id).update({data: data}),
					{replaced: 0});
			}).run(db.connection).then(function(result) {
				if (0 == result.replaced) {
					reject(result);
				} else {
					resolve(result);
				}
			}).catch(reject);
		} else {
			r.table(TABLE_NAME).get(id).update({data: data})
			.run(db.connection).then(resolve).catch(reject);
		}
	});
};

Stations.prototype.notifyConcentrationChanges = function (ctx, callback, finishCallback) {
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

var convert2Db = function (ctx, station) {
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

var convert2Json = function (ctx, station) {
	if (undefined == station) {
		return undefined;
	}
	if (undefined != station.data.pm2_5) {
		station.data.pm2_5 = Math.round(station.data.pm2_5);
		if (undefined != _aqi) {
			station.data.status = _aqi.getAQIStatus(ctx, station.data.pm2_5, station.address.country_code);
			station.data.statusText = _aqi.getAQIStatusText(ctx, station.data.pm2_5, station.address.country_code);
		}
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

//TODO: accept connection object passed as an argument
module.exports = new Stations();
