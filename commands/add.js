const Discord = require('discord.js');
args: true,

module.exports = {
	name: 'add',
	description: 'Add the following song/link to the selected playlist.',
	execute(message, args) 
	{
		const exampleEmbed = new Discord.RichEmbed()
			.setColor('#808080')
			.setDescription(`Added **${args}** to playlist`)

		message.channel.send(exampleEmbed);
	},
};