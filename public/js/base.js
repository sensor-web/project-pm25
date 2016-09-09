'use strict';

function getGeolocation() {
    return new Promise(function(resolve, reject) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                resolve(position.coords);
            }, function() {
                reject('Browser unable to get current location');
            });
        } else {
            reject('Browser doesn\'t support Geolocation');
        }
    });
}

function points2Query(points) {
    var result = '';
    var conj = '';
    for (var point of points) {
        result += conj + 'points='+point.lat.toString()+','+point.lng.toString();
        conj = '&';
    }
    return result;
}

function validateCoords($form) {
    var $lat = $form.find('.sub-lat');
    var $lng = $form.find('.sub-lng');
    var $error = $form.find('.coords-error');
    if (1 == $lat.length && 1 == $lng.length && '' == $lat.val() && '' == $lng.val()) {
        $error.show();
        return false;
    }
    $error.show();
    return true;
}

function formDataArrayToJson(array) {
    var json = {}
    $(array).each(function(index, elem) {
        if (undefined != json[elem.name]) {
            if (Array.isArray(json[elem.name])) {
                json[elem.name].push(elem.value);
            } else {
                json[elem.name] = [json[elem.name], elem.value];
            }
        } else {
            json[elem.name] = elem.value;
        }
    });
    return json;
}

(function () {
    $('select').material_select();
    $('#lang-select').change(function (e) {
        Cookies.set("locale", this.value);
        window.location.reload();
    });
    moment.locale(LOCALE);
    $('.button-collapse').sideNav();
})();
