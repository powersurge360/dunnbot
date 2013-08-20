var sys = require('util'),
	net = require('net'),
	events = require('events'),
	fs = require('fs'),
	path = require('path'),
	user = require ('./user.js' ),
	channel = require('./channel.js'),
	mysql = require('mysql'),
	httpGet = require('./httpget'),
	httpServer = require('./http-server'),
	sugar = require('sugar');

var existsSync = fs.existsSync || path.existsSync;

var Server = exports.Server = function (config) {
	this.initialize(config);
};

sys.inherits(Server, events.EventEmitter);

Server.prototype.initialize = function (config) {
	this.host = config.host || '127.0.0.1';
	this.port = config.port || 6667;
	this.nick = config.nick || 'DunnBot';
	this.username = config.username || 'DunnBot';
	this.realname = config.realname || 'Powered by #webtech';
	this.command = config.command || '.';
	this.alias = config.alias || '?';
	this.admins = config.admins || [];
	this.ops = config.ops || [];
	this.devs = config.devs || [];
	this.userChannels = config.channels || [];

	// carry over config object to allow plugins to access it
	this.config = config || {};

	// channel constructor and channel hash
	this.channelObj = channel.Channel;
	this.channels = {};

	// user constructor and user hash
	this.userObj = user.User;
	this.users = {};

	// hook and callback arrays
	this.hooks = [];
	this.triggers = [];
	this.messagehandlers = {};
	this.replies = [];

	// MySQL connection stuffs
	if (config.mysql && config.mysql.host && config.mysql.port && config.mysql.user && config.mysql.password && config.mysql.database) {
		var connection = mysql.createConnection({
			host: config.mysql.host,
			port: config.mysql.port,
			user: config.mysql.user,
			password: config.mysql.password,
			database: config.mysql.database
		});
		connection.connect();
		this.db = this.mysql = connection;
	} else {
		this.db = this.mysql = false;
	}

	this.connection = null;
	this.buffer = "";
	this.encoding = "utf8";
	this.timeout = 60*60*1000;

	this.debug = config.debug || false;

	this.heap = [];

	this.httpGet = httpGet;

  httpServer.attach(this);

	/*
	* Hook for User/Channel inits
	*/
	if (typeof channel.initialize === "function") {
		channel.initialize(this);
	}
	if (typeof user.initialize === "function") {
		user.initialize(this);
	}

	/*
	* Boot Plugins
	*/
	this.plugins = [];
	var self = this;
	config.plugins.forEach(function(plugin) {
		self.loadPlugin(plugin);
	});
};

Server.prototype.sendHeap = function(err, send) {
	var https = require("https"), that = this;

	var reqdata = "contents="+encodeURIComponent(err)+"&private=true&language=Plain+Text";

	var req = https.request({
		host: "www.refheap.com",
		port: 443,
		path: "/api/paste",
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Content-Length": reqdata.length
		}
	}, function(res) {
		res.data = "";

		res.on("data", function(chunk) {
			res.data += chunk;
		}).on("end", function() {
			var data = JSON.parse(res.data);
			if(typeof send != "string") that.heap.push(data.url);
			else {
				that.send(send, "Error: "+data.url);
			}
		});
		}).write(reqdata);
	};

	Server.prototype.connect = function () {
		var c = this.connection = net.createConnection(this.port, this.host);
		c.setEncoding(this.encoding);
		c.setTimeout(this.timeout);

		this.addListener('connect', this.onConnect);
		this.addListener('data', this.onReceive);
		this.addListener('eof', this.onEOF);
		this.addListener('timeout', this.onTimeout);
		this.addListener('close', this.onClose);
	};

	Server.prototype.disconnect = function (reason) {
		if (this.connection.readyState !== 'closed') {
			this.connection.close();
			sys.puts('disconnected (' + reason + ')');
		}
	};

	Server.prototype.onConnect = function () {
		this.raw('NICK', this.nick);
		this.raw('USER', this.username, '0', '*', ':' + this.realname);
		this.emit('connect');
	};

	Server.prototype.onReceive = function (chunk) {
		this.buffer += chunk;
		while(this.buffer) {
			var offset = this.buffer.indexOf("\r\n");
			if (offset < 0) {
				return;
			}

			var msg = this.buffer.slice(0, offset);
			this.buffer = this.buffer.slice(offset + 2);

			if (this.debug) {
				sys.puts( "< " + msg);
			}

			msg = this.parse(msg);
			this.onMessage(msg);
		}
	};

	Server.prototype.kick = function(channel, nick, reason) {
		if(typeof channel == 'undefined' || typeof nick == 'undefined') return;

		if(typeof reason == 'undefined') reason = nick;
		else reason = reason;

		this.raw('KICK', channel + ' ' + nick + ' :' + reason);
	};
	
	Server.prototype.ban = function(channel, nick, reason) {
		if(typeof channel == 'undefined' || typeof nick == 'undefined') return;

		if(typeof reason == 'undefined') reason = nick;
		else reason = reason;

		this.raw('MODE', channel + ' +b ' + nick.toLowerCase() + '!*@*$##webtech' + ' :' + reason);
		this.kick(channel, nick, reason);
	};

	Server.prototype.ctcp = function(nick, target, msg, command) {
		msg = msg.slice(1); msg = msg.slice(0, msg.lastIndexOf('\x01'));
		var parts = msg.split(" ");
		this.emit('ctcp', nick, target, msg, command);
		this.emit('ctcp-'+command, nick, target, msg);

		if(command === "PRIVMSG" && msg == "VERSION") {
			var plugins = [];
			for (var trig in this.triggers) {
				plugins.push(trig);
			}

			this.raw("NOTICE", nick, ":\x01VERSION DunnBot, running ["+(plugins.join(", "))+"] plugins\x01");
			this.emit("ctcp-version", nick, target);
		}
	};

	Server.prototype.onMessage = function (msg) {
		if (this.debug) {
			sys.puts('++ command: ' + msg.command);
			sys.puts('++ arguments: ' + msg.arguments);
			sys.puts('++ prefix: ' + msg.prefix);
			sys.puts('++ lastarg: ' + msg.lastarg);
		}

		var target = msg.arguments[0], // target
		nick = (this.user(msg.prefix) || '').toLowerCase(), // nick
		user = this.users[nick], // user
		m, // message
		command = msg.command, // command
		users = this.users; // user hash

		switch(true){
			case (command === 'PING'):
			this.raw('PONG', msg.arguments);
			break;

			case (command == "NOTICE"):
			if(msg.arguments[1][0] === "\x01" && msg.arguments[1].lastIndexOf('\x01') > 0) {
				this.ctcp(nick, target, msg.arguments[1], command);
			}
			this.emit("notice", msg);
			break;

			case (command === 'PRIVMSG'):
			if (user) {
				user.update(msg.prefix);
			}

			if(msg.arguments[1][0] === "\x01" && msg.arguments[1].lastIndexOf('\x01') > 0) {
				this.ctcp(nick, target, msg.arguments[1], command);
			}

			// Look for triggers
			var params = msg.arguments[1].split(' '),
			cmd = params.shift();

			if (cmd.substring(0, 1) == this.command) {

				var trigger = cmd.substring(1);

				if (typeof this.triggers[trigger] != 'undefined') {
					var trig = this.triggers[trigger];

					if(trig.user_status == 'admin') {
						if(this.admins.indexOf(nick.toLowerCase()) == -1) {
							this.send(this.channels[msg.arguments[0]].name.toLowerCase(), nick.toLowerCase() + ": Insufficient permissions");
							return false;
						}
					}

					if(trig.user_status == 'op') {
						if(this.ops.indexOf(nick.toLowerCase()) == -1) {
							this.send(this.channels[msg.arguments[0]].name.toLowerCase(), nick.toLowerCase() + ": Insufficient permissions");
							return false;
						}
					}
					
					if(trig.user_status == 'dev') {
						if(this.devs.indexOf(nick.toLowerCase()) == -1) {
							this.send(this.channels[msg.arguments[0]].name.toLowerCase(), nick.toLowerCase() + ": Insufficient permissions");
							return false;
						}
					}

					if (typeof this.channels[msg.arguments[0]] != "undefined") {
						//room message recieved

						try {
							trig.callback.apply(this.plugins[trig.plugin], [this, this.channels[msg.arguments[0]].name.toLowerCase(), nick.toLowerCase(), params, msg.arguments[1], msg.orig]);
						} catch(err) {
							this.sendHeap(err.stack, this.channels[msg.arguments[0]].name.toLowerCase());
							return false;
						}
					} else {
						//PM recieved
					}
				} else if(trigger == "heaps") {
					if(this.heap.length > 0) {
						this.send(this.channels[msg.arguments[0]].name.toLowerCase(), this.heap.join(" "));
						this.heap = [];
					} else {
						this.send(this.channels[msg.arguments[0]].name.toLowerCase(), "No heaps");
					}
				}
			} else {
				var msgHandlers = this.messagehandlers, msgTrigger, match;
				for (msgTrigger in msgHandlers) {
					match = msg.arguments[1].toLowerCase().match(msgTrigger);
					if (match) {
						msgHandler = msgHandlers[msgTrigger];

						if (typeof this.channels[msg.arguments[0]] != "undefined") {
							//room message recieved

							try {
								msgHandler.callback.apply(msgHandler.plugin, [this, this.channels[msg.arguments[0]].name.toLowerCase(), nick.toLowerCase(), match, msg.arguments[1], msg.orig]);
							} catch(err) {
								this.sendHeap(err.stack, this.channels[msg.arguments[0]].name.toLowerCase());
								return false;
							}
						} else {
							//PM recieved
						}
						msgHandlers = [];
					}
				}
			}

			if (user == this.nick) {
				this.emit('private_message', msg);
			}

			else {
				this.emit('message', msg);
			}

			break;

			case (command === 'JOIN'):
			if (user) {
				user.update(msg.prefix);
				user.join(target);
			}

			else {
				user = this.users[nick] = new this.userObj(this, nick);
				this.raw('NS id ' + this.config.identPass);
			}

			user.join(target);
			this.emit('join', msg);
			break;

			case (command === 'PART'):
			if (user) {
				user.update(msg.prefix);
				user.part(target);
			}

			this.emit('part', msg);
			break;

			case (command === 'QUIT'):
			if (user) {
				user.update(msg.prefix);
				user.quit(msg);
			}

			this.emit('quit', msg);
			break;

			case (command === 'NICK'):
			if (user) {
				user.update(msg.prefix);
			}

			this.emit('nick', msg);
			break;

			case (/^\d+$/.test(command)):
			this.emit('numeric', msg);
			break;
		}

		this.emit(msg.command, msg);
		this.emit('data', msg);
	};

	Server.prototype.user = function (mask){
		if (!mask) {
			return;
		}
		var match = mask.match(/([^!]+)![^@]+@.+/);

		if (!match ) {
			return;
		}
		return match[1];
	};

	Server.prototype.parse = function (text) {
		if (typeof text !== "string") {
			return false;
		}

		var tmp = text.split(" ");

		if (tmp.length < 2) {
			return false;
		}

		var prefix = null,
		command = null,
		lastarg = null,
		args = [];

		for (var i = 0, j = tmp.length; i < j; i++) {
			if (i === 0 && tmp[i].indexOf(":") === 0) {
				prefix = tmp[0].substr(1);
			} else if (tmp[i] === "") {
				continue;
			} else if (!command && tmp[i].indexOf(":") !== 0) {
				command = tmp[i].toUpperCase();
			} else if (tmp[i].indexOf(":") === 0) {
				tmp[i] = tmp[i].substr(1);
				tmp.splice(0, i);
				args.push(tmp.join(" "));
				lastarg = args.length - 1;
				break;
			} else {
				args.push(tmp[i]);
			}
		}

		return {
			prefix: prefix,
			command: command,
			arguments: args,
			lastarg: lastarg,
			orig: text
		};
	};

	Server.prototype.onEOF = function () {
		this.disconnect('EOF');
	};

	Server.prototype.onTimeout = function () {
		this.disconnect('timeout');
	};

	Server.prototype.onClose = function () {
		this.disconnect('close');
	};

	Server.prototype.raw = function (cmd) {
		if (this.connection.readyState !== "open") {
			return this.disconnect("cannot send with readyState " + this.connection.readyState);
		}

		var msg = Array.prototype.slice.call(arguments, 1).join(' ') + "\r\n";

		if (this.debug) {
			sys.puts('>' + cmd + ' ' + msg);
		}

		this.connection.write(cmd + " " + msg, this.encoding);
	};

	// public method to send PRIVMSG cleanly
	Server.prototype.send = function (target, msg) {
		msg = Array.prototype.slice.call(arguments, 1).join(' ') + "\r\n";

		if (arguments.length > 1) {
			this.raw('PRIVMSG', target, ':' + msg);
		}
	};
	
	Server.prototype.action = function (target, msg) {
		msg = Array.prototype.slice.call(arguments, 1).join(' ') + "\r\n";

		if (arguments.length > 1) {
			this.raw('PRIVMSG', target, ':\u0001' + 'ACTION ' + msg + '\u0001');
		}
	};

	Server.prototype.addListener = function (ev, f) {
		var that = this;
		return this.connection.addListener(ev, (function() {
			return function() {
				f.apply(that, arguments);
			};
			})());
		};

		Server.prototype.addPluginListener = function (plugin, ev, f) {
			if (typeof this.hooks[plugin] == 'undefined') {
				this.hooks[plugin] = [];
			}

			var scope = this.plugins[plugin];

			var callback = (function() {
				return function() {
					f.apply(scope, arguments);
				};
				})();

				this.hooks[plugin].push({event: ev, callback: callback});

				return this.on(ev, callback);
			};

			Server.prototype.unloadPlugin = function (name) {
				if (typeof this.plugins[name] != 'undefined') {
					delete this.plugins[name];

					if (typeof this.hooks[name] != 'undefined') {

						for(var hook in this.hooks[name]) {

							this.removeListener(this.hooks[name][hook].event, this.hooks[name][hook].callback);

						}

					}

					if (typeof this.replies[name] != 'undefined') {

						for(var reply in this.replies[name]) {

							this.removeListener(this.replies[name][reply].event, this.replies[name][reply].callback);

						}

					}

					for(var trig in this.triggers) {

						if (this.triggers[trig].plugin == name) {

							delete this.triggers[trig];

						}

					}

					if(typeof require.cache[__dirname.substr(0, __dirname.length-5) + "/plugins/" + name + ".js"] != "undefined") {
						delete require.cache[__dirname.substr(0, __dirname.length-5) + "/plugins/" + name + ".js"]; //requires absolute path
					}

					//windows
					if(typeof require.cache[__dirname.substr(0, __dirname.length-5) + "\\plugins\\" + name + ".js"] != "undefined") {
						delete require.cache[__dirname.substr(0, __dirname.length-5) + "\\plugins\\" + name + ".js"];
					}
				}


			};

			Server.prototype.loadPlugin = function (name) {

				this.unloadPlugin(name);

				var that = this,
				path = __dirname + '/../plugins/' + name + '.js',
				plugin;

				// load plugin
				if (existsSync(path)) {

					// require
					try {
						plugin = require(path);
					} catch(err) {
						this.sendHeap(err.stack);
						return false;
					}
					// invoke
					that.plugins[name] = new plugin.Plugin(that);

					// hooks
					['connect', 'data', 'numeric', 'message', 'join', 'part', 'quit', 'nick', 'privateMessage'].forEach(function(event) {
						var onEvent = 'on' + event.charAt(0).toUpperCase() + event.substr(1),
						callback = this.plugins[name][onEvent];

						if (typeof callback == 'function') {
							this.addPluginListener(name, event, callback);
						}

						}, that);

						return true;
					}

					// invalid plugin
					else {
						sys.puts("Plugin not found: " + name);
						return false;
					}

				};

				Server.prototype.addTrigger = function (trigger, callback, user_status) {
					if (typeof this.triggers[trigger] == 'undefined') {
						if(typeof user_status == "undefined") {
							user_status = 'user';
						}
						this.triggers[trigger] = { plugin: trigger, callback: callback, user_status: user_status };
					}
				};

				Server.prototype.addMessageHandler = function (trigger, callback) {
					if (typeof this.messagehandlers[trigger] == 'undefined') {
						this.messagehandlers[trigger] = { plugin: trigger, callback: callback};
					}
				};

				process.on('uncaughtException', function (error) {
					console.log(error.stack); //prevents from crashing
				});
