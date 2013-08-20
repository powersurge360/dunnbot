/*
 * @Plugin        Rimshot
 * @Description   Badumm tish
 *
 * @Author        Nobody
 *
 */

Plugin = exports.Plugin = function (irc) {
  this.irc = irc;
};

Plugin.prototype.onMessage = function (msg) {
  if(msg.arguments[1].match(/rimshot/i)) this.irc.send(msg.arguments[0], 'badumm tisssshhhhh');
  else if(msg.arguments[1].match(/badumm/i) || msg.arguments[1].match(/ba dumm/i)) this.irc.send(msg.arguments[0], 'tisssshhhhh');
};

