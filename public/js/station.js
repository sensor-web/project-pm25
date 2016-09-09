'use strict';

(function () {
    var $pm25 = $('#latest-pm25');
    var $modal = $('.subscribe-modal');

    $('.modal-trigger').leanModal();
    $('.subscribe').click(function(e) {
        ga('send', 'event', 'data', 'subscribe', 'pm25');
    });
    $('.subscribe-form').submit(function(e) {
        var $form = $(this);
        if (!validateCoords($form)) {
            return false;
        }
        $.post($form.attr('action'), 
            formDataArrayToJson($form.serializeArray()),
            function(result) {
                if ('success' == result.result) {
                    $modal.each(function () {
                        $(this).closeModal();
                    });
                }
                Materialize.toast(result.message, 5000);
            }, 'json'
            );
        ga('send', 'event', 'data', 'submit-subscription', 'pm25');
        return false;
    });
    $('.sub-email').on('blur', function() {
        ga('send', 'event', 'sensor-form', 'email-change', 'pm25');
    });
    $('.sub-name').on('blur', function() {
        ga('send', 'event', 'sensor-form', 'name-change', 'pm25');
    });
    $('.sub-freq').on('change', function() {
        ga('send', 'event', 'sensor-form', 'freq-change', 'pm25');
    });
    $('.sub-reason').on('change', function() {
        ga('send', 'event', 'sensor-form', 'reason-change', 'pm25');
    });
    $('.sub-reason-join').on('blur', function() {
        ga('send', 'event', 'sensor-form', 'reason-join-change', 'pm25');
    });
    $('#state-rank li a').click(function () {
        ga('send', 'event', 'state-rank-stations', 'click', $(this).find('.location').text());
    });
    $('#country-rank li a').click(function () {
        ga('send', 'event', 'country-rank-stations', 'click', $(this).find('.location').text());
    });
    $('.marked').click(function() {
        ga('send', 'event', 'pm25-tip', 'click', 'pm2.5 text');
        $('#pm25-modal').openModal();
    });
    $('.question-mark').click(function() {
        ga('send', 'event', 'pm25-tip', 'click', 'question mark');
        $('#pm25-modal').openModal();
    });
})();