var config = require('../config.json');
var db = require('../lib/db');
var stations = require('../lib/stations');
var regions = require('../lib/regions');
var nodemailer = require('nodemailer');
var sendmailTransport = require('nodemailer-sendmail-transport');
var transporter = nodemailer.createTransport(sendmailTransport());
var notifyTemplate = transporter.templateSender({
	subject: '{{ source }} PM2.5 濃度警示',
	text: '{{ source }} PM2.5 濃度到達警戒值，\n詳情請至此頁面查看：\n{{ url }}',
	html: '{{ source }} PM2.5 濃度到達警戒值，<br>詳情請至此頁面查看：<br><a href="{{ url }}">{{ url }}</a>'
}, {from: '"Project SensorWeb" <sensorweb@mozilla.com>'});
var DRYRUN = '--dry-run' == process.argv[2];

function onSuccess(result) {console.log(result)};
function onError(error) {console.error(error)};


db.connect(config.rethinkdb).then(function (db) {
	stations.setDatabase(db);
	regions.setDatabase(db);

	stations.notifyConcentrationChanges(function (subscription) {
		if (DRYRUN) {
			console.log(subscription);
		} else {
			notifyTemplate(
				{to: subscription.left.email}, 
				{source: subscription.right.display_name + '測站', url: 'https://sensorweb.io/pm25/station/' + subscription.right.slug}, 
				function (err, res) {
					if (err){
					    console.log(err);
					} else{
					    console.log(res);
					}
				});
		}
	}).then(function () {
		console.log('finished notify stations');
		return regions.notifyConcentrationChanges(function (subscription) {
			if (DRYRUN) {
				console.log(subscription);
			} else {
				var data = {
					source: subscription.right.display_name + '平均',
					url: 'https://sensorweb.io/pm25/'
				};
				notifyTemplate(
					{to: subscription.left.email}, 
					{source: subscription.right.display_name + '平均', url: 'https://sensorweb.io/pm25/'}, 
					function (err, res) {
						if (err){
						    console.log(err);
						} else{
						    console.log(res);
						}
					});
			}
		});
	}, onError).then(function () {
		console.log('finished notify regions');
		db.disconnect();
	}, onError);
});

