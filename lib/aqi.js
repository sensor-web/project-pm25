'use strict';

var aqiTable = require(__dirname + '/../data/aqiTable.json');

function AQI() {}

AQI.prototype = {};

/* 
 * public functions 
 */
AQI.prototype.setI18n = function (i18n) {
    this._i18n = i18n;
};

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
};

AQI.prototype.getAQIStatusText = function(ctx, index, countryCode) {
    var scale = getAQIScale(countryCode);
    if (!isNumeric(index) || index < 0) {
        return this._i18n.__({phrase: 'aqi.status.invalid', locale: ctx.locale});
    } else if (index <= scale[0]) {
        return this._i18n.__({phrase: 'aqi.status.low', locale: ctx.locale});
    } else if (index <= scale[1]) {
        return this._i18n.__({phrase: 'aqi.status.moderate', locale: ctx.locale});
    } else if (index <= scale[2]) {
        return this._i18n.__({phrase: 'aqi.status.high', locale: ctx.locale});
    } else {
        return this._i18n.__({phrase: 'aqi.status.extreme', locale: ctx.locale});
    }
};

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
