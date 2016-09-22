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
        console.log('merge all subscriptions');
        var subs = {};
        var subsQ = [];
        for (var result of results) {
            if (undefined != subs[result.email_address]) {
                subs[result.email_address] = mergeSubscriptions(subs[result.email_address], result);
            } else {
                subs[result.email_address] = result;
            }
        }
        for (var i in subs) {
            subsQ.push(subs[i]);
        }
        return subscriptions.batchSubscribeOnMailchimp(ctx, subsQ);
    }).then(function (result) {
        console.log('imported to mailchimp:');
        console.log(result);
        db.disconnect();
    }).catch(onError);
});

function mergeSubscriptions(sub1, sub2) {
    if (undefined != sub2.merge_fields.MYGPS) {
        sub1.merge_fields.MYGPS = sub2.merge_fields.MYGPS;
    }
    if (undefined != sub2.merge_fields.FREQ) {
        sub1.merge_fields.FREQ = sub2.merge_fields.FREQ;
    }
    if (undefined != sub2.merge_fields.WHYJOIN) {
        sub1.merge_fields.WHYJOIN = sub2.merge_fields.WHYJOIN;
    }
    if (undefined != sub2.merge_fields.GETASENSOR) {
        sub1.merge_fields.GETASENSOR = sub2.merge_fields.GETASENSOR;
    }
    if (undefined != sub2.interests) {
        sub1.interests = sub2.interests;
    }
    return sub1;
}