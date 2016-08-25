var config = require('../config.json');
var db = require('../lib/db');
var stations = require('../lib/stations');
var regions = require('../lib/regions');
var summary = require('../lib/summary');
var TOPDOWN_ADDR_COUNTRIES = ["tw", "jp", "kr", "cn"];
var THRESHOLD = 25;

function onError(error) {
	console.error(error);
}

function loadRegionsByStations(regionType) {
	var regns = {};
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
			}
		}
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


