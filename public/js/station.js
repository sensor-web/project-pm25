moment.locale('zh-tw');
var $pm25 = $('#latest-pm25');
var $modal = $('#subscribe-modal');
$pm25.attr('class', getDAQIStatus(Number.parseInt($pm25.text())));
$('#latest-status').html(getDAQIStatusText(Number.parseInt($pm25.text())));

$('.concentration-value').each(function() {
  var $this = $(this);
  $this.addClass(getDAQIStatus(Number.parseInt($this.text())));
});

$('select').material_select();
$('.modal-trigger').leanModal();
$('.modal-trigger').click(function() {
  var $header = $(this).attr('data-modal-header');
  var $type = $(this).attr('data-form-type');
  if ($header) {
    $('#modal-header').text($header);
  }
  if ($type) {
    $('#sub-type').val($type);
  }
});
$('#subscribe').click(function(e) {
  ga('send', 'event', 'data', 'subscribe', 'pm25');
});
$('#subscribe-form').submit(function(e) {
  var $form = $(this);
  e.preventDefault();
  $.post($form.attr('action'), 
    formDataArrayToJson($form.serializeArray()),
    function(result) {
      $modal.closeModal();
      var message = 'success' == result.result ? getSubscriptionMessage($('#sub-type').val()) : '抱歉，網站發生錯誤，請稍候再試。';
      Materialize.toast(message, 5000);
    }, 'json'
  );
  ga('send', 'event', 'data', 'submit-subscription', 'pm25');
});
$('#sub-email').on('blur', function() {
  ga('send', 'event', 'sensor-form', 'email-change', 'pm25');
});
$('#sub-name').on('blur', function() {
  ga('send', 'event', 'sensor-form', 'name-change', 'pm25');
});
$('#sub-freq').on('change', function() {
  ga('send', 'event', 'sensor-form', 'freq-change', 'pm25');
});
$('#sub-reason').on('change', function() {
  ga('send', 'event', 'sensor-form', 'reason-change', 'pm25');
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

function getDAQIStatusText(index) {
  if (!isNumeric(index) || index < 0) {
    return '資料錯誤';
  } else if (index <= 35) {
    return '<span class="marked">空氣品質指標良好</span>，可以正常戶外活動。';
  } else if (index <= 53) {
    return '<span class="marked">空氣品質指標適中</span>，有心臟、呼吸道及心血管疾病的成人與孩童應考慮減少戶外活動。';
  } else if (index <= 70) {
    return '<span class="marked">空氣品質指標危險</span>，任何人如果有不適，如眼痛，咳嗽或喉嚨痛等，應該考慮減少戶外活動。';
  } else {
    return '<span class="marked">空氣品質指標高危險</span>，任何人如果有不適，如眼痛，咳嗽或喉嚨痛等，應減少體力消耗，特別是減少戶外活動。';
  }
}

function getSubscriptionMessage(type) {
  var messageMap = {
    'region': '訂閱成功！我們將在空氣品質變糟時發出電子郵件通知。',
    'station': '訂閱成功！我們將在空氣品質變糟時發出電子郵件通知。',
    'buy_station': '訂閱成功！我們將在可購買時發出電子郵件通知。',
    'diy_station': '提交成功！若申請通過我們將透過電子郵件寄送 API 金鑰。',
    'new_station': '訂閱成功！我們將在附近有測站資料時發出電子郵件通知。'
  };
  return messageMap[type];
}