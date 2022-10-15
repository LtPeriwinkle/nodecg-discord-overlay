const {PermissionsBitField} = require('discord.js');
module.exports = (client, alias, roleID, callback) => {
	client.on('messageCreate', (message) => {
		const { content } = message;
		const command = `<@!${client.user.id}> ${alias}`;
		const command1 = `<@${client.user.id}> ${alias}`;

		if (content === command || content === command1) {
			if (message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) || message.member.roles.cache.has(roleID))
				callback(message)
			else
				message.reply(`You do not have permission to execute this command!`)
		}
	})
}
