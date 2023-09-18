const { Client, GatewayIntentBits, Intents, MessageEmbed } = require('discord.js');
const fs = require('fs');
const csv = require('csv-parser');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const TOKEN = process.env.BOT_TOKEN;

const commands = [
  {
    name: 'stats',
    description: 'Check your stats',
    options: [
      {
        name: 'user',
        description: 'The user whose stats you want to check',
        type: 6, // Type 6 represents USER in the Discord API
        required: false, // Make it optional
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Cooldown for XP (in milliseconds)
const xpCooldown = 10000; // 10 seconds

// Map to store the last XP gain time for each user
const xpCooldowns = new Map();

(async () => {
  try {
    console.log('Started refreshing global (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
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

  if (commandName === 'stats') {
    // Get the mentioned user or the user specified by ID
    const targetUserOption = options.getUser('user');
    const targetUserId = targetUserOption ? targetUserOption.id : interaction.user.id;

    try {
      // Fetch the user's data from the CSV file
      const userData = await getUserDataFromCSV(targetUserId);

      if (!userData) {
        return interaction.reply('This user has no data yet. They should send some messages to earn XP!');
      }

      // Create an object for the embed with an integer color
      const embed = {
        title: `Stats for ${targetUserOption ? targetUserOption.username : interaction.user.username}`,
        fields: [
          { name: 'Level', value: userData.level, inline: true },
          { name: 'XP', value: userData.xp, inline: true },
        ],
        color: 0x0099ff, // Integer color value
      };

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching user data:', error);
      return interaction.reply('An error occurred while fetching user data.');
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore messages from bots

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
    fs.createReadStream('userdata.csv')
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
  fs.createReadStream('userdata.csv')
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
            // channel.send(`${userData.username} leveled up to level ${data[userIndex].level}!`);
          // }
        }
      } else {
        userData.level = 1;
        data.push(userData);
      }

      const csvStream = fs.createWriteStream('userdata.csv');
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