$('select').material_select();
$('.modal-trigger').leanModal();

var REFRESH = 60 * 10 * 1000;
var ISO_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';

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
    return '建議：正常戶外活動。';
  } else if (index <= 53) {
    return '建議：有心臟、呼吸道及心血管疾病的成人與孩童感受到癥狀時，應考慮減少體力消耗，特別是減少戶外活動。';
  } else if (index <= 70) {
    return '建議：<ol><li>有心臟、呼吸道及心血管疾病的成人與孩童，應減少體力消耗，特別是減少戶外活動。</li><li>老年人應減少體力消耗。</li><li>3. 具有氣喘的人可能需增加使用吸入劑的頻率。</li></ol>';
  } else {
    return '建議：<ol><li>有心臟、呼吸道及心血管疾病的成人與孩童，以及老年人應避免體力消耗，特別是避免戶外活動。</li><li>具有氣喘的人可能需增加使用吸入劑的頻率。</li></ol>';
  }
}

if (typeof did !== 'undefined' && did != '') {
  var api = 'http://nrl.iis.sinica.edu.tw/LASS/history-hourly.php?device_id=' + did;
  $.get(api, function (data) {
    var feeds = $.parseJSON(data)['feeds'];
    var latest = feeds[feeds.length - 1];
    var pm25 = latest['PM2_5'];
    $('#latest-pm25').text(pm25).attr('class', getDAQIStatus(pm25));
    moment.locale('zh-tw');
    $('#latest-status').text(getDAQIStatusText(pm25));
    $('#latest-time').text(moment(latest['timestamp'], ISO_FORMAT).fromNow());
    moment.locale('en');
  });
} else {
  //No device id
}
