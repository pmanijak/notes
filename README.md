notes
=====
Save plain-text notes to your Node.js server as you type. 

how?
-----
	npm install
	node app.js

	http://server:3000

why?
----------
I wanted a simple app to sync notes between computers, without the distractions of Google Docs, and without installing software beyond Node.js on my server.

what?
----------
* Notes are in plain text.
* Notes are saved automatically.
* Notes are saved to your Node.js server, in the data folder. 
* Link to notes within notes like /this. 
* Link to websites, too, by just typing the address.
* Organize your notes /like/this.
* A demo is at [http://notes.jit.su](http://notes.jit.su).
* Mobile isn't supported. It sort of works, in a pinch.

security
-----------
* Security is off by default. 
* Turn it on by setting the AUTHCODE environment variable, and restarting the software.
* The authcode is meant to prevent casual vandalism. It's like locking your car doors, but
keeping your book in the back seat in plain view.

roadmap
------------
* Notes is complete. There are no plans for new features.
* Notes might be polished from time to time.
* Notes components might be reused in other projects.
* Forking and creating your own, personalized Notes is encouraged.

decisions
----------
* No history. Only the present note is important. Use backups to prevent data loss.
* Realtime syncing is not a priority. This was not created with collaborative notes in mind.
* Cookies are used for maintaining active sessions with the server, expiring after 6 months.
* Decisions were made with the idea of only one person using the notes in mind.
* Notes are public, because this isn't meant to be used on anything so important that it must remain secret.

acknowledgements
-----------------
Thank you to the makers of AngularJS, Node.js, Express, and Ace.

license
------------
BSD.
