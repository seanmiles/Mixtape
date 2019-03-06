const fs = require('fs');
const Util = require('discord.js');
const Discord = require('discord.js');
const { prefix, youtubekey, token } = require('./config.json');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');
const ytdlDiscord = require('ytdl-core-discord');

const client = new Discord.Client({ disableEveryone: true });
const youtube = new YouTube(youtubekey);
// client.commands = new Discord.Collection();
const queue = new Map();
// const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
// const cooldowns = new Discord.Collection();

/* for (const file of commandFiles) 
{
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
} */

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () =>
{
    client.user.setActivity('!help');
    console.log('Ready!');
});

client.on('disconnect', () =>
{
    console.log('Disconnected, reconnecting now...');
});

client.on('reconnecting', () =>
{
    console.log('Reconnecting now!');
});

client.on('message', async message =>
{
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
    const serverQueue = queue.get(message.guild.id);

    if(message.content.startsWith(`${prefix}play`))
    {
        const voiceChannel = message.member.voiceChannel;
        if(!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if(!permissions.has('CONNECT'))
        {
            return message.channel.send('I cannot connect to your voice channel, make sure I have the proper permissions!');
        }
        if(!permissions.has('SPEAK'))
        {
            return message.channel.send('I cannot speak in this voice channel, make sure I have the proper permissions!');
        }

        if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/))
        {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for(const video of Object.values())
            {
                const video2 = await youtube.getVideoByID(video.id);
                await handleVideo(video2, message, voiceChannel, true);
            }
            return message.channel.send(`Playlist: **${playlist.title}** has been added to the queue!`);
        }
        else
        {
            try 
            {
                var video = await youtube.getVideo(url);
            } 
            catch (error) 
            {
                try 
                {
                    var videos = await youtube.searchVideos(searchString, 1);
                    var video = await youtube.getVideoByID(videos[0].id);
                } 
                catch (err) 
                {
                    console.error(err);
                    return message.channel.send('Could not find any search results.');
                }
            }
            return handleVideo(video, message, voiceChannel);
        }
    }
    else if(message.content.startsWith(`${prefix}search`))
    {
        const voiceChannel = message.member.voiceChannel;
        if(!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if(!permissions.has('CONNECT'))
        {
            return message.channel.send('I cannot connect to your voice channel, make sure I have the proper permissions!');
        }
        if(!permissions.has('SPEAK'))
        {
            return message.channel.send('I cannot speak in this voice channel, make sure I have the proper permissions!');
        }

        try 
        {
            var video = await youtube.getVideo(url);
        } 
        catch (error) 
        {
            try 
            {
                var videos = await youtube.searchVideos(searchString, 10);
                let index = 0;
                message.channel.send(`
__**Song Selection:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

Please provide a value to select one of the search results ranging from 1-10.
                `);

                try 
                {
                    var response = await message.channel.awaitMessages(message2 => message2.content > 0 && message2.content < 11, {
                        maxMatches: 1,
                        time: 10000,
                        errors: ['time'],
                    });
                } 
                catch (err) 
                {
                    console.error(err);
                    return message.channel.send('No or invalid value entered, cancelling video selection.');
                }
                const videoIndex = parseInt(response.first().content);
                var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
            } 
            catch (err) 
            {
                console.error(err);
                return message.channel.send('Could not find any search results.');
            }
        }
        return handleVideo(video, message, voiceChannel);
    }
    else if(message.content.startsWith(`${prefix}skip`))
    {
        if(!message.member.voiceChannel) return message.channel.send('You are not in a voice channel!');
        if(!serverQueue) return message.channel.send('There is nothing playing that can be skipped.');
        serverQueue.connection.dispatcher.end('Skip command used!');
        return;
    }
    else if(message.content.startsWith(`${prefix}stop`))
    {
        if(!message.member.voiceChannel) return message.channel.send('You are not in a voice channel!');
        if(!serverQueue) return message.channel.send('There is nothing playing that can be stopped.');
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end('Stop command used!');
        return;
    }
    else if(message.content.startsWith(`${prefix}np`))
    {
        if(!serverQueue) return message.channel.send('There is nothing playing.');
        return message.channel.send(`Now playing: **${serverQueue.songs[0].title}**`);
    }
    else if(message.content.startsWith(`${prefix}volume`))
    {
        if(!serverQueue) return message.channel.send('There is nothing playing.');
        if(!args[1]) return message.channel.send(`The current volume is: ${serverQueue.volume}`);
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
        return message.channel.send(`Volume set to **${serverQueue.volume}**`);
    }
    else if(message.content.startsWith(`${prefix}queue`))
    {
        if(!serverQueue) return message.channel.send('There is nothing playing.');
        return message.channel.send(`
__**Song Queue:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Now playing:** ${serverQueue.songs[0].title}
        `);
    }
    else if(message.content.startsWith(`${prefix}pause`))
    {
        if(serverQueue && serverQueue.playing) 
        {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return message.channel.send('Music paused.');
        }
        return message.channel.send('There is nothing playing.');
    }
    else if(message.content.startsWith(`${prefix}resume`))
    {
        if(serverQueue && !serverQueue.playing) 
        {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.channel.send('Music resumed.');
        }
        return message.channel.send('There is nothing playing.');
    }
    /* const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName)
        || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        
    if (!command) return;

    if (command.args && !args.length) 
    {
		return message.send(`You didn't provide any arguments, ${message.author}!`);
    }

    if (!cooldowns.has(command.name)) 
    {
        cooldowns.set(command.name, new Discord.Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    
    if (timestamps.has(message.author.id)) 
    {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
    
        if (now < expirationTime) 
        {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
        }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    try 
    {
        command.execute(message, args);
    } 
    catch (error) 
    {
        console.error(error);
        message.reply('There was an error trying to execute that command!');
    } */
});

async function handleVideo(video, message, voiceChannel, playlist = false)
{
    const serverQueue = queue.get(message.guild.id);
    console.log(video);
    const song = 
    {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`,
    };

    if(!serverQueue)
    {
        const queueConstruct = 
        {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        };
        queue.set(message.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try
        {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0]);
        } 
        catch(error)
        {
            console.error(`I could not join the voice channel: ${error}`);
            queue.delete(message.guild.id);
            return message.channel.send(`I could not join the voice channel: ${error}`);
        }
    }
    else
    {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        if(playlist) return;
        else return message.channel.send(`**${song.title}** has been added to the queue!`);
    }
    return;
}

async function play(guild, song)
{
    const serverQueue = queue.get(guild.id);

    if(!song)
    {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playOpusStream(await ytdlDiscord(song.url), { passes: 3 })
    .on('end', reason => 
    {
        if(reason == 'Stream is not generating quickly enough.') console.log('Song ended!');
        else console.log(reason);
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    })
    .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

    serverQueue.textChannel.send(`Now playing: **${song.title}**`);
}

client.login(token);