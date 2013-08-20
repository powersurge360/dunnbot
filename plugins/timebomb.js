/*
 * @Plugin        Timebomb
 * @Description   Nonsense. 
 * @Trigger       .timebomb <nick>
 * @Trigger       .cut <color>
 *
 * @Author        buttcactus (Aaron Ahmed)
 * @Website       http://www.digitalkitsune.net
 * @Copyright     Digital-Kitsune 2012
 *
 */
 
var mongodb = require('mongojs');
 
var self = this;
Plugin = exports.Plugin = function (irc) {
  this.irc = irc;
  this.db = mongodb.connect(irc.database, ['timebomb']);
  this.irc.addTrigger('timebomb', this.timebomb);
  this.irc.addTrigger('cut', this.cut);

  this.pause = false;

  self = this;
  this.interval = null;
};

Plugin.prototype.timebomb = function (irc, channel, nick, params, message, raw) {
  if(this.interval == null) {
    this.interval = setInterval(self.kick, 500);
  }

  if (params.length > 0) {
    params[0] = params[0].toLowerCase();
    if(params[0] == irc.nick.toLowerCase()) {
      irc.send(channel, "I'm afraid I can not do that, Dave");
      params[0] = nick;
    } if(typeof irc.users[params[0]] == "undefined") {
      irc.send(channel, params[0] + " not found in this channel");
    } else {
      var dbase = self.db;
      dbase.timebomb.find({nick: params[0], channel: channel}).limit(1, function(err, result) {
        if(result.length > 0) {
          irc.send(channel, "Already strapped a timebomb to "+params[0]);
        } else {
          var colors = ["green", "red", "blue", "brown", "orange", "rainbow", "black", "white", "yellow"];
          var num = 2+Math.floor(Math.random() * ((colors.length-2)/2));
          colors = colors.sort(function(){return 0.5-Math.random();}).splice(0, num);
          var diffuseColor = colors[Math.floor(Math.random() * colors.length)];
          irc.send(channel, nick + " straps a timebomb to "+params[0]+"'s chest with the following wires: " + colors.join(", "));
          irc.send(channel, params[0] + " you have 15 seconds to cut a wire to defuse a bomb ( "+irc.command+"cut color )");

          dbase.timebomb.save({
            nick: params[0],
            channel: channel,
            diffuse: diffuseColor,
            time: new Date()
          });
        }
      });
    }
  } else {
    irc.send(channel, "Usage .timebomb nicke");
  }
};

Plugin.prototype.kick = function() {
  if(self.pause) return;
  var dbase = self.db, irc = self.irc;
  dbase.timebomb.find(function(err, result) {
    var timeNow = new Date();
    result.forEach(function(bomb) {
      if((timeNow - bomb.time) > 15000) {
        irc.raw("KICK", bomb.channel + " " + bomb.nick + " :Boom! "+bomb.nick+" took too long to cut the wire (correct wire was "+bomb.diffuse+")");
        dbase.timebomb.remove(bomb);
      }
    });
  });
}

Plugin.prototype.cut = function (irc, channel, nick, params, message, raw) {
  var dbase = self.db;
  self.pause = true;
  dbase.timebomb.find({nick: nick, channel: channel}).limit(1, function(err, result) {
    if(result.length > 0) {
      result = result[0];
      if(params[0].toLowerCase() == result.diffuse) {
        irc.send(result.channel, result.nick + " defused the bomb");
      } else {
        irc.raw("KICK", result.channel + " " + result.nick + " :Boom! "+result.nick+" cut the wrong wire (correct wire was "+result.diffuse+")");
        irc.send(result.channel, result.nick + " blew up in pieces");
      }
      dbase.timebomb.remove(result);
    }

    self.pause = false;
  });
}