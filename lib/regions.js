'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'regions';
var _aqi, _geoip;

function Regions() {}

Regions.prototype = {};

/* 
 * public functions 
 */
Regions.prototype.setDatabase = function (db) {
	this._db = db;
};

Regions.prototype.setAqi = function (aqi) {
	_aqi = aqi;
};

Regions.prototype.setGeoip = function (geoip) {
	_geoip = geoip;
};

Regions.prototype.saveOrUpdate = function (ctx, region) {
	region = convert2Db(ctx, region);
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

Regions.prototype.getById = function (ctx, id) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).get(id)
		.run(db.connection).then(function(region) {
			resolve(convert2Json(ctx, region));
		}).catch(reject);
	});
};

Regions.prototype.getBySlug = function (ctx, slug) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({'slug': slug})
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(regions) {
				resolve(convert2Json(ctx, regions[0]));
			});
		}).catch(reject);
	});
};

Regions.prototype.searchBySlug = function (ctx, term) {
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
					output.push(convert2Json(ctx, region));
				}
				resolve(output);
			});
		}).catch(reject);
	});
};

Regions.prototype.listByIntersections = function (ctx, vertices) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.filter(r.row('average')('create_time').gt(getHourAgo(1.5))
			.and(r.row('coords').intersects(convertVertices(vertices))))
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(regions) {
				var result = [];
				for (var region of regions) {
					result.push(convert2Json(ctx, region));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Regions.prototype.listByNearestCoords = function (ctx, coords, countryCode) {
	var db = this._db;
	coords.latitude = Number.parseFloat(coords.latitude);
	coords.longitude = Number.parseFloat(coords.longitude);
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.getNearest(r.point(coords.longitude, coords.latitude), {index: 'coords'})
		.filter(r.row('doc')('country_code').eq(countryCode)).limit(10)
		.map(function(data) {
			return data('doc').merge({distance: data('dist').round()});
		})
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(regions) {
				var result = [];
				for (var region of regions) {
					result.push(convert2Json(ctx, region));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Regions.prototype.listNearest = function (ctx) {
	var instance = this;
    return new Promise(function (resolve, reject) {
	    var location = _geoip.lookupSync(ctx.ip);
	    if (null != location) {
		    location.country_code = location.country_code.toLowerCase();
			instance.listByNearestCoords(ctx, {latitude: location.latitude, longitude: location.longitude}, location.country_code)
			.then(function (regions) {
				if (undefined != regions && regions.length > 0) {
					resolve(regions);
				} else {
					var place = {
				        country_code: location.country_code.toLowerCase(),
				        region_type: (undefined == location.city) ? 'country':'city',
				        region_name: (undefined == location.city) ? location.country:location.city,
				        coords: {
				            latitude: location.latitude,
				            longitude: location.longitude
				        }
				    };
				    resolve(place);
				}
			}).catch(reject);
	    } else {
	    	resolve(location);
	    }
    });
};

Regions.prototype.list = function (ctx) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME)
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function(regions) {
				var result = [];
				for (var region of regions) {
					result.push(convert2Json(ctx, region));
				}
				resolve(result);
			});
		}).catch(reject);
	});
};

Regions.prototype.notifyConcentrationChanges = function (ctx, callback) {
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

var convert2Db = function (ctx, region) {
	if (region.coords != undefined && region.coords.latitude != undefined && region.coords.latitude != undefined) {
		region.coords = r.point(Number.parseFloat(region.coords.longitude), Number.parseFloat(region.coords.latitude));
	}
	return region;
};

var convert2Json = function (ctx, region) {
	if (undefined == region) {
		return undefined;
	}
	if (undefined != region.average.pm2_5) {
		region.average.pm2_5 = Math.round(region.average.pm2_5);
		if (undefined != _aqi) {
			region.average.status = _aqi.getAQIStatus(ctx, region.average.pm2_5, region.country_code);
			region.average.statusText = _aqi.getAQIStatusText(ctx, region.average.pm2_5, region.country_code);
		}
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
