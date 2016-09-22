var config = require('../config');
var db = require('../lib/db');
var subscriptions = require('../lib/subscriptions');
var ctx = {batchSize: config.db_batch_size};

function onSuccess(result) {console.log(result)};
function onError(error) {console.error(error)};

db.connect(config.rethinkdb).then(function (db) {
    subscriptions.setMailchimp(config.mailchimp);
    subscriptions.setDatabase(db);
    subscriptions.updateSids(ctx).then(function (results) {
        console.log('updated SIDs');
        return subscriptions.list(ctx, true);
    }).then(function (results) {
        console.log('list all subscriptions');
        return subscriptions.batchSubscribeOnMailchimp(ctx, results);
    }).then(function (result) {
        console.log(result);
        db.disconnect();
    }).catch(onError);
});
