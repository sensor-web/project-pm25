var config = require('../config');
var db = require('../lib/db');
var subscriptions = require('../lib/subscriptions');
var stations = require('../lib/stations');
var regions = require('../lib/regions');

var fs = require('fs');
var csv = require('fast-csv');
var stream = fs.createReadStream("./legacy-subscriptions.csv");
var moment = require('moment');
var DRYRUN = '--dry-run' == process.argv[2];

var freq_map = {
	'': '',
	'幾乎每天': 'everyday',
	'一週五天': '5days_per_week',
	'一週兩天': '2days_per_week',
	'很少': 'seldom'
};
var reason_map = {
	'': '',
	'我在意自己的健康': 'my_health',
	'我在意孩子和長輩的健康': 'family_disease',
	'我有心血管／呼吸系統疾病': 'my_disease',
	'我的家人有心血管／呼吸系統疾病': 'family_disease',
	'我想協助改善社區／城市居住環境': 'better_world'
};


function onSuccess(result) {console.log(result)};
function onError(error) {console.error(error)};


db.connect(config.rethinkdb).then(function (db) {
	stations.setDatabase(db);
	regions.setDatabase(db);
	subscriptions.setDatabase(db);

	var promises = [];
	var csvStream = csv()
	    .on("data", function(data){
	    	promises.push(convert(data));
	    })
	    .on("end", function(){
	    	Promise.all(promises).then(function () {
		    	db.disconnect();
		        console.log("done");
	    	});
	    });
	 
	stream.pipe(csvStream);

	function convert(row) {
		return new Promise(function (resolve, reject) {
			var data = {};
			data.email = row[1];
			data.create_time = moment(row[0], 'DD/MM/YYYY HH:mm:ss').toDate();
			data.frequency = freq_map[row[3]];
			data.reason = reason_map[row[4]];
			if ('region_taipei' == row[6]) {
				data.type = 'region';
				regions.getBySlug('臺灣臺北市').then(function (region) {
					data.region_id = region.id;
					if (DRYRUN) {
						console.log(data);
						resolve(data);
					} else {
						subscriptions.subscribe(data).then(resolve);
					}
				}).catch(reject);
			} else {
				data.type = 'station';
				stations.listByDeviceKey(row[6]).then(function (stationList) {
					if (1 == stationList.length) {
						data.station_id = stationList[0].id;
						if (DRYRUN) {
							console.log(data);
							resolve(data);
						} else {
							subscriptions.subscribe(data).then(resolve);
						}
					} else {
						console.log('Ambiguous stations for '+row[6]);
						console.log(stationList);
						resolve();
					}
				}).catch(reject);
			}
			// return data;
		});
	}
}).catch(onError);
