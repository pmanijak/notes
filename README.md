notes
=====
Save plain-text notes to your server as you type. 

how?
-----
	npm install
	node app.js

	http://server:3000

what?
----------
This is something to take notes. It was created for use on 
desktops and laptops. In other words, it might not work on an iPad. 
The only requirement is nodejs.


what else?
-----------
* Link to other notes like /this.
* Proper URLs are also hyperlinked.
* There is a demo at [http://notes.jit.su](http://notes.jit.su)
* That's it.

security
-----------
* Security if off by default, because who cares?
* If you care a little bit, and want to have some security,
    * Put a plain-text authorization code in one of two places:
        1. The AUTHCODE environment variable, or
        2. The authcode var in /config/settings.js
    * Then restart the software, and you can enter this authcode in the obvious place. 
    * There are no usernames to specify.
* If you care a lot, maybe notes isn't what you're looking for.

roadmap
------------
* Not much else at this point. 
* Maybe add some sort of history thing.

license
------------
BSD
