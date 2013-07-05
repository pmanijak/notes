// A simple server for saving plain text to files,
// and reading them again, from time to time.

var express = require('express'),
	routes = require('./routes'),
	http = require('http'),
	path = require('path'),
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	ncp = require('ncp').ncp,
	uuid = require('node-uuid');

var app = module.exports = express();

var datadir = path.join(__dirname, 'data');
var extension = '.txt';
var rootFilename = 'root';
// TODO: This creates a well-sealed cookie, but all 
// cookies become invalid upon server restart. So,
// is that a big deal? What do you think?
var cookieSealant = uuid.v4();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser(cookieSealant));
app.use(express.methodOverride());
app.use(app.router);

// development only
app.configure('development', function() {
	app.use(express.errorHandler());
});

// production only
app.configure('production', function () {
	// Copy files from ./config/notes-data to ./data
	var initialNotesDataDir = path.join(__dirname, 'config', 'notes-data');
	fs.exists(datadir, function (exists) {
		// Only do this if there isn't a data dir already.
		if (!exists) {
			var options = {
				clobber: false
			};
			ncp(initialNotesDataDir, datadir, options, function (err) {
				if (err) {
					console.log("Failure during initial-notes data copy.");
					console.log(err);
				}
			});
		}
	});
});

//-----------------------------------------------------------
// Auth
//
var activeSessionIds = {};
var cookieSessionKey = 'insecure-nonsense';

var setPermissionsCookie = function (req, res) {
	var cookieDomain = req.host === "localhost" ? null : req.host;
	var oneMinute = 60 * 1000;
	var oneHour = 60 * oneMinute;
	var oneYear = 365 * 24 * oneHour;

	var sessionId = uuid.v4();

	var cookieOptions = {
		domain: cookieDomain,
		maxAge: oneHour,
		httpOnly: true,
		signed: true
	};

	res.cookie(cookieSessionKey, sessionId, cookieOptions);
};

var isActiveSession = function (sessionId) {
	// TODO: work in progress
	return true;
};

var permissions = function (req, res, next) {
	req.permissions = {
		read: true,
		write: false
	};

	// If there's no authcode set, everyone can write.
	if (!config.authcode) {
		req.permissions.write = true;
		// TODO: Probably clear active sessions, too, 
		// but maybe that doesn't matter.
	}
	else {
		var sessionId = req.signedCookies[cookieSessionKey];
		if (sessionId && isActiveSession(sessionId)) {
			// TODO: New cookie after the active session has been around for a while.
			req.permissions.write = true;
		}
	}

	next();
};


app.post("/auth", function (req, res) {
	var data = req.body;

	var isAuthorized = function (authcode) {
		if (!config || !config.authcode) {
			return true;
		}

		return config.authcode === authcode;
	};

	if (isAuthorized(data.authcode)) {
		setPermissionsCookie(req, res);
		res.send(200); // ok. cookie is content.
	}
	else {
		res.send(401);
	}
});

app.get("/permissions", permissions, function (req, res) {
	res.send(req.permissions);
	res.send(200);
});

// end Auth
//-------------------------------------------------------------------


var isRootDataFilename = function (filename) {
	var rootDataFilename = path.join(datadir, rootFilename + extension);
	return rootDataFilename === filename;
};

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
app.put('/data/*', permissions, function (req, res) {
	if (!req.permissions.write) {
		res.send(401); // unauthorized
		return;
	}

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
	};

	var deleteFile = function (filepath, callback) {
		fs.unlink(filepath, function (error) {
			if (error) {
				callback(error);
			}
			else {
				// If our directory is empty now, delete that too.
				var deleteEmptyParentDirs = function (startpath) {
					var parentDirname = path.dirname(startpath);
					if (parentDirname === datadir) {
						// If we get to the data directory, we're done.
						callback();
					}
					else {
						fs.readdir(parentDirname, function (error, files) {
							if (error) {
								console.log("Error reading a directory during delete operation: " + parentDirname);
								callback(err);
							}
							else if (files.length === 0) {
								fs.rmdir(parentDirname, function (error) {
									if (error) {
										callback(error);
									}
									else {
										// recursive.
										deleteEmptyParentDirs(parentDirname);
									}
								});
							}
							else {
								// done.
								callback();
							}
						});
					}
				};

				deleteEmptyParentDirs(filepath);
			}
		});
	};

	var isDataEmpty = function (d) {
		return d === "";
	};

	// Save or delete the file, depending on 
	// whether the data we get is empty.
	if (data || data === "") {
		var filepath = getFilePath(req.params);

		fs.exists(filepath, function (exists) {
			if (exists) {
				if (data === "" && !isRootDataFilename(filepath)) {
					deleteFile(filepath, handleCallback);
				}
				else {
					saveFile(filepath, handleCallback);
				}
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
