var config = require('../config.json');
var db = require('../lib/db');
var stations = require('../lib/stations');
var regions = require('../lib/regions');
var nodemailer = require('nodemailer');
var sendmailTransport = require('nodemailer-sendmail-transport');
var transporter = nodemailer.createTransport(sendmailTransport());
var notifyQueue = [];
var notifyTemplate = transporter.templateSender({
	subject: '{{ source }} PM2.5 濃度警示',
	text: '{{ source }} PM2.5 濃度到達警戒值，\n詳情請至此頁面查看：\n{{ url }}\n\n\n\n若要取消訂閱此通知請至此：\n{{ unsubscribe_url }}',
	html: '{{ source }} PM2.5 濃度到達警戒值，<br>詳情請至此頁面查看：<br><a href="{{ url }}">{{ url }}</a><br><br><br><br>若要取消訂閱此通知請<a href="{{ unsubscribe_url }}">按此</a>。'
}, {from: '"Project SensorWeb" <sensorweb@mozilla.com>'});
var DRYRUN = '--dry-run' == process.argv[2];

function onSuccess(result) {console.log(result)};
function onError(error) {console.error(error)};


db.connect(config.rethinkdb).then(function (db) {
	stations.setDatabase(db);
	regions.setDatabase(db);

	stations.notifyConcentrationChanges(function (subscription) {
		var unsubscribeUrl = config.site_url+'/pm25/unsubscribe/?id='+subscription.left.id+'&type='+subscription.left.type;
		var notify = {
			options: {
				to: subscription.left.email, 
				list: {unsubscribe: unsubscribeUrl}
			},
			content: {
				source: subscription.right.display_name + '測站', 
				url: config.site_url+'/pm25/station/' + subscription.right.slug, 
				unsubscribe_url: unsubscribeUrl
			}
		};
		notifyQueue.push(notify);
	}).then(function () {
		console.log('finished notify stations');
		return regions.notifyConcentrationChanges(function (subscription) {
			var unsubscribeUrl = config.site_url+'/pm25/unsubscribe/?id='+subscription.left.id+'&type='+subscription.left.type;
			var notify = {
				options: {
					to: subscription.left.email, 
					list: {unsubscribe: unsubscribeUrl}
				},
				content: {
					source: subscription.right.display_name + '平均',
					url: config.site_url+'/pm25/', 
					unsubscribe_url: unsubscribeUrl
				}
			};
			notifyQueue.push(notify);
		});
	}, onError).then(function () {
		notifyRecursive();
		console.log('finished notify regions');
		db.disconnect();
	}, onError);
});

function notifyRecursive() {
	var notify = notifyQueue.pop();
	if (notify) {
		if (DRYRUN) {
			console.log(notify);
			setTimeout(notifyRecursive, 400);
		} else {
			notifyTemplate(notify.options, notify.content, 
				function (err, res) {
					if (err){
					    console.log(err);
					} else{
					    console.log(res);
					}
					setTimeout(notifyRecursive, 400);
				}
			);
		}
	}
}

