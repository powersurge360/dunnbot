var irc = require('./libs/irc.js'),
    config = require('./config');

var ircClient = new irc.Server(config);

ircClient.server.listen(config.http && config.http.port || 8888, function (err) {
  if (err) throw err;
  ircClient.connect();
});
