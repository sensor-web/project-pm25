(function () {
	var $form = $('#unsubscribe-form');
	var $content = $('#unsubscribe-content');
	$form.submit(function (e) {
		$.ajax({
			url: $form.attr('action'), 
			type: 'DELETE',
			data: formDataArrayToJson($form.serializeArray()),
			dataType: 'json',
			success: function(result) {
				$content.html('<h2>'+result.message+'</h2>');
			}, error: function (error) {
				console.log(error);
				$content.html('<h2>'+error.responseJSON.message+'</h2>');
			}
		});
		ga('send', 'event', 'data', 'submit-unsubscription', 'pm25');
		return false;
	});
})();