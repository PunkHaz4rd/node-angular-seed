var session               = require('express-session');
var passport							= require('passport');
var passportLocalMongoose	= require('passport-local-mongoose');
var localStrategy					= require('passport-local' ).Strategy;
var bcrypt                = require('bcrypt-nodejs');
var mailer                = require('../server_services/mailer');
var verifyCaptcha         = require('../server_services/verifyCaptcha');

// Routes for User management
module.exports = function(app, mongoose) {

  // User initialisation
  var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

  var user = new Schema({
    username: {
      type: String,
      required: "USERNAME_REQUIRED",
      unique: true
    },
    password: {
      type: String,
      select: true
    },
    email: {
      type: String,
      trim: true,
      unique: true,
      required: "EMAIL_REQUIRED",
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "INVALID_EMAIL"]
    },
    token: String,
    tokenExpire: Date
  });
  user.plugin(passportLocalMongoose);
  mongoose.model('User', user);

  var User = mongoose.model('User');

  app.use(session({
    secret: 'SecretChangeMe',
    resave: true,
    saveUninitialized: true
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  passport.use(new localStrategy(User.authenticate()));
  passport.serializeUser(User.serializeUser());
  passport.deserializeUser(User.deserializeUser());

  // Routing
  app.post('/register', function(req, res, next) {
    verifyCaptcha(req.body["g-recaptcha-response"], function(success) {
      if (success) {
        User.register(new User({ username : req.body.username, email: req.body.email }), req.body.password, function(err, account) {
          if (err) {
            return res.status(409).send({	error: err });
          } else {
            passport.authenticate('local', function(err, user, info) {
              if (err) {
                return next(err);
              }
              if (!user) {
                return res.status(401).send({ error: info });
              }
              req.logIn(user, function(err) {
                if (err) {
                  return res.status(500).json({ error: "LOGIN_FAILED" });
                } else {
                  res.status(201).send({ user: user });
                }
              });
            })(req, res, next);
          }
        });
      } else {
        res.status(401).send({ error: "CAPTCHA_NOT_VERIFIED" });
      }
    });
  });

  app.post('/login', function(req, res, next) {

    passport.authenticate('local', function(err, user, info) {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).send({ err: "USER_NOT_FOUND" });
      } else {
        req.logIn(user, function(err) {
          if (err) {
            return res.status(500).send({ err: "LOGIN_FAILED" });
          } else {
            res.json({ user: user });
          }
        });
      }
    })(req, res, next);
  });

  app.get('/logout', function(req, res) {
    req.logout();
    res.sendStatus(200);
  });

  app.get('/user', function(req, res) {
    if (!req.isAuthenticated()) {
      return res.status(401).send({ user: null });
    } else {
      res.json({
        user: req.user
      });
    }
  });

  app.put('/password', function(req, res) {
    if (!req.isAuthenticated()) {
      return res.status(401).send({ error: "NOT_CONNECTED" });
    } else {
      if (!req.body.passwordOld) {
        return res.status(400).send({ error: "ENTER_OLD_PASSWORD" });
      } else if (!req.body.passwordNew) {
        return res.status(400).send({ error: "ENTER_PASSWORD" });
      } else if (!req.body.passwordNewRepeat) {
        return res.status(400).send({ error: "ENTER_NEW_PASSWORD" });
      } else if (req.body.passwordNew !== req.body.passwordNewRepeat) {
        return res.status(400).send({ error: "CONFIRM_NEW_PASSWORD" });
      } else {
        req.user.setPassword(req.body.passwordNew, function(err, user) {
          if (err) {
            return res.status(500).send({ error: "UNKNOWN_SERVER_ERROR" });
          } else {
            return res.json({ changedPassword: user });
          }
        });
      }
    }
  });

  app.post('/reset-password', function(req, res) {
    verifyCaptcha(req.body["g-recaptcha-response"], function(success) {
      if (success) {
        if (!req.body.username) {
          res.status(401).send({error: "USERNAME_REQUIRED"});
        }
        if (!req.body.email) {
          res.status(401).send({error: "EMAIL_REQUIRED"});
        }
        User.findOne({'username': req.body.username, 'email': req.body.email}, function(err, user) {
          if (err) {
            res.status(500).send({ error: "UNKNOWN_SERVER_ERROR" });
          } else if (!user) {
            res.status(404).send({ error: "USER_NOT_FOUND" });
          } else {
            require('crypto').randomBytes(48, function(err, buffer) {
              var token = buffer.toString('hex');
              user.token = token;
              user.tokenExpire = Date.now() + 3600000;
              user.save(function(err) {
                mailer.sendResetPasswordMail('fr', user.email, token);
                res.json({ ok: "OK" });
              });
            });
          }
        });
      } else {
        res.status(401).send({ error: "CAPTCHA_NOT_VERIFIED" });
      }
    });
  });

  app.post('/reset-password/:token', function(req, res) {
    if (!req.body.newPassword) {
      return res.status(400).send({ error: "ENTER_PASSWORD" });
    }
    if (!req.body.newPasswordRepeat) {
      return res.status(400).send({ error: "ENTER_NEW_PASSWORD" });
    }
    if (req.body.newPassword !== req.body.newPasswordRepeat) {
      return res.status(400).send({ error: "CONFIRM_NEW_PASSWORD" });
    }
    User.findOne({token: req.params.token, tokenExpire: { $gt: Date.now() } }, function(err, user) {
      if (err) {
        res.status(500).send({ error: "UNKNOWN_SERVER_ERROR" });
      } else if (!user) {
        res.status(404).send({ error: "INVALID_TOKEN" });
      } else {
        user.setPassword(req.body.newPassword, function(err, user) {
          if (err) {
            return res.status(500).send({ error: "UNKNOWN_SERVER_ERROR" });
          } else {
            return res.json({ changedPassword: user });
          }
        });
      }
    });
  });

  app.get('/user/:username', function(req, res) {
    User.find({'username': req.params.username}).select({'_id': 0, 'password': 0, 'email': 0}).exec(function(err, user) {
      if (err) {
        return res.status(500).send({ error: "UNKNOWN_SERVER_ERROR" });
      } else if (!user) {
        return res.status(404).send({ error: "USER_NOT_FOUND" });
      } else {
        res.json(user);
      }
    });
  });
};
