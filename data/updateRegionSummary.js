var request = require('request');
var util = require('util');
var config = require('../config.json');
var db = require('../lib/db');
var stations = require('../lib/stations');
var regions = require('../lib/regions');
var summary = require('../lib/summary');
var TOPDOWN_ADDR_COUNTRIES = ["tw", "jp", "kr", "cn"];
var THRESHOLD = 25;
var OSM_API = "http://nominatim.openstreetmap.org/search?format=json&countrycodes=%s&%s=%s";

function onError(error) {
	console.error(error);
}

function loadRegionsByStations(regionType) {
	var regns = {};
	var regnQueue = [];
	var resolveLocation;

	return stations.countByRegionType(regionType).then(function(cnts) {
		for (var cnt of cnts) {
			if (null != cnt.group[1] && null != cnt.group[2] && cnt.reduction > THRESHOLD) {
				var regn = {};
				regn.country_code = cnt.group[0];
				regn.display_name = cnt.group[2];
				regn.region_name = cnt.group[2];
				regn.region_type = regionType;
				regn.slug = buildSlug(cnt.group);
				regn.stations_count = cnt.reduction;
				regns[regn.slug] = regn;
				regnQueue.push(regn);
			}
		}
		return new Promise(function (resolve, reject) {
			resolveLocation = resolve;
			loadLocationsRecursive();
		});
	}).then(function () {
		return stations.averageByRegionType(regionType, 'pm2_5')
	}).then(function (avgs) {
		for (var avg of avgs) {
			var regn = regns[buildSlug(avg.group)];
			if (regn) {
				regn.average = {
					pm2_5: avg.reduction,
					create_time: new Date()
				}
			}
		}
		var promises = [];
		for (var slug in regns) {
			console.log('Save data for region: '+slug);
			var promise = regions.saveOrUpdate(regns[slug]).then(function(result) {
			  var entry = {average: regns[slug].average};
		      if (undefined != result.existing_keys && undefined != result.existing_keys[0]) {
		        entry.region_id = result.existing_keys[0];
		      } else if (undefined != result.generated_keys && undefined != result.generated_keys[0]) {
		        entry.region_id = result.generated_keys[0];
		      }
		      return summary.save(entry);
			}).catch(onError);
			promises.push(promise);
		}
		console.log('Loaded region type: '+regionType);
		return Promise.all(promises);
	}).catch(onError);

	function loadLocationsRecursive() {
		var region = regnQueue.pop();
		if (undefined != region) {
			getRegionLocation(region.slug, region.country_code, region.region_type, region.region_name, function (result) {
				console.log(result);

				if (undefined != result) {
					regns[result.slug].coords = {
						latitude: result.lat,
						longitude: result.lon
					};
				} else {
					console.log('Unable to load '+region.slug);
				}
				setTimeout(loadLocationsRecursive, 1500);
			});
		} else {
			console.log('Region location loaded.');
			resolveLocation();
		}
	}

	function getRegionLocation(slug, countryCode, regionType, regionName, callback) {
		var options = {
		    url: util.format(OSM_API, countryCode, regionType, encodeURIComponent(regionName)),
		    headers: {
		        'user-agent': 'Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/31.0'
		    }
		};

		request(options, 
		    function(error, response, body) {
		        if (!error && response.statusCode == 200) {
					console.log('Loaded data for region: ' + slug);
	        		var result = JSON.parse(body);
	        		if (undefined != result[0]) {
		        		result[0].slug = slug;
		        		callback(result[0]);
	        		} else {
	        			//Sometimes region type is different when querying
	        			var regnTypes = ['state', 'county', 'city'];
	        			var idx = regnTypes.indexOf(regionType);
	        			if (-1 != idx) {
	        				regnTypes.splice(idx, 1);
	        			}
	        			setTimeout(getRegionLocation(slug, countryCode, regnTypes.pop(), regionName, function (result) {
	        				if (undefined != result) {
				        		callback(result);
	        				} else {
			        			setTimeout(getRegionLocation(slug, countryCode, regnTypes.pop(), regionName, function (result) {
					        		callback(result);
			        			}), 1500);
	        				}
	        			}), 1500);
	        		}
		        } else {
					console.log('Error loading data for region: ' + slug, error);
		        }
		    }); 
	}

}

function buildSlug(group) {
	if (-1 == TOPDOWN_ADDR_COUNTRIES.indexOf(group[0])) {
		return group[2] + ', ' + group[1];
	} else {
		return group[1] + group[2];
	}
}

db.connect(config.rethinkdb).then(function (db) {
	stations.setDatabase(db);
	regions.setDatabase(db);
	summary.setDatabase(db);
	Promise.all([
		loadRegionsByStations('state'),
		loadRegionsByStations('county'),
		loadRegionsByStations('city')
	]).then(function () {
		 console.log('Done loading all region summary.');
		 db.disconnect();
	}).catch(onError);
});


