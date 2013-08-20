/*
 * @Plugin 			Log
 * @Description 	Logs the channel.
 * @Trigger 		none
 *
 * @Author 			Killswitch (Josh Manders)
 * @Website 		http://www.joshmanders.com
 * @Copyright 		Josh Manders 2013
 *
 */

Plugin = exports.Plugin = function (irc) {
	this.irc = irc;
	irc.addTrigger('seen', this.seen);
};

Plugin.prototype.onMessage = function (msg) {
	var user_nick = (this.irc.user(msg.prefix) || '').toLowerCase(),
		sql = {
			'created_on': Date.create(new Date()).format('{yyyy}-{MM}-{dd} {HH}:{mm}:{ss}'),
			'nick': user_nick,
			'hostmask': msg.prefix.split('!~')[1],
			'channel': msg.arguments[0],
			'message': msg.arguments[1]
		};
  	this.irc.db.query('INSERT INTO logs SET ?', sql, function(err, result) {});
};

Plugin.prototype.seen = function (irc, channel, nick, params, message, raw) {
	irc.db.query("SELECT created_on, nick, message FROM logs WHERE nick = '" + params[0] + "' ORDER BY log_id DESC LIMIT 1", function (err, result) {
		if (result.length > 0)
		{
			irc.send(channel, nick + ': ' + params[0] + ' was last seen ' + Date.create(result[0].created_on).relative() + ' saying: ' + result[0].message);
		}
		else
		{
			irc.send(channel, nick + ': I have not seen ' + params[0]);
		}
	});
};