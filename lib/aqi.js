'use strict';

var aqiTable = require('../data/aqiTable.json');

function AQI() {}

AQI.prototype = {};

/* 
 * public functions 
 */

AQI.prototype.getAQIStatus = function (ctx, index, countryCode) {
    var scale = getAQIScale(countryCode);
    if (!isNumeric(index) || index < 0) {
        return 'invalid';
    } else if (index <= scale[0]) {
        return 'low';
    } else if (index <= scale[1]) {
        return 'moderate';
    } else if (index <= scale[2]) {
        return 'high';
    } else {
        return 'extreme';
    }
}

AQI.prototype.getAQIStatusText = function(ctx, index, countryCode) {
    var i18n = require('i18n');
    i18n.setLocale(ctx.locale);
    var scale = getAQIScale(countryCode);
    if (!isNumeric(index) || index < 0) {
        return i18n.__('aqi.status.invalid');
    } else if (index <= scale[0]) {
        return i18n.__('aqi.status.low');
    } else if (index <= scale[1]) {
        return i18n.__('aqi.status.moderate');
    } else if (index <= scale[2]) {
        return i18n.__('aqi.status.high');
    } else {
        return i18n.__('aqi.status.extreme');
    }
}

/* 
 * private functions 
 */

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function getAQIScale (countryCode) {
    if (aqiTable[countryCode]) {
        return aqiTable[countryCode];
    } else {
        return aqiTable['default'];
    }
}

module.exports = new AQI();
