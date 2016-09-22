'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'subscriptions';
var _mailchimp;
var md5 = require('md5');

function Subscriptions(connection) {}

Subscriptions.prototype = {};

/* 
 * public functions 
 */

Subscriptions.prototype.setDatabase = function (db) {
	this._db = db;
};

Subscriptions.prototype.setMailchimp = function (mailchimp) {
	_mailchimp = mailchimp;
};

Subscriptions.prototype.batchSubscribeOnMailchimp = function (ctx, subscriptions) {
	var mailchimp = _mailchimp.instance;
	return mailchimp.post('/lists/' + _mailchimp.pm25_list_id, {members: subscriptions, update_existing: true});
};

Subscriptions.prototype.subscribeOnMailchimp = function (ctx, subscription, newSub) {
	var mailchimp = _mailchimp.instance;
	if (true == newSub) {
		return mailchimp.post('/lists/' + _mailchimp.pm25_list_id + '/members', subscription);
	} else {
		return mailchimp.put('/lists/' + _mailchimp.pm25_list_id + '/members', subscription);
	}
};

Subscriptions.prototype.subscribe = function (ctx, subscription) {
	var instance = this;
	var subCopy = JSON.parse(JSON.stringify(subscription));
	subscription = convert2Db(ctx, subscription);
	subscription.status = 'active';
	var db = this._db;
	return new Promise(function(resolve, reject) {
		instance.checkExists(ctx, subscription.email).then(function (exists) {
			return instance.batchSubscribeOnMailchimp(ctx, [convert2Mailchimp(ctx, subCopy, !exists)]);
		}).then(function (result) {
			if (-1 != ['buy_station', 'diy_station', 'new_station'].indexOf(subscription.type)) {
				var data = {create_time: new Date()};
				if ('new_station' != subscription.type) {
					data.api_key = r.uuid();
				}
				r.table(TABLE_NAME).insert(r.expr(subscription).merge(data))
				.run(db.connection).then(function(result) {
					resolve(result);
				}).catch(reject);
			} else if (-1 != ['region', 'station'].indexOf(subscription.type)) {
				var query = {'type': subscription.type, 'email': subscription.email};
				var subject_id;
				if ('region' == subscription.type) {
					subject_id = query.region_id = subscription.region_id;
				} else if ('station' == subscription.type) {
					subject_id = query.station_id = subscription.station_id;
				}
				r.table(TABLE_NAME).filter(query).count().do(function(subscriptionExists) {
					return r.branch(r.expr(subscriptionExists).gt(0), 
						r.table(TABLE_NAME).filter(query).update(r.expr(subscription).merge({update_time: new Date()})), 
						r.table(TABLE_NAME).insert(r.expr(subscription).merge({create_time: new Date()})));
				}).run(db.connection).then(function(result) {
					if (undefined == result.generated_keys) {
						r.table(TABLE_NAME).filter(query).getField('id')
						.run(db.connection).then(function(cursor) {
							cursor.toArray().then(function (keys) {
								result.existing_keys = keys;
								resolve(result);
							}).catch(reject);
						}).catch(reject);
					} else {
						addSubscriptionCount(db, subscription.type, subject_id, 1)
						.then(function() {
							resolve(result);
						}).catch(reject);
					}
				}).catch(reject);
			} else {
				reject({created: 0, message: 'Invalid subscription type.'});
			}
		}).catch(reject);
	});
};

Subscriptions.prototype.unsubscribe = function (ctx, subscription) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		if (-1 != ['region', 'station'].indexOf(subscription.type)) {
			//query to validate that it's a real record
			var query = {'id': subscription.id, 'type': subscription.type, 'email': subscription.email};
			//query that actually do the job
			var query2 = subscription.unsubscribe_all ? 
				function(d) {
					d('email').eq(subscription.email).and(r.expr(['region', 'station']).contains(d('type')));
				} : {id: subscription.id}
			var data = {'status': 'inactive', 'unsubscribe_time': new Date()}
			if (undefined != subscription.comment) {
				data.comment = subscription.comment;
			}
			r.table(TABLE_NAME).filter(query).count().do(function(subscriptionExists) {
				return r.branch(r.expr(subscriptionExists).gt(0), 
					r.table(TABLE_NAME).filter(query2).update(data), 
					{replaced: 0});
			}).run(db.connection).then(function(result) {
				if (0 == result.replaced) {
					reject({replaced: 0, message: 'Subscription does not exist.'});
				} else {
					r.table(TABLE_NAME).filter(query2).getField('id')
					.run(db.connection).then(function(cursor) {
						cursor.toArray().then(function (keys) {
							result.existing_keys = keys;
							resolve(result);
						}).catch(reject);
					}).catch(reject);
				}
			}).catch(reject);
		} else {
			reject({replaced: 0, message: 'Invalid subscription type.'});
		}
	});
};

Subscriptions.prototype.list = function (ctx, mailchimp) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).orderBy('create_time')
		.run(db.connection).then(function(cursor) {
			cursor.toArray().then(function (results) {
				var subscriptions = [];
				for (var result of results) {
					if (true == mailchimp) {
						subscriptions.push(convert2Mailchimp(ctx, result));
					} else {
						subscriptions.push(convert2Json(ctx, result));
					}
				}
				resolve(subscriptions);
			})
		}).catch(reject);
	});
};

Subscriptions.prototype.checkExists = function (ctx, email) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({email: email}).count()
		.run(db.connection).then(function(result) {
			resolve(result > 0);
		}).catch(reject);
	});
};

Subscriptions.prototype.checkApiKey = function (ctx, apiKey, stationId) {
	var db = this._db;
	return new Promise(function(resolve, reject) {
		r.table(TABLE_NAME).filter({api_key: apiKey, station_id: stationId}).count()
		.run(db.connection).then(function(result) {
			resolve(result > 0);
		}).catch(reject);
	});
};

/* 
 * private functions 
 */

var addSubscriptionCount = function (db, type, id, count) {
	return r.table(type+'s').get(id).update({subscription_count: r.row('subscription_count').add(count)})
	.run(db.connection);
};

var convert2Mailchimp = function (ctx, subscription, newSub) {
	var sub = {
		email_address: subscription.email,
		status: true == newSub ? 'pending' : 'subscribed',
		merge_fields: {}
	};
	if (undefined != subscription.latitude && undefined != subscription.longitude) {
		sub.merge_fields.MYGPS = subscription.longitude + ',' + subscription.latitude;
	}
	if (subscription.frequency) {
		sub.merge_fields.FREQ = subscription.frequency;
	}
	if (subscription.reason) {
		sub.merge_fields.WHYJOIN = subscription.reason;
	}
	if (subscription.reason_join) {
		sub.merge_fields.WHYJOIN = subscription.reason_join;
	}
	if ('buy_station' == subscription.type) {
		sub.merge_fields.GETASENSOR = 'Buy a Sensor';
	} else if ('diy_station' == subscription.type) {
		sub.merge_fields.GETASENSOR = 'DIY Sensor';
	} else if ('new_station' == subscription.type) {
		sub.merge_fields.GETASENSOR = 'Get Notified';
	}
	if ('on' == subscription.will_participate) {
		if (undefined == sub.interests) {
			sub.interests = {};
		}
		sub.interests[_mailchimp.pm25_interest_id] = true;
	}
	return sub;
};

var convert2Db = function (ctx, subscription) {
	if (subscription.email) {
		subscription.sid = md5(subscription.email);
	}
	if (undefined != subscription.latitude && undefined != subscription.longitude) {
		subscription.coords = r.point(Number.parseFloat(subscription.longitude), Number.parseFloat(subscription.latitude));
		delete subscription.latitude;
		delete subscription.longitude;
	}
	return subscription;
};

var convert2Json = function (ctx, subscription) {
	if (subscription.coords != undefined) {
		var coords = {
			longitude: station.coords['coordinates'][0],
			latitude: station.coords['coordinates'][1]
		};
		subscription.coords = coords;
	}
	if (subscription.create_time != undefined) {
		subscription.create_time = subscription.create_time.toISOString().replace(/\.[0-9]+Z/, 'Z');
	}
	if (subscription.update_time != undefined) {
		subscription.update_time = subscription.update_time.toISOString().replace(/\.[0-9]+Z/, 'Z');
	}
	return subscription;
};


module.exports = new Subscriptions();