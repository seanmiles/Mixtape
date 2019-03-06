module.exports = {
    name: 'ping',
    aliases: ['test', 'hello'],
    description: 'Ping!',
    cooldown: 5,
    execute(message)
    {
		message.channel.send(':white_check_mark:');
	},
};