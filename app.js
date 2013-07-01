
/**
 * Module dependencies
 */

var express = require('express'),
  routes = require('./routes'),
  http = require('http'),
  path = require('path'),
  fs = require('fs'),
  mkdirp = require('mkdirp');

var app = module.exports = express();


/**
 * Configuration
 */

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);

// development only
app.configure('development', function() {
	app.use(express.errorHandler());
});

// production only
app.configure('production', function() {
	// TODO
});


var getPathTokens = function (params) {
	var path = params[0];
	var tokens = path.split('/');
	
	if (tokens[0] === '') {
		tokens[0] = 'root';
	}

	return tokens;
};

var getFilePath = function (params) {
	var tokens = getPathTokens(params); 
	var filepath = path.join(__dirname, 'public', 'data');

	for (var i=0; i < tokens.length; i++) {
		filepath = path.join(filepath, tokens[i]);
	}

	// This is a simple security measure, so someone
	// can't just type in, say, .htaccess and proceed
	// to mess with your server. This is not intended 
	// to lock-in a particular format.
	filepath = filepath +'.txt';

	return filepath;
};

app.get('/data/*', function (req, res) {

	var filepath = getFilePath(req.params);
	fs.exists(filepath, function (exists) {
		if (exists) {
			res.set('Content-Type', 'text/html');
			res.sendfile(filepath);
		}
		else {
			res.send(202, "Go ahead."); // Accepted
		}
	});
});


// Save the note data to the path specified.
app.put('/data/*', function (req, res) {
	var data = req.body.note;
	
	var handleCallback = function (error) {
		if (error) {
			console.log(error);
			res.send(500);
		}
		else {
			res.send(204); // No Content
		}
	};

	var saveFile = function (filepath, callback) {
		fs.writeFile(filepath, data, callback);
	}

	if (data) {
		var filepath = getFilePath(req.params);

		fs.exists(filepath, function (exists) {
			if (exists) {
				saveFile(filepath, handleCallback);
				return;
			}

			mkdirp(path.dirname(filepath), function (error) {
				if (error) {
					handleCallback(error);
					return;
				}
				saveFile(filepath, handleCallback);
			});
		});
	}
});

// The secret to bridging Angular and Express in a 
// way that allows us to pass any path to the client.
app.get('*', routes.index);


/**
 * Start Server
 */
http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
