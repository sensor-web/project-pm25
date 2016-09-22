var config = require('../config');
var db = require('../lib/db');
var subscriptions = require('../lib/subscriptions');
var ctx = null;

function onSuccess(result) {console.log(result)};
function onError(error) {console.error(error)};

db.connect(config.rethinkdb).then(function (db) {
    subscriptions.setMailchimp(config.mailchimp);
    subscriptions.setDatabase(db);
    subscriptions.list(ctx, true).then(function (results) {
        return subscriptions.batchSubscribeOnMailchimp(ctx, results);
    }).then(function (result) {
        console.log(result);
        db.disconnect();
    }).catch(onError);
    //TODO: save sids
});
