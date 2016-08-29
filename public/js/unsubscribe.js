(function () {
	var $form = $('#unsubscribe-form');
	var $content = $('#unsubscribe-content');
	var errorMessage = '抱歉，網站發生錯誤，請稍候再試。';
	$form.submit(function (e) {
		$.ajax({
			url: $form.attr('action'), 
			type: 'DELETE',
			data: formDataArrayToJson($form.serializeArray()),
			dataType: 'json',
			success: function(result) {
				var message = 'success' == result.result ? '已成功取消訂閱！' : errorMessage;
				$content.html('<h2>'+message+'</h2>');
			}, error: function (error) {
				$content.html('<h2>'+errorMessage+'</h2>');
			}
		});
		ga('send', 'event', 'data', 'submit-unsubscription', 'pm25');
		return false;
	});
})();