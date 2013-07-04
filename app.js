
/**
 * Module dependencies
 */

var express = require('express'),
	routes = require('./routes'),
	http = require('http'),
	path = require('path'),
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	ncp = require('ncp').ncp;

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

var datadir = path.join(__dirname, 'data');

// production only
app.configure('production', function () {
	// Copy files from ./deploy/notes-data to ./data
	var initialNotesDataDir = path.join(__dirname, 'deploy', 'notes-data');
	fs.exists(datadir, function (exists) {
		// Only do this if there isn't a data dir already.
		if (!exists) {
			var options = {
				clobber: false
			}
			ncp(initialNotesDataDir, datadir, options, function (err) {
				if (err) {
					console.log("Failure during initial-notes data copy.");
					console.log(err);
				}
			});
		}
	});
});

var extension = '.txt';
var rootFilename = 'root';


var getPathTokens = function (params) {
	var path = params[0];
	var tokens = path.split('/');
	
	if (tokens[0] === '') {
		tokens[0] = rootFilename;
	}

	return tokens;
};



var getFilePath = function (params) {
	var tokens = getPathTokens(params); 
	var filepath = datadir;

	for (var i=0; i < tokens.length; i++) {
		filepath = path.join(filepath, tokens[i]);
	}

	// This is a simple security measure, so someone
	// can't just type in, say, .htaccess and proceed
	// to mess with your server. This is not intended 
	// to lock-in a particular format.
	filepath = filepath + extension;

	return filepath;
};

var getPathsInDirectory = function (dirname, callback) {
	fs.exists(dirname, function (exists) {
		if (!exists) {
			callback([]);
		}
		else {
			fs.readdir(dirname, function (err, files) {
				if (err) {
					// Not a big deal.
					console.log(err);
					callback([]);
				}
				else {
					callback(files);
				}
			});
		}
	})
};

app.get('/notes-at/*', function (req, res) {

	var notes = [];
	var basename, file, dirname, isPathValid;

	var filepath = getFilePath(req.params);
	if (path.basename(filepath, extension) === rootFilename) {
		// Special case for the root
		dirname = path.dirname(filepath);
	}
	else {
		dirname = filepath.slice(0, -extension.length);
	}

	getPathsInDirectory(dirname, function (files) {
		// Get the names of all the notes (which end with .txt)
		for (var i=0; i < files.length; i++) {
			file = files[i];
			// Directories are skipped.
			// TODO: Maybe denote something as a directory in some way.
			if (path.extname(file) === extension) {
				basename = path.basename(file, extension);
				isPathValid = (basename !== rootFilename);
			}
			else {
				basename = path.basename(file);
			}

			if (isPathValid && notes.indexOf(basename) < 0) {
				notes.push(basename);
			}
		}

		res.send(notes);
	});
});

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
			}
			else {
				mkdirp(path.dirname(filepath), function (error) {
					if (error) {
						handleCallback(error);
					}
					else {
						saveFile(filepath, handleCallback);
					}
				});
			}
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
