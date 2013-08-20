/*
 * @Plugin 			Karma
 * @Description 	Issues karma points to users.
 * @Trigger 		<nick>++
 *
 * @Author 			Killswitch (Josh Manders)
 * @Website 		http://www.joshmanders.com
 * @Copyright 		Josh Manders 2013
 *
 */

Plugin = exports.Plugin = function (irc) {
	this.irc = irc;
};

Plugin.prototype.onMessage = function(message) {
	var nick = (this.irc.user(message.prefix) || '').toLowerCase(),
		channel = message.arguments[0],
		msg = message.arguments[1];
	if (user = msg.match(/^(\w+)\+\+;?(.+)?$/i)) {
		this.give(this.irc, channel.toLowerCase(), nick.toLowerCase(), user[1].toLowerCase(), user[2]);
	}
	else if (user = msg.match(/^(\w+)\-\-;?(.+)?$/i)) {
		this.take(this.irc, channel.toLowerCase(), nick.toLowerCase(), user[1].toLowerCase(), user[2]);
	}
};

Plugin.prototype.give = function (irc, channel, from, to, reason) {
	var from_id = to_id = null;
	if (from == to) {
		irc.send(channel, from + ': Attempting to give yourself karma is a big no no.');
	}
	else if (to == irc.nick.toLowerCase())
	{
		irc.send(channel, from + ': Although I appreciate the guesture it is of no use to me.');
	}
	else {
		irc.db.query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [from], function (err, result) {
			if (result.length > 0) {
				from_id = result[0].user_id;
			}
			irc.db.query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [to], function (err, result) {
				if (result.length > 0) {
					to_id = result[0].user_id;
				}
				if (from_id == null) {
					irc.send(channel, from + ': Unable to give karma to ' + to + ' as you are not registered with me.');
				}
				else if (to_id == null) {
					irc.send(channel, from + ': Unable to give karma to ' + to + ' as they are not registered with me.');
				}
				else {
					irc.db.query('INSERT INTO karma SET ?', {
						created_on: Date.create(new Date()).format('{yyyy}-{MM}-{dd} {HH}:{mm}:{ss}'),
						from_user_id: from_id,
						to_user_id: to_id,
						action: 'give',
						reason: ((reason === undefined) ? '' : reason.replace('for', '').trim())
					}, function (err, result) {
						irc.send(channel, from + ': Karma has been given to ' + to + ((reason === undefined) ? '.' : ' for ' + reason.replace('for', '').trim() + '.'));
					});
				}
			});
		});
	}
};

Plugin.prototype.take = function (irc, channel, from, to, reason) {
	var from_id = to_id = null;
	if (from == to) {
		irc.send(channel, from + ': You can not take karma from yourself. Why you would want to do that is beyond me though.');
	}
	else if (to == irc.nick.toLowerCase())
	{
		irc.send(channel, from + ': Well that is kind of rude of you to try and do.');
	}
	else {
		irc.db.query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [from], function (err, result) {
			if (result.length > 0) {
				from_id = result[0].user_id;
			}
			irc.db.query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [to], function (err, result) {
				if (result.length > 0) {
					to_id = result[0].user_id;
				}
				if (from_id == null) {
					irc.send(channel, from + ': Unable to take karma from ' + to + ' as you are not registered with me.');
				}
				else if (to_id == null) {
					irc.send(channel, from + ': Unable to take karma from ' + to + ' as they are not registered with me.');
				}
				else {
					irc.db.query('INSERT INTO karma SET ?', {
						created_on: Date.create(new Date()).format('{yyyy}-{MM}-{dd} {HH}:{mm}:{ss}'),
						from_user_id: from_id,
						to_user_id: to_id,
						action: 'take',
						reason: ((reason === undefined) ? '' : reason.replace('for', '').trim())
					}, function (err, result) {
						irc.send(channel, from + ': Karma has been taken from ' + to + ((reason === undefined) ? '.' : ' for ' + reason.replace('for', '').trim() + '.'));
					});
				}
			});
		});
	}
};