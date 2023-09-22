const { Client, GatewayIntentBits, Intents, Collection } = require('discord.js');
const fs = require('fs');
const csv = require('csv-parser');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const TOKEN = process.env.BOT_TOKEN;
const PREFIX = '!'; // Change this to your desired prefix

client.commands = new Collection();

const commands = [
  'stats', // Add other command names here
];

for (const command of commands) {
  const commandModule = require(`./commands/${command}.js`);
  client.commands.set(command, commandModule);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Cooldown for XP (in milliseconds)
const xpCooldown = 10000; // 10 seconds

// Map to store the last XP gain time for each user
const xpCooldowns = new Map();

(async () => {
  try {
    console.log('Started refreshing global (/) commands.');

    const commandData = commands.map((command) => {
      const commandModule = client.commands.get(command);
      return {
        name: command,
        description: commandModule.data.description,
        options: commandModule.data.options,
      };
    });

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commandData },
    );

    console.log('Successfully reloaded global (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (client.commands.has(commandName)) {
    try {
      const command = client.commands.get(commandName);
      await command.execute(interaction, options);
    } catch (error) {
      console.error('Error executing command:', error);
      await interaction.reply('An error occurred while executing the command.');
    }
  }
});

client.on('messageCreate', async (message) => {
  // if (message.author.bot) return; // Ignore messages from bots

  // Handle leveling logic here
  const userId = message.author.id;

  // Check if the user is on cooldown for XP
  if (xpCooldowns.has(userId)) {
    const lastXPTime = xpCooldowns.get(userId);
    const currentTime = Date.now();

    // If the user is still on cooldown, return
    if (currentTime - lastXPTime < xpCooldown) return;
  }

  const userData = { userId: userId, username: message.author.username, xp: 10 };

  // Save the current time as the last XP gain time for the user
  xpCooldowns.set(userId, Date.now());

  saveUserData(userData);
});

function getUserDataFromCSV(userId) {
  return new Promise((resolve, reject) => {
    // Load existing data from the CSV file
    const data = [];
    fs.createReadStream('../API/levlr/userdata.csv')
      .pipe(csv())
      .on('data', (row) => data.push(row))
      .on('end', () => {
        const user = data.find((user) => user.userId === userId);
        resolve(user);
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
        reject(error);
      });
  });
}

function saveUserData(userData) {
  // Load existing data from the CSV file
  const data = [];
  fs.createReadStream('../API/levlr/userdata.csv')
    .pipe(csv())
    .on('data', (row) => data.push(row))
    .on('end', () => {
      const userIndex = data.findIndex((user) => user.userId === userData.userId);

      if (userIndex !== -1) {
        data[userIndex].xp = parseInt(data[userIndex].xp) + userData.xp;
        let xpRequiredForNextLevel = calculateXpRequiredForNextLevel(data[userIndex].level);
        while (data[userIndex].xp >= xpRequiredForNextLevel) {
          data[userIndex].level++;
          data[userIndex].xp -= xpRequiredForNextLevel;
          xpRequiredForNextLevel = calculateXpRequiredForNextLevel(data[userIndex].level);
          // const channel = client.channels.cache.get(message.channelId);
          // if (channel) {
          //   channel.send(`${userData.username} leveled up to level ${data[userIndex].level}!`);
          // }
        }
      } else {
        userData.level = 1;
        data.push(userData);
      }

      const csvStream = fs.createWriteStream('../API/levlr/userdata.csv');
      csvStream.write('userId,username,xp,level\n'); // Removed messageCount from the header
      data.forEach((user) => {
        csvStream.write(`${user.userId},${user.username},${user.xp},${user.level}\n`);
      });
      csvStream.end();
    });
}

function calculateXpRequiredForNextLevel(level) {
  return Math.floor(100 * Math.pow(1.2, level));
}

client.login(TOKEN);