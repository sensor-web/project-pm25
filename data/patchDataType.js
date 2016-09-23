var config = require('../config');
var db = require('../lib/db');
var r = require('rethinkdb');
var ctx = {batchSize: config.db_batch_size};

function onSuccess(result) {console.log(result)};
function onError(error) {console.error(error)};


db.connect(config.rethinkdb).then(function (db) {
    r.table('data').run(db.connection).then(function (result) {
        result.toArray().then(function (data) {
            var updateQ = [];
            for (var datum of data) {
                var update = false;
                if (undefined != datum.pm2_5 && typeof datum.pm2_5 == 'string') {
                    datum.pm2_5 = Number.parseFloat(datum.pm2_5);
                    update = true;
                }
                if (undefined != datum.pm1 && typeof datum.pm1 == 'string') {
                    datum.pm1 = Number.parseFloat(datum.pm1);
                    update = true;
                }
                if (undefined != datum.pm10 && typeof datum.pm10 == 'string') {
                    datum.pm10 = Number.parseFloat(datum.pm10);
                    update = true;
                }
                if (update) {
                    updateQ.push(r.table('data').get(datum.id).update(datum));
                }
            }
            if (updateQ.length > 0) {
                console.log(updateQ.length);
                batchQuery(ctx, db, updateQ).then(function (result) {
                    console.log(result);
                    db.disconnect();
                }).catch(onError);
            }
        });
    }).catch(onError);
});

var batchQuery = function (ctx, db, queries) {
    return new Promise(function (resolve, reject) {
        var batches = [];
        while (queries.length) {
            var batch = queries.splice(0, ctx.batchSize);
            batches.push(r.expr(batch).run(db.connection));
        }
        Promise.all(batches).then(function (results) {
            resolve([].concat.apply([], results));
        }).catch(reject);
    });
};
