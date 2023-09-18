const fs = require('fs');
const csv = require('csv-parser');

function getUserDataFromCSV(userId) {
  return new Promise((resolve, reject) => {
    // Specify the absolute path to the CSV file
    const csvFilePath = __dirname + '/../userdata.csv';

    // Load existing data from the CSV file
    const data = [];
    fs.createReadStream(csvFilePath)
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

module.exports = {
  data: {
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
  async execute(interaction, options) {
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
  },
};