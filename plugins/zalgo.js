/*
 * @Plugin        	Zalgo
 * @Description   	Echo text with a zalgo filter
 * @Trigger       	!zalgo
 *
 * @Author        	Joshua Holbrook
 * @Website      	https://github.com/jesusabdullah
 * @License       	MIT
 * @Copyright    	Joshua Holbrook 2013
 *
 */

require('colors');

function Zalgo(irc) {
  var trigger = 'zalgo';

  irc.addTrigger('zalgo', function zalgonate(_, channel, _, _, msg) {
    irc.send(channel, msg.zalgo);
  });
}

exports.Plugin = Zalgo;
