//----------------------------------------------------
// settings.js
//
var port = process.env.PORT || 3000;
var authcode = process.env.AUTHCODE || "";

// Use an overrides file so we can have something
// for local testing that is otherwise ignored
// in our repo.
var overrides;
try {
	overrides = require('./settingsOverrides.js');
}
catch (err) { 
	// Don't worry about it.
	// Set overrides to 'false' to allow to use
	// the || operator in the exports, below.
	overrides = false; 
}

exports.port = function() {
	return overrides.port || port;
};

exports.authcode = function() {
	return overrides.authcode || authcode;
};
