var express               = require('express');
var app                   = express();                              // create our app w/ express
var mongoose              = require('mongoose');                    // mongoose for mongodb
var bodyParser            = require('body-parser');                 // pull information from HTML POST (express4)
var methodOverride        = require('method-override');             // simulate DELETE and PUT (express4)
var cluster               = require('cluster');
var sslRedirect           = require('heroku-ssl-redirect');
var numCPUs               = process.env.WEB_CONCURRENCY || 1;

var options = {
  server: {
    reconnectTries: Number.MAX_VALUE,
    socketOptions: {
      keepAlive: 120
    }
  },
  replset: {
    socketOptions: {
      keepAlive: 120
    }
  }
};

var staticdir = 'dist';
var port = process.env.PORT || 8080; // set our port

// SSL redirect for production (default)
if (process.env.NODE_ENV === 'production') {
  app.use(sslRedirect(['production'], 301));
}

mongoose.Promise = global.Promise;
var db = mongoose.connect('mongodb URL', options);

app.use(express.static(__dirname + '/' + staticdir));
app.use(bodyParser.urlencoded({'extended': 'true'}));            // parse application/x-www-form-urlencoded
app.use(bodyParser.json());                                     // parse application/json
app.use(bodyParser.json({type: 'application/vnd.api+json'})); // parse application/vnd.api+json as json
app.use(methodOverride());

var fs = require("fs");

// API routes
var routePath = "./routes/";
fs.readdirSync(routePath).forEach(function (file) {
  var route = routePath + file;
  require(route)(app, db);
});
// Fallback API Route
app.get("/api/*", function (req, res) {
  res.status(404).send({error: "METHOD_NOT_FOUND"});
});
// Front-end route
app.get("/*", function (req, res) {
  res.sendFile(__dirname + '/' + staticdir + "/index.html");
});

// Clustering
if (cluster.isMaster) {
  console.log('Master' + process.pid  + 'is running');
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', function(worker, code, signal) {
    console.log('worker' + worker.process.pid + 'died');
  });
} else {
  // Starting the server
  app.listen(port, function () {
    console.log('Starting sever on port ' + port);
  });
  console.log('Worker' + process.pid + 'started');
}
exports = module.exports = app;
