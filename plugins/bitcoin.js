/*
 * @Plugin 			Bitcoin
 * @Description 	Gets current bitcoin stats from the mtgox ticker.
 * @Trigger 		bitcoin
 *
 * @Author 			Killswitch (Josh Manders)
 * @Website 		http://www.joshmanders.com
 * @Copyright 		Josh Manders 2013
 *
 */

Plugin = exports.Plugin = function (irc) {
	this.irc = irc;
	irc.addTrigger('bit', this.bitcoin);
	irc.addTrigger('bitcoin', this.bitcoin);
};

Plugin.prototype.bitcoin = function (irc, channel, nick, params, message, raw) {

  var currency = params[0] || 'USD';

  irc.httpGet('https://data.mtgox.com/api/2/BTC'+currency+'/money/ticker', function (err, res, result) {
		var ticker = JSON.parse(result);
		if (ticker.result == 'success')
    {
      irc.send(channel, nick + ': Current: ' + ticker.data.buy.display_short + ' - High: ' + ticker.data.high.display_short + ' - Low: ' + ticker.data.low.display_short + ' - Volume: ' + ticker.data.vol.display_short);
	  }
  });
};