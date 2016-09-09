'use strict';

var r = require('rethinkdb');
var TABLE_NAME = 'subscriptions';

function Subscriptions(connection) {}

Subscriptions.prototype = {};

/* 
 * public functions 
 */

Subscriptions.prototype.setDatabase = function (db) {
	this._db = db;
};

Subscriptions.prototype.subscribe = function (ctx, subscription) {
	subscription = convert2Db(ctx, subscription);
	subscription.status = 'active';
	var db = this._db;
	return new Promise(function(resolve, reject) {
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

var convert2Db = function (ctx, subscription) {
	if (undefined != subscription.latitude && undefined != subscription.longitude) {
		subscription.coords = r.point(Number.parseFloat(subscription.longitude), Number.parseFloat(subscription.latitude));
		delete subscription.latitude;
		delete subscription.longitude;
	}
	return subscription;
};

var convert2Json = function (ctx, subscription) {
	return subscription;
};


//TODO: accept connection object passed as an argument
module.exports = new Subscriptions();