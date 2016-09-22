var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var app = express();
var api = express();
var hbs = require('hbs');
var config = require('./config');
var i18n = config.i18n;
var redirect = require('./data/redirect.json');
var db = require('./lib/db');
var stations = require('./lib/stations');
var regions = require('./lib/regions');
var subscriptions = require('./lib/subscriptions');
var summary = require('./lib/summary');
var data = require('./lib/data');
var request = require('request');
var aqi = require('./lib/aqi');

hbs.registerPartials(__dirname + '/views/partials');
hbs.registerHelper('__', function () {
    return i18n.__.apply(this, arguments);
});
hbs.registerHelper('__n', function () {
    return i18n.__n.apply(this, arguments);
});
hbs.registerHelper('__l', function (phrase, locale) {
    return i18n.__({phrase: phrase, locale: locale});
});

app.set('trust proxy', true);
app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(i18n.init);
app.locals.config = config;
app.use(function(req,res,next){
    createContext(req);
    // allow access of request object in templates
    res.locals.req = req;
    next();
});

api.use(bodyParser.urlencoded({ extended: false }))
api.use(bodyParser.json())
api.use(i18n.init);
// allow CORS in API
api.use(function(req, res, next) {
    createContext(req);
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
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
    regions.listNearest(req.ctx).then(function (regions) {
        if (undefined != regions && regions.length > 0 && undefined != regions[0].slug) {
            var region = regions.shift();
            Promise.all([
                stations.listByRegionTop(req.ctx, region.region_type, region.region_name, "pm2_5"),
                stations.listByRegionTop(req.ctx, "country_code", region.country_code, "pm2_5")
            ]).then(function (results) {
                region.nearbyRegions = regions;
                region.stateTop = results[0];
                region.countryTop = results[1];
                region.show_map_search = config.debug || req.query.map_search == 'true';
                Promise.all([
                    summary.getWeekAvgMax(req.ctx, region.id, 'pm2_5'),
                    summary.getWeekAvgMin(req.ctx, region.id, 'pm2_5')
                ]).then(function (history) {
                    region.week = {
                        max: history[0],
                        maxStatus: aqi.getAQIStatus(req.ctx, history[0], region.country_code),
                        min: history[1],
                        minStatus: aqi.getAQIStatus(req.ctx, history[1], region.country_code)
                    };
                    res.render('index', region);
                }).catch(serverError(res));
            }).catch(serverError(res));
        } else {
            var region = (undefined == regions || regions.length == 0) ? {} : regions.shift();
            region.show_map_search = config.debug || req.query.map_search == 'true';
            // show messages to inform lack of data.
            res.render('index', region);
        }
    }).catch(serverError(res));
});

app.get('/pm25/region/:slug', function(req, res) {
    if (addTrailingSlash(req, res)) {
        return;
    }
    var location = req.params.slug;
    if (redirect[location]) {
        res.redirect('/pm25/region/'+redirect[location]+'/');
        return;
    }
    regions.getBySlug(req.ctx, location).then(function (region) {
        if (undefined != region && undefined != region.slug) {
            Promise.all([
                regions.listByNearestCoords(req.ctx, {latitude: region.coords.latitude, longitude: region.coords.longitude}, region.country_code, region.id),
                stations.listByRegionTop(req.ctx, region.region_type, region.region_name, "pm2_5"),
                stations.listByRegionTop(req.ctx, "country_code", region.country_code, "pm2_5")
            ]).then(function (results) {
                region.nearbyRegions = results[0];
                region.stateTop = results[1];
                region.countryTop = results[2];
                region.show_map_search = config.debug || req.query.map_search == 'true';
                Promise.all([
                    summary.getWeekAvgMax(req.ctx, region.id, 'pm2_5'),
                    summary.getWeekAvgMin(req.ctx, region.id, 'pm2_5')
                ]).then(function (history) {
                    region.week = {
                        max: history[0],
                        maxStatus: aqi.getAQIStatus(req.ctx, history[0], region.country_code),
                        min: history[1],
                        minStatus: aqi.getAQIStatus(req.ctx, history[1], region.country_code)
                    };
                    res.render('region', region);
                }).catch(serverError(res));
            }).catch(serverError(res));
        } else {
            if (undefined == region) {
                region = {};
            }
            //TODO: show message to inform lack of data.
            res.render('index', region);
        }
    }).catch(serverError(res));
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
    stations.getBySlug(req.ctx, location).then(function(station) {
        if (station) {
            Promise.all([
                stations.listByNearestCoords(req.ctx, station.coords, station.id),
                data.getWeekMax(req.ctx, station.id, 'pm2_5'),
                data.getWeekMin(req.ctx, station.id, 'pm2_5')
            ]).then(function (results) {
                station.nearbyStations = results[0];

                station.week = {
                    max: results[1],
                    maxStatus: aqi.getAQIStatus(req.ctx, results[1], station.address.country_code),
                    min: results[2],
                    minStatus: aqi.getAQIStatus(req.ctx, results[2], station.address.country_code)
                };
                res.render('station', station);
            }).catch(serverError(res));
        } else {
            notFound(res)();
        }
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
    regions.getCoords(req.ctx).then(function (location) {
        res.render('request', location);
    }).catch();
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
        stations.listByIds(req.ctx, req.query.ids)
        .then(function (stations) {
            res.json(stations);
        }).catch(serverError(res));
    } else if (req.query.latitude != undefined && req.query.longitude != undefined) {
        stations.listByNearestCoords(req.ctx, {latitude: req.query.latitude, longitude: req.query.longitude})
        .then(function (stations) {
            res.json(stations);
        }).catch(serverErrorJson(res));
    } else if (req.query.q) {
        stations.searchBySlug(req.ctx, req.query.q)
        .then(function (stations) {
            res.json(stations);
        }).catch(serverError(res));
    } else if (req.query.points) {
        stations.listByIntersections(req.ctx, params2JsonPoints(req.query.points))
        .then(function (stations) {
            res.json(stations);
        }).catch(serverErrorJson(res));
    }
});

api.post('/pm25/stations/:id', function(req, res) {
    var id = req.params.id;
    var entry = req.body;
    var apiKey = entry.api_key;
    delete entry.api_key;
    subscriptions.checkApiKey(req.ctx, apiKey, id).then(function (valid) {
        if (valid) {
            stations.updateData(req.ctx, id, entry).then(function () {
                entry.station_id = id;
                return data.save(req.ctx, entry);
            }).then(function() {
                res.json({result: 'success'});
            }).catch(serverErrorJson(res));
        } else {
            res.json({result: 'failed', message: res.__('invalid.api.key')})
        }
    }).catch(serverErrorJson(res));
});

api.get('/pm25/regions', function(req, res) {
    if (req.query.id) {
        regions.getById(req.ctx, req.query.id)
        .then(function (region) {
            res.json(region);
        }).catch(serverErrorJson(res));
    } else if (req.query.q) {
        regions.searchBySlug(req.ctx, req.query.q)
        .then(function (regions) {
            res.json(regions);
        }).catch(serverError(res));
    } else if (req.query.latitude != undefined && req.query.longitude != undefined && req.query.country_code != undefined) {
        regions.listByNearestCoords(req.ctx, {latitude: req.query.latitude, longitude: req.query.longitude}, req.query.country_code)
        .then(function (regions) {
            res.json(regions);
        }).catch(serverErrorJson(res));
    } else if (req.query.points) {
        regions.listByIntersections(req.ctx, params2JsonPoints(req.query.points))
        .then(function (regions) {
            res.json(regions);
        }).catch(serverErrorJson(res));
    }
});

api.post('/pm25/subscriptions', function(req, res) {
    subscriptions.subscribe(req.ctx, req.body).then(function(result) {
        var sub_id = result.generated_keys || result.existing_keys;
        if (sub_id && sub_id.length) {
            sub_id = sub_id[0];
        }
        res.json({result: 'success', message: res.__('subscribe.'+req.body.type+'.success'), subscription_id: sub_id});
    }).catch(serverErrorJson(res));
});

api.delete('/pm25/subscriptions', function(req, res) {
    subscriptions.unsubscribe(req.ctx, req.body).then(function(result) {
        res.json({result: 'success', message: res.__('unsubscribe.success'), subscription_ids: result.existing_keys});
    }).catch(serverErrorJson(res));
});

api.get('/pm25/*', function(req, res) {
    notFoundJson(res)();
});


db.connect(config.rethinkdb).then(function (db) {
    stations.setDatabase(db);
    stations.setAqi(config.aqi);
    regions.setDatabase(db);
    regions.setAqi(config.aqi);
    regions.setGeoip(config.geoip);
    regions.setCapitals(config.capitals);
    subscriptions.setDatabase(db);
    subscriptions.setMailchimp(config.mailchimp);
    summary.setDatabase(db);
    data.setDatabase(db);

    app.listen(config.port, function () {
        console.log('Server listening on port ' + config.port);
    });
    api.listen(config.api_port, function () {
        console.log('API listening on port ' + config.api_port);
    });  
});

function createContext(req) {
    req.ctx = {
        debug: config.debug,
        ip: config.debug ? config.test_ip : req.ip,
        locale: req.locale,
        country_code: req.country_code
    };
}

function notFound(res) {
    return function(result) {
        res.status(404);
        res.render('404');
    };
}

function serverError(res) {
    return function(result) {
        res.status(500);
        res.render('500', {cause: result.stack});
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
        res.json({result: 'failed', message: res.__('server.error'), cause: result.stack});
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

function params2JsonPoints(params) {
    var points = [];
    for (var param of params) {
        var point = param.split(',');
        points.push({latitude: Number.parseFloat(point[0]), longitude: Number.parseFloat(point[1])});
    }
    return points;
}
