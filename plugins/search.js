/*
 * @Plugin        Search
 * @Description   Allows you to search
 * @Trigger       .g
 * @Trigger       .gi
 * @Trigger       .gif
 *
 * @Author        buttcactus (Aaron Ahmed)
 * @Website       http://www.digitalkitsune.net
 * @Copyright     DIGITAL KITSUNE 2012
 *
 */

Plugin = exports.Plugin = function(irc) {
  this.irc = irc;
  this.irc.addTrigger('g', this.google);
  this.irc.addTrigger('gi', this.image);
  this.irc.addTrigger('gif', this.gif);
};

Plugin.prototype.google = function(irc, channel, nick, params, message, raw) {
  if(params.length > 0) {
		var http = require("http");

		http.request({
			host: "ajax.googleapis.com",
			path: "/ajax/services/search/web?v=1.0&q="+encodeURIComponent(params.join(" "))
		}, function(res) {
			var data = "";

			res.on("data", function(chunk) {
				data += chunk;
			}).on("end", function() {
				data = JSON.parse(data);
				irc.send(channel, decodeURIComponent(data.responseData.results[0].url));
			});
		}).on("error", function(err) {
			irc.sendHeap(err.stack, channel);
		}).end();
  } else {
  	irc.send("Usage: "+irc.command+"g QUERY");
  }
}

Plugin.prototype.image = function(irc, channel, nick, params, message, raw) {
  if(params.length > 0) {
		var http = require("http");

		http.request({
			host: "ajax.googleapis.com",
			path: "/ajax/services/search/images?v=1.0&q="+encodeURIComponent(params.join(" "))
		}, function(res) {
			var data = "";

			res.on("data", function(chunk) {
				data += chunk;
			}).on("end", function() {
				data = JSON.parse(data);
				irc.send(channel, decodeURIComponent(data.responseData.results[0].url));
			});
		}).on("error", function(err) {
			irc.sendHeap(err.stack, channel);
		}).end();
	} else {
  	irc.send("Usage: "+irc.command+"gi QUERY");
  }
}

Plugin.prototype.gif = function(irc, channel, nick, params, message, raw) {
  if(params.length > 0) {
		var http = require("http");

		http.request({
			host: "ajax.googleapis.com",
			path: "/ajax/services/search/images?v=1.0&q="+encodeURIComponent(params.join(" ")+" filetype:gif")
		}, function(res) {
			var data = "";

			res.on("data", function(chunk) {
				data += chunk;
			}).on("end", function() {
				data = JSON.parse(data);
				irc.send(channel, decodeURIComponent(data.responseData.results[0].url));
			});
		}).on("error", function(err) {
			irc.sendHeap(err.stack, channel);
		}).end();
	} else {
  	irc.send("Usage: "+irc.command+"gif QUERY");
  }
}

