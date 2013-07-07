// A simple server for saving plain text to files,
// and reading them again, from time to time.

var express = require('express'),
	routes = require('./routes'),
	http = require('http'),
	path = require('path'),
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	ncp = require('ncp').ncp,
	uuid = require('node-uuid'),
	settings = require('./config/settings.js');


var app = module.exports = express();

var datadir = path.join(__dirname, 'data');
var statedir = path.join(__dirname, 'state');
mkdirp.sync(statedir);

var extension = '.txt';
var rootFilename = 'root';

// Windows: iisnode restarts all the time, so we'll want 
// a cookie secret that doesn't change from instance to instance.
var cookieSecret = function() {
	var secret;
	var cookieSecretPath = path.join(statedir, 'cookieSecret');
	var wasCookieCreated = false;

	if (fs.existsSync(cookieSecretPath)) {
		secret = fs.readFileSync(cookieSecretPath).toString();
	}
	else {
		secret = uuid.v4();
		fs.writeFileSync(cookieSecretPath, secret);
		wasCookieCreated = true;
	}

	return {
		wasCreated: wasCookieCreated,
		data: secret
	}
}(); // closure


// all environments
app.set('port', settings.port());
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser(cookieSecret.data));
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
var activeSessions = function () {

	var sessions = {};
	var sessionsPath = path.join(statedir, 'sessions.json');

	// We assume that there is only one instance of Node running
	// at a time. If that's true, we don't have to worry about 
	// multiple threads writing to the sessions file at once.
	var saveSessions = function () {
		fs.writeFileSync(sessionsPath, JSON.stringify(sessions))
	};

	var getSavedSessions = function () {
		var noSessions = {};

		if (fs.existsSync(sessionsPath)) {
			return JSON.parse(fs.readFileSync(sessionsPath));
		}
		else {
			return noSessions;
		}
	};

	var getSession = function (sessionId) {
		return sessions[sessionId];
	};

	var setSession = function (sessionId, session) {
		sessions[sessionId] = session;
		saveSessions();
	};

	var deleteSession = function (sessionId) {
		delete sessions[sessionId];
		saveSessions();
	};

	// Load our active sessions from disk on startup.
	// If a new cookie secret was created, that means
	// that all of our old sessions are invalid.
	if (cookieSecret.wasCreated) {
		sessions = {};
		saveSessions();
	}
	else {
		sessions = getSavedSessions();
	}

	return {
		get: getSession,
		set: setSession,
		'delete': deleteSession
	};
}(); // closure


var cookieSessionKey = 'insecure-nonsense';

var createSessionCookie = function (req, res) {
	var cookieDomain = req.host === "localhost" ? null : req.host;
	var oneMinute = 60 * 1000;
	var oneHour = 60 * oneMinute;
	var oneDay = 24 * oneHour;
	var sixMonths = 182 * oneDay;
	var oneYear = 365 * oneDay;

	var sessionId = uuid.v4();

	var cookieOptions = {
		domain: cookieDomain,
		maxAge: sixMonths,
		httpOnly: true,
		signed: true
	};

	var session = {
		created: Date.now(),
		expires: Date.now() + cookieOptions.maxAge
	};

	activeSessions.set(sessionId, session);
	res.cookie(cookieSessionKey, sessionId, cookieOptions);
};

var updateSessionCookie = function (sessionId, req, res) {
	var session = activeSessions.get(sessionId);

	var lastUsedMoreThanOneDayAgo = function (session) {
		var oneDay = 24 * 60 * 60 * 1000;
		return ((Date.now() - session.created) > oneDay);
	}

	// TODO: This may be a premature optimization.
	// I clearly do not understand the performance costs
	// of creating a new cookie. Why not make a new
	// cookie with each request? 
	// 
	// The only reason I am doing this is because the idea 
	// of throwing out a cookie after one bite seems like 
	// a waste of cookies.
	//
	// Also, is rolling-cookie-auth a silly idea? I guess
	// it prevents old session ids from being used, but
	// once you have an active session id, you're all set
	// until the server is restarted.
	//
	// In other words, we probably want to have a 
	// rolling-expiration of two months and a hard
	// always-expire after something like six months, 
	// but frankly this is good enough for now.
	if (session && lastUsedMoreThanOneDayAgo(session)) {
		createSessionCookie(req, res);
		// remove the old session.
		activeSessions.delete(sessionId);
	}
};

var isActiveSession = function (sessionId) {
	return activeSessions.get(sessionId);
};

var permissions = function (req, res, next) {
	req.permissions = {
		read: true,
		write: false
	};

	// If there's no authcode set, everyone can write.
	if (!settings.authcode()) {
		req.permissions.write = true;
		// TODO: Probably clear active sessions, too, 
		// but maybe that doesn't matter since we have
		// to reset the server anyway to set the authcode,
		// which in turn invalidates all the cookies.
	}
	else {
		var sessionId = req.signedCookies[cookieSessionKey];
		// If our cookie has expired, sessionId will be false-y,
		// though this can be faked, I guess.
		if (sessionId && isActiveSession(sessionId)) {
			var session = activeSessions.get(sessionId);
			if (session.expires > Date.now()) {
				req.permissions.write = true;
				updateSessionCookie(sessionId, req, res);
			}
		}
	}

	next();
};


app.post("/_/auth", function (req, res) {
	var data = req.body;

	var isAuthorized = function (authcode) {
		if (!settings || !settings.authcode()) {
			return true;
		}

		return settings.authcode() === authcode;
	};

	if (isAuthorized(data.authcode)) {
		createSessionCookie(req, res);
		res.send(200); // ok. cookie is content.
	}
	else {
		res.send(401);
	}
});

app.get("/_/permissions", permissions, function (req, res) {
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

app.get('/_/notes-at/*', function (req, res) {

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
			// TODO: Maybe denote something as a directory in some way.
			if (path.extname(file) === extension) {
				basename = path.basename(file, extension);
				isPathValid = (basename !== rootFilename);
			}
			else {
				basename = path.basename(file);
				isPathValid = true;
			}

			if (isPathValid && notes.indexOf(basename) < 0) {
				notes.push(basename);
			}
		}

		res.send(notes);
	});
});

app.get('/_/data/*', function (req, res) {

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
app.put('/_/data/*', permissions, function (req, res) {
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
