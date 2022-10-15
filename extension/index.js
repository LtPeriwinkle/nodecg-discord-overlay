const fs = require('fs');
const {Client, IntentsBitField} = require('discord.js');
const {joinVoiceChannel} = require('@discordjs/voice');
const command = require('./commands');

let connection, speakingMap, channel;

module.exports = function (nodecg) {

	const memberList = nodecg.Replicant('memberList', { persistent: false });
	const addMember = nodecg.Replicant('addMember', { persistent: false });
	const removeMember = nodecg.Replicant('removeMember', { persistent: false });
	const changeMute = nodecg.Replicant('changeMute', { persistent: false });
	const speaking = nodecg.Replicant('speaking', { persistent: false });
	addMember.value = null;
	removeMember.value = null;
	changeMute.value = null;
	speaking.value = null;
	memberList.value = [];
	connection = undefined;
	speakingMap = undefined;
	channel = undefined;

	let roleID = nodecg.bundleConfig.roleID;

	const intents = new IntentsBitField();
	intents.add(IntentsBitField.Flags.MessageContent, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildVoiceStates);
	const client = new Client({ intents: intents });

	command(client, 'connect', roleID, (message) => {
		if (connection === undefined && message.member.voice.channel !== undefined && message.member.voice.channel !== null)
			record(message.member.voice.channel);
		else
			message.reply(`You're not in a voice channel!`)		
	});

	command(client, 'disconnect', roleID, (message) => {
		if (connection !== undefined)
			stopRecording();
		else
			message.reply(`I'm not in a voice channel!`)
	});

	client.on('voiceStateUpdate', (oldMember, newMember) => {
		if (connection !== undefined && newMember.id !== client.user.id) {
			if (oldMember.channelID !== channel.id && newMember.channelID === channel.id) {
				let muteState;
				if (newMember.selfMute || newMember.selfDeaf || newMember.serverMute || newMember.serverDeaf)
					muteState = true;
				else
					muteState = false;
				addMember.value = null;
				addMember.value = { id: newMember.id, name: newMember.member.user.username, avatar: newMember.member.user.displayAvatarURL(), muted: muteState };
				memberList.value.push({ id: newMember.id, name: newMember.member.user.username, avatar: newMember.member.user.displayAvatarURL(), muted: muteState });
			} else if (oldMember.channelID === channel.id && newMember.channelID !== channel.id) {
				for (let i = 0; i < memberList.value.length; i++) {
					if (memberList.value[i].id === newMember.id) {
						memberList.value.splice(i, 1)
						break;
					}
				}
				removeMember.value = null;
				removeMember.value = newMember.id;
			} else if (newMember.serverMute !== oldMember.serverMute || newMember.serverDeaf !== oldMember.serverDeaf || newMember.selfMute !== oldMember.selfMute || newMember.selfDeaf !== oldMember.selfDeaf) {
				for (let i = 0; i < memberList.value.length; i++) {
					if (memberList.value[i].id === newMember.id) {
						let muteState;
						if (newMember.serverMute || newMember.serverDeaf || newMember.selfMute || newMember.selfDeaf)
							muteState = true;
						else
							muteState = false;
						changeMute.value = null;
						changeMute.value = { id: newMember.id, muted: muteState }
						memberList.value[i].muted = muteState;
					}
				}
			}
		} else if (connection !== undefined && oldMember.channelId !== null) {
			stopRecording();
			if (newMember.channelId !== null && newMember.channelId !== channel.id) {
				// i'm too stupid to figure out how to do this properly so here we are
				client.channels.fetch(newMember.channelId).then(c => channel = c);
				setTimeout(function () {
					record(channel); 
				}, 500);
			}
		}
	});	



	client.once('ready', () => {
		nodecg.log.info('DACBot is now online. For help, type @' + client.user.username + ' help')

		memberList.on('change', (newVal, oldVal) => {
			client.user.setPresence({ status: "online" });
			if (newVal.length <= 0)
				client.user.setActivity('voice channels...', { type: "WATCHING" });
			else
				client.user.setActivity(newVal.length + ' users...', { type: "LISTENING" });
		});
	});



	function record(chan) {
		connection = joinVoiceChannel({
			channelId: chan.id, 
			guildId: chan.guild.id,
			adapterCreator: chan.guild.voiceAdapterCreator,
			selfDeaf: false,
			selfMute: true
		});
		speakingMap = connection.receiver.speaking;
		channel = chan;
		speakingMap.on('start', (userID) => {
			speaking.value = null;
			speaking.value = { id: userID, speaking: true }
		});
		speakingMap.on('end', (userID) => {
			speaking.value = null;
			speaking.value = { id: userID, speaking: false }
		});

		client.channels.cache.get(channel.id).members.forEach((member) => {
			if (member.user.id !== client.user.id) {
				let muteState;
				if (member.voice.selfMute || member.voice.selfDeaf || member.voice.serverMute || member.voice.serverDeaf)
					muteState = true;
				else
					muteState = false;
				addMember.value = null;
				addMember.value = { id: member.user.id, name: member.user.username, avatar: member.user.displayAvatarURL(), muted: muteState };
				memberList.value.push({ id: member.user.id, name: member.user.username, avatar: member.user.displayAvatarURL(), muted: muteState });
			}
		})

		nodecg.log.info('Capture started for channel ' + channel.name + ' on ' + Date());
	}

	function stopRecording() {
		if (connection !== undefined) {
			nodecg.log.info('Capture stopped for channel ' + channel.name + ' on ' + Date())
			connection.destroy();
		}
		for (let i = 0; i < memberList.value.length; i++) {
			removeMember.value = null;
			removeMember.value = memberList.value[i].id;
		}
		memberList.value = [];
		speakingMap = undefined;
		connection = undefined;
		channel = undefined;
	}
	client.login(nodecg.bundleConfig.botToken);
};
