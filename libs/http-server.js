
var http = require('http');

var express = require('express');

exports.attach = function(irc) {
    var app = express(),
        server = http.createServer(app);

    //
    // Express app is exposed so you can do custom stuff if you want to
    // (may change this)
    //
    irc.app = app;
    irc.server = server;

    //
    // Block/unblock IP addresses with this middleware
    //
    app.use(function(req, res, next) {
        irc.db.query('SELECT api_access.status FROM api_access WHERE api_access.ip_address = ? LIMIT 1', [ipAddress(req)],

        function(err, result) {
            if (err) {
                //
                // if (err.code === 'ER_NO_DB_ERR') { /* implement default behavior */ }
                //
                return res.json(500, {
                    ok: false,
                    message: err.message
                });
            }
            if (result.length < 1) {
				irc.db.query("INSERT INTO api_access VALUES ('', ?, ?)", [ipAddress(req), 'open'], function (error) {
					if (error) {
						return res.json(500, {
		                    ok: false,
		                    message: error
		                });
					}
				});
			}
			
			else if ((result.length > 0) && (result[0].status == 'blocked')) {
                return res.json(403, {
                    ok: false,
                    message: 'Access denied!'
                });
            }
            next();
        })
    });
    app.use(app.router);

    //
    // Use this to add an http endpoint to the HTTP API
    //
    irc.addEndpoint = function(route, callback) {
        app.get(route, express.bodyParser(), function(req, res) {

            var options = {};

            copy(req.body);
            copy(req.query);
            copy(req.params);

            function copy(o) {
                Object.keys(o).forEach(function(k) {
                    if (typeof options[k] === 'undefined') {
                        options[k] = o[k];
                    }
                });
            }

            try {
				
                callback(irc, options);
            } catch (err) {
                res.json(500, {
                    ok: false,
                    message: err.message
                });
            }

            res.json({
                ok: true
            });
        });
    }

    //
    // Stupid helper for extracting IP addresses from the req object
    //
    function ipAddress(req) {
        //
        // You need to check req.headers if you're behind a proxy, but if you're
        // NOT behind a proxy it's an easy way to spoof your address.
        //
        var proxy = false,
            forwardedFor,
            sock;

        if (proxy) {
            forwardedFor = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"];

            if (forwardedFor) {
                return forwardedFor;
            }
        }

        //
        // Basically copypasta from
        // https://github.com/senchalabs/connect/blob/master/lib/middleware/logger.js#L297-L306
        //
        if (req.ip) {
            return req.ip;
        }
        sock = req.socket;
        if (sock.socket) {
            return sock.socket.remoteAddress;
        }
        return sock.remoteAddress;
    }
};