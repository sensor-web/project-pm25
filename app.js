var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var app = express();
var api = express();
var hbs = require('hbs');
var i18n = require('i18n');
var geolib = require('geolib');
var config = require('./config.json');
var redirect = require('./data/redirect.json');
var db = require('./lib/db');
var stations = require('./lib/stations');
var regions = require('./lib/regions');
var subscriptions = require('./lib/subscriptions');
var request = require('request');

i18n.configure({
    locales: ['zh-TW'],
    defaultLocale: 'zh-TW',
    cookie: 'locale',
    directory: "" + __dirname + "/locales",
    logDebugFn: function (msg) {
        console.log('debug', msg);
    },
    logWarnFn: function (msg) {
        console.log('warn', msg);
    },
    logErrorFn: function (msg) {
        console.log('error', msg);
    },
});

hbs.registerPartials(__dirname + '/views/partials');
hbs.registerHelper('__', function () {
    return i18n.__.apply(this, arguments);
});
hbs.registerHelper('__n', function () {
    return i18n.__n.apply(this, arguments);
});

app.set('trust proxy', true);
app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }))
app.locals.config = config;
// allow access of request object in templates
app.use(function(req,res,next){
    res.locals.req = req;
    next();
})
app.use(i18n.init);
api.use(i18n.init);
api.use(bodyParser.urlencoded({ extended: false }))
api.use(bodyParser.json())
// allow CORS in API
api.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Max-Age: 1000');
    next();
});


if (config.debug) {
    app.use('/pm25', express.static('public'));
}

app.get('/pm25', function(req, res) {
    if (addTrailingSlash(req, res)) {
        return;
    }
    Promise.all([
        regions.getBySlug("臺灣臺北市"),
        stations.listByRegionTop("state", "臺北市", "pm2_5"),
        stations.listByRegionTop("country", "臺灣", "pm2_5")
    ]).then(function (results) {
        var region = results[0];
        region.stateTop = results[1];
        region.countryTop = results[2];
        region.show_get_sensor = config.debug || req.query.get_sensor == 'true';
        region.show_map_search = config.debug || req.query.map_search == 'true';
        res.render('index', region);
    }).catch(serverError(res));
});

app.get('/pm25/about', function(req, res) {
    if (addTrailingSlash(req, res)) {
        return;
    }
    res.render('about');
});

app.get('/pm25/request', function(req, res) {
    if (addTrailingSlash(req, res)) {
        return;
    }
    res.render('request');
});

app.get('/pm25/station/:slug/', function(req, res) {
    if (addTrailingSlash(req, res)) {
        return;
    }
    var location = req.params.slug;
    if (redirect[location]) {
        res.redirect('/pm25/station/'+redirect[location]+'/');
        return;
    }
    stations.getBySlug(location).then(function(station) {
        if (station) {
            stations.listByNearestCoords(station.coords, station.id)
            .then(function (nearbyStations) {
                station.nearbyStations = nearbyStations;
                res.render('station', station);
            }).catch(serverError(res));
        } else {
            notFound(res)();
        }
    }).catch(serverError(res));
});

app.get('/pm25/unsubscribe', function(req, res) {
    if (addTrailingSlash(req, res)) {
        return;
    }
    var data = {};
    data.id = req.query.id;
    data.type = req.query.type;
    data.location = true;
    res.render('unsubscribe', data);
});

app.get('/sitemap.xml', function(req, res) {
    res.sendfile('./data/sitemap.xml');
});

app.get('/pm25/*', function(req, res) {
    notFound(res)();
});

/*
* API
*/

api.get('/pm25/stations', function(req, res) {
    if (req.query.ids) {
        stations.listByIds(req.query.ids)
        .then(function (stations) {
            res.json(stations);
        }).catch(serverError(res));
    } else if (req.query.latitude != undefined && req.query.longitude != undefined) {
        stations.listByNearestCoords({latitude: req.query.latitude, longitude: req.query.longitude})
        .then(function (stations) {
            res.json(stations);
        }).catch(serverErrorJson(res));
    } else if (req.query.q) {
        stations.searchBySlug(req.query.q)
        .then(function (stations) {
            res.json(stations);
        }).catch(serverError(res));
    }
});

api.get('/pm25/regions', function(req, res) {
    if (req.query.id) {
        regions.getById(req.query.id)
        .then(function (region) {
            res.json(region);
        }).catch(serverErrorJson(res));
    } else if (req.query.q) {
        regions.searchBySlug(req.query.q)
        .then(function (regions) {
            res.json(regions);
        }).catch(serverError(res));
    }
});

api.post('/pm25/subscriptions', function(req, res) {
    subscriptions.subscribe(req.body).then(function(result) {
        var sub_id = result.generated_keys || result.existing_keys;
        if (sub_id && sub_id.length) {
            sub_id = sub_id[0];
        }
        res.json({result: 'success', message: res.__('subscribe.'+req.body.type+'.success'), subscription_id: sub_id});
    }).catch(serverErrorJson(res));
});

api.delete('/pm25/subscriptions', function(req, res) {
    subscriptions.unsubscribe(req.body).then(function(result) {
        res.json({result: 'success', message: res.__('unsubscribe.success'), subscription_ids: result.existing_keys});
    }).catch(serverErrorJson(res));
});

api.get('/pm25/*', function(req, res) {
    notFoundJson(res)();
});


db.connect(config.rethinkdb).then(function (db) {
    stations.setDatabase(db);
    regions.setDatabase(db);
    subscriptions.setDatabase(db);

    app.listen(config.port, function () {
        console.log('Server listening on port ' + config.port);
    });
    api.listen(config.api_port, function () {
        console.log('API listening on port ' + config.api_port);
    });  
});

function notFound(res) {
    return function(result) {
        res.status(404);
        res.render('404');
    };
}

function serverError(res) {
    return function(result) {
        res.status(500);
        res.render('500');
    };
}

function notFoundJson(res) {
    return function(result) {
        res.status(404);
        res.json({result: 'failed', message: res.__('not.found')});
    };
}

function serverErrorJson(res) {
    return function(result) {
        res.status(500);
        res.json({result: 'failed', message: res.__('server.error')});
    };
}

function addTrailingSlash(req, res) {
    if (req.path[req.path.length - 1] != '/') {
        if (-1 == req.url.indexOf('?')) {
            res.redirect(req.path + '/');
        } else {
            res.redirect(req.path + '/' + req.url.substr(req.url.indexOf('?')));
        }
        return true;
    }
    return false;
}
