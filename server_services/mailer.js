var nodemailer = require('nodemailer');

// Define global mail actions:
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: '',
    pass: ''
  }
});

var sendMail = function(from, to, subject, body) {
  var mailOptions = {
    from: from,
    to: to,
    subject: subject,
    html: body
  };

  transporter.sendMail(mailOptions, function(err, info) {
    if (err) {
      res.status(500).send({ error: err });
    } else {
      res.json({ok: "OK"});
    }
  });
};

// Mail Sending Methods
module.exports = {
  sendContactMail: function(from, type, message) {
    var subject = "Formulaire de contact";
    var body = "Message de " + from.username + " (" + from.email + ")<br>" + type + "<br>" + message;
    sendMail(from.email, "Expediteur", subject, body);
  }
}
