moment.locale('zh-tw');
var $pm25 = $('#latest-pm25');
var $modal = $('.subscribe-modal');
$pm25.attr('class', getDAQIStatus(Number.parseInt($pm25.text())));
$('#latest-status').html(getDAQIStatusText(Number.parseInt($pm25.text())));

$('.concentration-value').each(function() {
  var $this = $(this);
  $this.addClass(getDAQIStatus(Number.parseInt($this.text())));
});

$('.button-collapse').sideNav();
$('select').material_select();
$('.modal-trigger').leanModal();
$('.subscribe').click(function(e) {
  ga('send', 'event', 'data', 'subscribe', 'pm25');
});
$('.subscribe-form').submit(function(e) {
  var $form = $(this);
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

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getDAQIStatus(index) {
  if (!isNumeric(index) || index < 0) {
    return 'invalid';
  } else if (index <= 35) {
    return 'low';
  } else if (index <= 53) {
    return 'moderate';
  } else if (index <= 70) {
    return 'high';
  } else {
    return 'extreme';
  }
}

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
