var https									= require('https');
var reCaptchaSecret				= "";

module.exports = function(key, callback) {
  https.get("https://www.google.com/recaptcha/api/siteverify?secret=" + reCaptchaSecret + "&response=" + key, function(res) {
    var data = "";
    res.on('data', function (chunk) {
      data += chunk.toString();
    });
    res.on('end', function() {
      try {
        var parsedData = JSON.parse(data);
        callback(parsedData.success);
      } catch (e) {
        console.log(e);
        callback(false);
      }
    });
  });
};
